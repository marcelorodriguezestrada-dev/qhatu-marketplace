import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { RECUPERACION_DEFECTO, sanearConfigRecuperacion, type ConfigRecuperacion } from '@/lib/recuperacion'
import { diaBoliviaISO } from '@/lib/trackingConfig'

let cache: { valor: ConfigRecuperacion; hasta: number } | null = null

export async function leerConfigRecuperacion(forzar = false): Promise<ConfigRecuperacion> {
  if (!forzar && cache && cache.hasta > Date.now()) return cache.valor
  const doc = await getDb().collection('configuracion').doc('recuperacion').get()
  const valor = doc.exists ? sanearConfigRecuperacion(doc.data()) : RECUPERACION_DEFECTO
  cache = { valor, hasta: Date.now() + 60_000 }
  return valor
}

export function invalidarCacheRecuperacion() {
  cache = null
}

function horaBolivia(ahora = Date.now()) {
  return new Date(ahora - 4 * 3600_000).getUTCHours()
}

export async function sumarMetricaRecuperacion(campo: 'enviados' | 'abiertos' | 'compras', n = 1) {
  await getDb().collection('recuperacion_diaria').doc(diaBoliviaISO()).set({ [campo]: FieldValue.increment(n) }, { merge: true }).catch(() => {})
}

export type ResultadoRecuperacion = { revisados: number; enviados: number; yaCompraron: number; sinStock: number; porTope: number }

// Busca intereses viejos (más de esperaHoras) sin avisar, descarta los
// que ya compraron / sin stock / superaron el tope semanal, y manda UN
// aviso por persona (el mejor: carrito antes que visto, el más reciente).
export async function ejecutarRecuperacion(config: ConfigRecuperacion): Promise<ResultadoRecuperacion> {
  const db = getDb()
  const ahora = Date.now()
  const hasta = new Date(ahora - config.esperaHoras * 3600_000).toISOString()
  const desde = new Date(ahora - (config.esperaHoras + 72) * 3600_000).toISOString() // no más viejo que 3 días extra
  const snap = await db.collection('intereses').where('ultimaVez', '<=', hasta).where('ultimaVez', '>=', desde).limit(300).get()
  const res: ResultadoRecuperacion = { revisados: snap.size, enviados: 0, yaCompraron: 0, sinStock: 0, porTope: 0 }

  // Candidatos por usuario (sin avisar todavía y con señal suficiente).
  const porUsuario = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>()
  for (const d of snap.docs) {
    const i = d.data()
    if (i.avisadoEn || i.descartado) continue
    if (i.tipo === 'visto' && (!config.incluirVistos || (i.vistas || 0) < 2)) continue
    const lista = porUsuario.get(i.uid) || []
    lista.push(d)
    porUsuario.set(i.uid, lista)
  }

  const semanaAtras = new Date(ahora - 7 * 86400_000).toISOString()
  for (const [uid, lista] of Array.from(porUsuario.entries())) {
    // Tope semanal por persona.
    const control = await db.collection('recuperacion_usuarios').doc(uid).get()
    const recientes: string[] = (control.data()?.avisos || []).filter((f: string) => f >= semanaAtras)
    if (recientes.length >= config.maxPorSemana) { res.porTope++; continue }

    // ¿Compró algo de esto después? (1 consulta por persona)
    const email = lista[0].data().email
    const compras = email ? await db.collection('pedidos').where('comprador', '==', email).get() : null
    const comprado = new Set<string>()
    compras?.docs.forEach((p) => {
      const pd = p.data()
      if (pd.estado === 'cancelado') return
      for (const it of pd.items || []) comprado.add(`${it?.id}|${pd.createdAt || ''}`)
    })
    const yaLoCompro = (i: any) => Array.from(comprado).some((k) => k.startsWith(`${i.productoId}|`) && k.split('|')[1] >= (i.primeraVez || ''))

    const ordenados = lista
      .map((d) => ({ ref: d.ref, i: d.data() }))
      .sort((a, b) => (a.i.tipo === b.i.tipo ? (b.i.ultimaVez || '').localeCompare(a.i.ultimaVez || '') : a.i.tipo === 'carrito' ? -1 : 1))

    let enviado = false
    for (const { ref, i } of ordenados) {
      if (yaLoCompro(i)) { res.yaCompraron++; await ref.update({ descartado: 'compro' }); continue }
      const prod = await db.collection('productos').doc(i.productoId).get()
      const p = prod.data()
      if (!prod.exists || (p?.estado && p.estado !== 'activo')) { await ref.update({ descartado: 'no_disponible' }); continue }
      if (typeof p?.stock === 'number' && p.stock <= 0) { res.sinStock++; await ref.update({ descartado: 'sin_stock' }); continue }
      if (enviado) continue // un aviso por persona por vez; el resto queda para otro día

      const nombre = String(p?.nombre || i.nombre || 'el producto')
      const precio = p?.precio ? ` (Bs ${Number(p.precio).toLocaleString('es-BO')})` : ''
      const mensaje =
        i.tipo === 'carrito'
          ? `🛒 Dejaste "${nombre}"${precio} en tu carrito. ¡Todavía está disponible! Tocá acá para terminar tu compra.`
          : `👀 Estabas mirando "${nombre}"${precio}. Podés continuar tu compra cuando quieras.`
      const ahoraIso = new Date().toISOString()
      await db.collection('notificaciones').add({ uid, tipo: 'recuperacion', productoId: i.productoId, mensaje, link: `/producto/${i.productoId}`, leida: false, createdAt: ahoraIso })
      await ref.update({ avisadoEn: ahoraIso })
      await db.collection('recuperacion_usuarios').doc(uid).set({ avisos: [...recientes, ahoraIso].slice(-10) }, { merge: true })
      res.enviados++
      enviado = true
    }
  }
  if (res.enviados) await sumarMetricaRecuperacion('enviados', res.enviados)
  return res
}

// Disparo automático: lo llama cada visita al sitio (ver
// /api/analitica/visita). Solo corre una vez por día y solo dentro de la
// hora de envío; el "candado" es un documento con el último día corrido.
let ultimoDiaCorrido = ''

export async function intentarRecuperacionAutomatica(): Promise<void> {
  const dia = diaBoliviaISO()
  if (ultimoDiaCorrido === dia) return // ya se corrió hoy en esta instancia: ni lee la base
  const config = await leerConfigRecuperacion()
  if (!config.activo || horaBolivia() !== config.horaEnvio) return
  const db = getDb()
  const lock = db.collection('configuracion').doc('recuperacion_estado')
  const tomado = await db.runTransaction(async (tx) => {
    const d = await tx.get(lock)
    if (d.data()?.ultimoDia === dia) return false
    tx.set(lock, { ultimoDia: dia, iniciado: new Date().toISOString() }, { merge: true })
    return true
  })
  ultimoDiaCorrido = dia
  if (!tomado) return
  const res = await ejecutarRecuperacion(config)
  await lock.set({ ultimoResultado: { ...res, fecha: new Date().toISOString() } }, { merge: true })
}
