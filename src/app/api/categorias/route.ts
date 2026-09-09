import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CATEGORIAS_BASE, CATEGORIA_FALLBACK_ID, type Categoria } from '@/data/categorias'

export const dynamic = 'force-dynamic'

function slugify(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// Arma el árbol final Categoría > Rubro combinando:
// 1. La base fija del código (src/data/categorias.ts)
// 2. Categorías que el admin agregó a mano (`categorias_personalizadas`)
// 3. Rubros que el admin agregó a mano, o que un profesional escribió
//    al elegir "Otro" en el formulario (`rubros_personalizados`,
//    cada uno ya con la categoría a la que pertenece)
// 4. Reubicaciones: rubros de la base que el admin decidió mover a
//    otra categoría porque no correspondían (`rubro_categoria_overrides`)
export async function construirArbolCategorias() {
  const db = getDb()
  const [personalizadasSnap, rubrosSnap, overridesSnap] = await Promise.all([
    db.collection('categorias_personalizadas').get(),
    db.collection('rubros_personalizados').get(),
    db.collection('rubro_categoria_overrides').get(),
  ])

  const personalizadas = new Map(personalizadasSnap.docs.map((d) => [d.id, (d.data() as any).label as string]))

  const mapa = new Map<string, Categoria>()
  for (const c of CATEGORIAS_BASE) {
    // Si el admin le cambió el nombre a una categoría de la base
    // (misma id, otro label), usamos ese nombre en vez del original.
    mapa.set(c.id, { id: c.id, label: personalizadas.get(c.id) || c.label, rubros: [...c.rubros] })
  }
  for (const [id, label] of personalizadas) {
    if (mapa.has(id)) continue
    mapa.set(id, { id, label: label || id, rubros: [] })
  }

  // Reubicar rubros base que el admin movió a otra categoría.
  const overrides = new Map<string, string>()
  for (const doc of overridesSnap.docs) {
    overrides.set(doc.id, (doc.data() as any).categoriaId)
  }
  if (overrides.size > 0) {
    for (const cat of mapa.values()) {
      cat.rubros = cat.rubros.filter((r) => {
        const destino = overrides.get(r.id)
        if (!destino || destino === cat.id || !mapa.has(destino)) return true
        mapa.get(destino)!.rubros.push(r)
        return false
      })
    }
  }

  // Rubros personalizados (agregados por admin o por usuarios vía "Otro").
  for (const doc of rubrosSnap.docs) {
    const data = doc.data() as any
    const yaExiste = [...mapa.values()].some((c) => c.rubros.some((r) => r.id === doc.id))
    if (yaExiste) continue
    const categoriaId = overrides.get(doc.id) || data.categoriaId || CATEGORIA_FALLBACK_ID
    const destino = mapa.has(categoriaId) ? categoriaId : CATEGORIA_FALLBACK_ID
    mapa.get(destino)!.rubros.push({ id: doc.id, label: data.label || doc.id })
  }

  const ordenBase = CATEGORIAS_BASE.map((c) => c.id)
  const categorias = [...mapa.values()]
    .map((c) => ({
      ...c,
      rubros: [...c.rubros].sort((a, b) => (a.id === 'otro' ? 1 : b.id === 'otro' ? -1 : a.label.localeCompare(b.label, 'es'))),
    }))
    .sort((a, b) => {
      const oa = ordenBase.indexOf(a.id)
      const ob = ordenBase.indexOf(b.id)
      if (a.id === CATEGORIA_FALLBACK_ID) return 1
      if (b.id === CATEGORIA_FALLBACK_ID) return -1
      if (oa === -1 && ob === -1) return a.label.localeCompare(b.label, 'es')
      if (oa === -1) return 1
      if (ob === -1) return -1
      return oa - ob
    })

  const rubrosFlat = categorias.flatMap((c) =>
    c.rubros.map((r) => ({ id: r.id, label: r.label, categoriaId: c.id, categoriaLabel: c.label }))
  )

  return { categorias, rubrosFlat }
}

// GET: público — el árbol completo de categorías y rubros, ya
// combinado. Es lo que consume el selector de /servicios,
// /publicar-servicio y /admin.
export async function GET() {
  try {
    const arbol = await construirArbolCategorias()
    return NextResponse.json(arbol)
  } catch (err) {
    console.error('GET /api/categorias', err)
    return NextResponse.json({ categorias: CATEGORIAS_BASE, rubrosFlat: [] })
  }
}

// POST: solo admin — agregar una categoría nueva, agregar un rubro
// nuevo dentro de una categoría, mover un rubro existente a otra
// categoría, o renombrar una categoría. Se manda todo por acá (en vez
// de un endpoint por acción) porque son operaciones chicas de
// mantenimiento de la taxonomía, todas detrás del mismo candado de
// contraseña de admin.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const db = getDb()

    if (body.accion === 'crear_categoria') {
      const label = (body.label || '').trim()
      if (!label) return NextResponse.json({ error: 'Escribí el nombre de la categoría.' }, { status: 400 })
      const slug = slugify(label)
      if (!slug) return NextResponse.json({ error: 'Ese nombre no es válido.' }, { status: 400 })
      await db.collection('categorias_personalizadas').doc(slug).set(
        { label, createdAt: new Date().toISOString() },
        { merge: true }
      )
      return NextResponse.json({ id: slug })
    }

    if (body.accion === 'crear_rubro') {
      const label = (body.label || '').trim()
      const categoriaId = (body.categoriaId || '').trim()
      if (!label || !categoriaId) {
        return NextResponse.json({ error: 'Faltan datos (nombre del rubro y categoría).' }, { status: 400 })
      }
      const slug = slugify(label)
      if (!slug) return NextResponse.json({ error: 'Ese nombre no es válido.' }, { status: 400 })
      await db.collection('rubros_personalizados').doc(slug).set(
        { label, categoriaId, createdAt: new Date().toISOString() },
        { merge: true }
      )
      return NextResponse.json({ id: slug })
    }

    if (body.accion === 'mover_rubro') {
      const rubroId = (body.rubroId || '').trim()
      const categoriaId = (body.categoriaId || '').trim()
      if (!rubroId || !categoriaId) {
        return NextResponse.json({ error: 'Faltan datos (rubro y categoría destino).' }, { status: 400 })
      }
      // Si es un rubro personalizado (tiene documento propio), le
      // actualizamos la categoría directo. Si es un rubro de la base
      // fija del código, no tiene documento — se guarda la reubicación
      // aparte, como excepción.
      const refPersonalizado = db.collection('rubros_personalizados').doc(rubroId)
      const docPersonalizado = await refPersonalizado.get()
      if (docPersonalizado.exists) {
        await refPersonalizado.set({ categoriaId }, { merge: true })
      } else {
        await db.collection('rubro_categoria_overrides').doc(rubroId).set(
          { categoriaId },
          { merge: true }
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (body.accion === 'renombrar_categoria') {
      const categoriaId = (body.categoriaId || '').trim()
      const label = (body.label || '').trim()
      if (!categoriaId || !label) {
        return NextResponse.json({ error: 'Faltan datos (categoría y nombre nuevo).' }, { status: 400 })
      }
      // Funciona tanto para una categoría de la base fija del código
      // (guarda el nombre nuevo con la misma id, y el armado del árbol
      // lo usa para pisar el label original) como para una categoría
      // que ya era personalizada.
      await db.collection('categorias_personalizadas').doc(categoriaId).set(
        { label },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/categorias', err)
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 })
  }
}
