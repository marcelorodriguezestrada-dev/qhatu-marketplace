import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearConfigRecuperacion } from '@/lib/recuperacion'
import { diaBoliviaISO } from '@/lib/trackingConfig'
import { leerConfigRecuperacion, invalidarCacheRecuperacion, ejecutarRecuperacion } from '@/lib/recuperacionServer'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

// GET — configuración, métricas de los últimos 14 días (enviados /
// abiertos / compras), último envío y hora pico sugerida (de la analítica).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const db = getDb()
    const dias = Array.from({ length: 14 }, (_, i) => diaBoliviaISO(Date.now() - i * 86400_000))
    const [config, estado, metricas, eventos] = await Promise.all([
      leerConfigRecuperacion(true),
      db.collection('configuracion').doc('recuperacion_estado').get(),
      db.getAll(...dias.map((d) => db.collection('recuperacion_diaria').doc(d))),
      db.getAll(...dias.map((d) => db.collection('eventos_diarios').doc(d))),
    ])
    const porHora = Array(24).fill(0)
    for (const e of eventos) for (const [h, v] of Object.entries((e.data()?.porHora || {}) as Record<string, number>)) porHora[Number(h)] += v
    const max = Math.max(...porHora)
    const horaPico = max > 0 ? porHora.indexOf(max) : null
    return NextResponse.json({
      config,
      estado: estado.data() || null,
      metricas: metricas.filter((m) => m.exists).map((m) => ({ dia: m.id, ...m.data() })),
      horaPico,
    })
  } catch (err) {
    console.error('GET /api/admin/recuperacion', err)
    return NextResponse.json({ error: 'No se pudo cargar.' }, { status: 500 })
  }
}

// POST { accion: 'guardar', config } | { accion: 'enviar' } (enviar ahora,
// sin esperar la hora; respeta igual la espera y el tope por persona).
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const body = await req.json()
    const db = getDb()
    if (body.accion === 'enviar') {
      const config = await leerConfigRecuperacion(true)
      const res = await ejecutarRecuperacion(config)
      await db.collection('configuracion').doc('recuperacion_estado').set({ ultimoResultado: { ...res, fecha: new Date().toISOString(), manual: true } }, { merge: true })
      return NextResponse.json({ ok: true, resultado: res })
    }
    const config = sanearConfigRecuperacion(body.config)
    await db.collection('configuracion').doc('recuperacion').set({ ...config, actualizado: new Date().toISOString() })
    invalidarCacheRecuperacion()
    return NextResponse.json({ ok: true, config })
  } catch (err) {
    console.error('POST /api/admin/recuperacion', err)
    return NextResponse.json({ error: 'No se pudo completar la acción.' }, { status: 500 })
  }
}
