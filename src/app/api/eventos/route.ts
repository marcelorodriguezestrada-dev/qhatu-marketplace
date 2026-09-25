import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { EVENTOS, diaBoliviaISO } from '@/lib/trackingConfig'
import { estadoTracking, sumarTotalEnCache } from '@/lib/trackingServer'

export const dynamic = 'force-dynamic'

const IDS = new Set<string>(EVENTOS.map((e) => e.id))

// Clave segura para un campo de Firestore (sin puntos ni caracteres raros).
function clave(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40)
}

// GET — el sitio pregunta una vez por sesión si tiene que registrar
// eventos y cuáles. No escribe nada.
export async function GET() {
  try {
    const e = await estadoTracking()
    return NextResponse.json(
      { activo: e.activo, eventos: e.activo ? e.config.eventos : [] },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    )
  } catch {
    return NextResponse.json({ activo: false, eventos: [] })
  }
}

// POST { eventos: [{ n: nombre, p: {parámetros}, t: timestamp }], sid, aid }
// Una tanda de hasta 50 eventos → 1 escritura (el resumen del día), o 2
// si está prendido "guardar detalle".
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const lista = Array.isArray(body?.eventos) ? body.eventos.slice(0, 50) : []
    if (lista.length === 0) return NextResponse.json({ ok: true, guardados: 0 })

    const estado = await estadoTracking()
    if (!estado.activo) return NextResponse.json({ ok: false, pausado: true, motivo: estado.motivo })

    const permitidos = new Set<string>(estado.config.eventos)
    const cupo = Math.max(0, estado.config.limiteDiario - estado.totalHoy)
    const eventos = lista
      .filter((e: any) => typeof e?.n === 'string' && IDS.has(e.n) && permitidos.has(e.n))
      .slice(0, cupo)
    if (eventos.length === 0) return NextResponse.json({ ok: true, guardados: 0 })

    const ahora = Date.now()
    const dia = diaBoliviaISO(ahora)
    const inc = (n = 1) => FieldValue.increment(n)
    const porEvento: Record<string, any> = {}
    const porHora: Record<string, any> = {}
    const porEventoHora: Record<string, any> = {}
    const porCampana: Record<string, Record<string, any>> = {}
    const porCategoria: Record<string, Record<string, any>> = {}
    const conteo = (obj: Record<string, number>, k: string) => { obj[k] = (obj[k] || 0) + 1 }
    const cEvento: Record<string, number> = {}, cHora: Record<string, number> = {}, cEH: Record<string, number> = {}
    const cCamp: Record<string, Record<string, number>> = {}, cCat: Record<string, Record<string, number>> = {}

    for (const e of eventos) {
      const t = typeof e.t === 'number' && Math.abs(e.t - ahora) < 6 * 3600_000 ? e.t : ahora
      const hora = new Date(t - 4 * 3600_000).toISOString().slice(11, 13)
      conteo(cEvento, e.n)
      conteo(cHora, hora)
      conteo(cEH, `${e.n}__${hora}`)
      const cupon = e.p?.cupon ? clave(String(e.p.cupon).toUpperCase()) : ''
      if (cupon) conteo((cCamp[cupon] ||= {}), e.n)
      const cat = e.p?.categoria ? clave(e.p.categoria) : ''
      if (cat) conteo((cCat[cat] ||= {}), e.n)
    }
    for (const [k, v] of Object.entries(cEvento)) porEvento[k] = inc(v)
    for (const [k, v] of Object.entries(cHora)) porHora[k] = inc(v)
    for (const [k, v] of Object.entries(cEH)) porEventoHora[k] = inc(v)
    for (const [c, ev] of Object.entries(cCamp)) porCampana[c] = Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, inc(v)]))
    for (const [c, ev] of Object.entries(cCat)) porCategoria[c] = Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, inc(v)]))

    const db = getDb()
    const escrituras = estado.config.guardarDetalle ? 2 : 1
    // Lecturas que hizo esta tanda: el total del día (la config y los
    // cupones salen de la caché casi siempre).
    await db.collection('eventos_diarios').doc(dia).set(
      {
        dia,
        total: inc(eventos.length),
        lotes: inc(1),
        escrituras: inc(escrituras),
        lecturas: inc(1),
        porEvento,
        porHora,
        porEventoHora,
        porCampana,
        porCategoria,
        actualizado: new Date(ahora).toISOString(),
      },
      { merge: true }
    )
    if (estado.config.guardarDetalle) {
      await db.collection('eventos_detalle').add({
        dia,
        sid: clave(body?.sid),
        aid: clave(body?.aid),
        eventos: eventos.map((e: any) => ({
          n: e.n,
          t: typeof e.t === 'number' ? e.t : ahora,
          p: Object.fromEntries(Object.entries(e.p || {}).slice(0, 10).map(([k, v]) => [clave(k), typeof v === 'number' ? v : String(v).slice(0, 80)])),
        })),
        createdAt: new Date(ahora).toISOString(),
      })
    }
    sumarTotalEnCache(eventos.length)
    return NextResponse.json({ ok: true, guardados: eventos.length })
  } catch (err) {
    console.error('POST /api/eventos', err)
    return NextResponse.json({ ok: false })
  }
}
