import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { METRICAS_CAMPANA } from '@/lib/campanas'
import { diaBolivia } from '@/lib/fechaBolivia'
import { leerConfigLanzamiento, recomendacionesIA } from '@/lib/lanzamientoServer'
import { armarReporte, recomendacionesBasicas } from '@/lib/reporteMarketing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

// GET (admin) ?dias=30: el reporte del plan de lanzamiento, armado con los
// números por día de los links de cada publicación.
// POST (admin) { reporte }: recomendaciones de la IA sobre ese reporte.
async function datos(dias: number) {
  const db = getDb()
  const [config, snap] = await Promise.all([leerConfigLanzamiento(), db.collection('publicacionesMarketing').get()])
  const pubs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
  const desde = diaBolivia(new Date(Date.now() - (dias - 1) * 86400_000))
  const [medios, porPub] = await Promise.all([
    db.collection('mediosMarketing').select('publicacionId', 'tipo').get().catch(() => null),
    Promise.all(
      pubs.map(async (p) => {
        if (!p.campanaId) return { id: p.id, total: null, dias: [] as { dia: string; [k: string]: any }[] }
        const ref = db.collection('campanas').doc(p.campanaId)
        const [c, d] = await Promise.all([ref.get(), ref.collection('dias').get().catch(() => null)])
        const total = c.exists ? Object.fromEntries(METRICAS_CAMPANA.map((m) => [m, Number(c.data()?.[m] || 0)])) : null
        return { id: p.id, total, dias: (d?.docs || []).filter((x) => x.id >= desde).map((x) => ({ dia: x.id, ...Object.fromEntries(METRICAS_CAMPANA.map((m) => [m, Number(x.data()?.[m] || 0)])) })) }
      }),
    ),
  ])
  const conPieza = new Set((medios?.docs || []).map((d) => d.data()?.publicacionId).filter(Boolean))
  return armarReporte({ config, pubs, porPub, conPieza, desde, hasta: diaBolivia(), hoy: diaBolivia() })
}

export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const dias = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('dias')) || 30))
    return NextResponse.json({ reporte: await datos(dias) })
  } catch (err) {
    console.error('GET /api/admin/lanzamiento/reporte', err)
    return NextResponse.json({ error: 'No se pudo armar el reporte.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const reporte = await datos(30)
    const ia = await recomendacionesIA(reporte)
    return NextResponse.json(ia ? { ...ia, conIA: true } : { ...recomendacionesBasicas(reporte), conIA: false })
  } catch (err) {
    console.error('POST /api/admin/lanzamiento/reporte', err)
    return NextResponse.json({ error: 'No se pudieron armar las recomendaciones.' }, { status: 500 })
  }
}
