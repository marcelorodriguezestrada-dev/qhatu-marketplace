import { NextRequest, NextResponse } from 'next/server'
import { FieldPath, Timestamp, type DocumentSnapshot, type Query, type WhereFilterOp } from 'firebase-admin/firestore'
import { esClaveMaestra } from '@/lib/adminAuth'
import { getDb } from '@/lib/firebaseAdmin'
import { olvidarCache } from '@/lib/cacheLecturas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Admin → Configuración → "🗄️ Base de datos": ver, buscar, editar y borrar
// documentos de cualquier colección de Firestore. Solo con la contraseña
// PRINCIPAL (ADMIN_PASSWORD), no con las claves de admin personales.
// Nada se borra directo: cada documento pasa antes a la papelera
// (papeleraAdmin/{id}: colección, id, datos, fecha) y se puede restaurar.

const PAPELERA = 'papeleraAdmin'
const OPS: WhereFilterOp[] = ['==', '!=', '<', '<=', '>', '>=', 'array-contains']
const noAutorizado = () => NextResponse.json({ error: 'Solo con la contraseña principal del admin (ADMIN_PASSWORD).' }, { status: 401 })
const nombreValido = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(c)
const idValido = (i: unknown): i is string => typeof i === 'string' && i.length > 0 && i.length <= 400 && !i.includes('/')

// Fechas de Firestore (Timestamp) → texto, para poder verlas y editarlas como JSON.
function plano(v: any): any {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(plano)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plano(x)]))
  return v
}

// "15000" → 15000, "true" → true, "null" → null, lo demás texto.
function valorFiltro(v: string): unknown {
  const t = v.trim()
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if (t === 'true' || t === 'false') return t === 'true'
  if (t === 'null') return null
  return t.replace(/^"(.*)"$/, '$1')
}

type Filtro = { campo?: string; op?: string; valor?: string }

function consulta(coleccion: string, f: Filtro | null): Query {
  const ref = getDb().collection(coleccion)
  if (!f?.campo || !f.op || !OPS.includes(f.op as WhereFilterOp)) return ref.orderBy(FieldPath.documentId())
  const q = ref.where(f.campo, f.op as WhereFilterOp, valorFiltro(String(f.valor ?? '')))
  // Con <, >, != Firestore ordena por ese campo; con == alcanza el id.
  return ['==', 'array-contains'].includes(f.op) ? q.orderBy(FieldPath.documentId()) : q.orderBy(f.campo).orderBy(FieldPath.documentId())
}

const filtroDe = (sp: URLSearchParams): Filtro | null => (sp.get('campo') ? { campo: sp.get('campo')!, op: sp.get('op') || '==', valor: sp.get('valor') || '' } : null)

function errorFirestore(err: any) {
  const msg = String(err?.message || err)
  if (/index/i.test(msg)) return 'Para este filtro Firestore pide un índice: probá con "==" o filtrá por otro campo.'
  if (/RESOURCE_EXHAUSTED|Quota/i.test(msg)) return 'Sin cuota de lecturas de la base por hoy.'
  return msg.slice(0, 300)
}

// Lo borrado de estas colecciones también se olvida del caché de las listas públicas.
function olvidar(coleccion: string) {
  if (['productos', 'anuncios', 'profesionales'].includes(coleccion)) olvidarCache(coleccion)
}

export async function GET(req: NextRequest) {
  if (!esClaveMaestra(req.headers.get('x-admin-password'))) return noAutorizado()
  const sp = req.nextUrl.searchParams
  const db = getDb()
  try {
    // Lista de colecciones con cuántos documentos tiene cada una.
    if (sp.get('accion') === 'colecciones') {
      const cols = await db.listCollections()
      const lista = await Promise.all(
        cols.map(async (c) => ({ id: c.id, total: await c.count().get().then((s) => s.data().count).catch(() => null) }))
      )
      return NextResponse.json({ colecciones: lista.sort((a, b) => a.id.localeCompare(b.id)) })
    }
    const coleccion = sp.get('coleccion')
    if (!nombreValido(coleccion)) return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 })
    // Un documento.
    const id = sp.get('id')
    if (id) {
      if (!idValido(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
      const d = await db.collection(coleccion).doc(id).get()
      if (!d.exists) return NextResponse.json({ error: 'No existe.' }, { status: 404 })
      return NextResponse.json({ id: d.id, datos: plano(d.data()) })
    }
    // Una página (50) de la colección, con filtro opcional.
    const filtro = filtroDe(sp)
    const limite = Math.min(100, Math.max(1, Number(sp.get('limite') || 50)))
    let q = consulta(coleccion, filtro)
    const despues = sp.get('despues')
    if (despues && idValido(despues)) {
      const ultimo = await db.collection(coleccion).doc(despues).get()
      if (ultimo.exists) q = q.startAfter(ultimo)
    }
    const [snap, total] = await Promise.all([
      q.limit(limite).get(),
      despues ? Promise.resolve(null) : (filtro ? consulta(coleccion, filtro) : db.collection(coleccion)).count().get().then((s) => s.data().count).catch(() => null),
    ])
    return NextResponse.json({
      docs: snap.docs.map((d) => ({ id: d.id, datos: plano(d.data()) })),
      siguiente: snap.size === limite ? snap.docs[snap.size - 1].id : null,
      total,
    })
  } catch (err) {
    return NextResponse.json({ error: errorFirestore(err) }, { status: 400 })
  }
}

