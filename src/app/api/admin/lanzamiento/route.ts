import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { METRICAS_CAMPANA } from '@/lib/campanas'
import { sanearConfig } from '@/lib/lanzamiento'
import { leerConfigLanzamiento } from '@/lib/lanzamientoServer'

export const dynamic = 'force-dynamic'

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

// GET (admin): el plan y sus publicaciones, cada una con los números de
// su link rastreable (visitas, cuentas, tiendas, compras).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const db = getDb()
    const [config, snap] = await Promise.all([leerConfigLanzamiento(), db.collection('publicacionesMarketing').get()])
    const pubs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    const ids = pubs.map((p) => p.campanaId).filter(Boolean) as string[]
    const metricas = new Map<string, Record<string, number>>()
    for (let i = 0; i < ids.length; i += 100) {
      const docs = await db.getAll(...ids.slice(i, i + 100).map((id) => db.collection('campanas').doc(id)))
      docs.forEach((d) => { if (d.exists) metricas.set(d.id, Object.fromEntries(METRICAS_CAMPANA.map((m) => [m, Number(d.data()?.[m] || 0)]))) })
    }
    const publicaciones = pubs
      .map((p) => ({ ...p, metricas: metricas.get(p.campanaId) || null }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.createdAt).localeCompare(String(b.createdAt)))
    return NextResponse.json({ config, publicaciones })
  } catch (err) {
    console.error('GET /api/admin/lanzamiento', err)
    return NextResponse.json({ error: 'No se pudo leer el plan.' }, { status: 500 })
  }
}

// POST (admin) { config }: fecha, ciudad, metas, promos y redes.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const config = sanearConfig(body.config)
    await getDb().collection('config').doc('lanzamiento').set({ ...config, updatedAt: new Date().toISOString() })
    return NextResponse.json({ config })
  } catch (err) {
    console.error('POST /api/admin/lanzamiento', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