// Pasa documentos a la papelera y los borra (en tandas de hasta 200).
async function aPapelera(coleccion: string, docs: DocumentSnapshot[]) {
  const db = getDb()
  const ahora = new Date().toISOString()
  for (let i = 0; i < docs.length; i += 200) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + 200)) {
      if (!d.exists) continue
      batch.set(db.collection(PAPELERA).doc(), { coleccion, docId: d.id, datos: d.data(), borradoAt: ahora })
      batch.delete(d.ref)
    }
    await batch.commit()
  }
  olvidar(coleccion)
}

export async function POST(req: NextRequest) {
  if (!esClaveMaestra(req.headers.get('x-admin-password'))) return noAutorizado()
  const body = await req.json().catch(() => ({}))
  const db = getDb()
  const { accion, coleccion } = body || {}
  try {
    if (accion === 'restaurar') {
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter(idValido).slice(0, 200)
      const docs = ids.length ? await db.getAll(...ids.map((i) => db.collection(PAPELERA).doc(i))) : []
      const batch = db.batch()
      let n = 0
      for (const d of docs) {
        const x = d.data()
        if (!x || !nombreValido(x.coleccion) || !idValido(x.docId)) continue
        batch.set(db.collection(x.coleccion).doc(x.docId), x.datos || {})
        batch.delete(d.ref)
        olvidar(x.coleccion)
        n++
      }
      if (n) await batch.commit()
      return NextResponse.json({ ok: true, restaurados: n })
    }
    if (accion === 'vaciarPapelera') {
      // Borra para siempre (de a 400 por vez; la pantalla repite hasta terminar).
      const ids: string[] | null = Array.isArray(body.ids) ? body.ids.filter(idValido).slice(0, 400) : null
      const snap = ids ? null : await db.collection(PAPELERA).limit(400).get()
      const refs = ids ? ids.map((i) => db.collection(PAPELERA).doc(i)) : snap!.docs.map((d) => d.ref)
      const batch = db.batch()
      refs.forEach((r) => batch.delete(r))
      if (refs.length) await batch.commit()
      return NextResponse.json({ ok: true, borrados: refs.length, quedan: !ids && refs.length === 400 })
    }

    if (!nombreValido(coleccion)) return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 })
    if (coleccion === PAPELERA) return NextResponse.json({ error: 'La papelera se maneja con Restaurar / Vaciar.' }, { status: 400 })

    if (accion === 'guardar') {
      // Reemplaza el documento entero por el JSON editado (o lo crea si no existe).
      if (!idValido(body.id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
      if (!body.datos || typeof body.datos !== 'object' || Array.isArray(body.datos)) return NextResponse.json({ error: 'Los datos tienen que ser un objeto JSON { ... }.' }, { status: 400 })
      const ref = db.collection(coleccion).doc(body.id)
      // La versión anterior queda en la papelera, por si el cambio sale mal.
      const antes = await ref.get()
      if (antes.exists) await db.collection(PAPELERA).add({ coleccion, docId: body.id, datos: antes.data(), borradoAt: new Date().toISOString(), motivo: 'versión anterior a una edición' })
      await ref.set(body.datos)
      olvidar(coleccion)
      return NextResponse.json({ ok: true })
    }
    if (accion === 'borrar') {
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter(idValido).slice(0, 400)
      if (!ids.length) return NextResponse.json({ error: 'Nada para borrar.' }, { status: 400 })
      const docs = await db.getAll(...ids.map((i) => db.collection(coleccion).doc(i)))
      await aPapelera(coleccion, docs)
      return NextResponse.json({ ok: true, borrados: docs.filter((d) => d.exists).length })
    }
    if (accion === 'borrarFiltro') {
      // Todos los que coinciden con el filtro, de a 300 por vez (la pantalla repite).
      const snap = await consulta(coleccion, body.filtro || null).limit(300).get()
      await aPapelera(coleccion, snap.docs)
      return NextResponse.json({ ok: true, borrados: snap.size, quedan: snap.size === 300 })
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: errorFirestore(err) }, { status: 400 })
  }
}
