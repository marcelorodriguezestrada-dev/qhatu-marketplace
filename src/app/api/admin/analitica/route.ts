import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearConfigTracking, diaBoliviaISO } from '@/lib/trackingConfig'
import { estadoTracking, invalidarCacheTracking } from '@/lib/trackingServer'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

// GET ?dias=14 — configuración, estado actual y los resúmenes diarios
// (1 lectura por día pedido).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    invalidarCacheTracking()
    const dias = Math.max(1, Math.min(60, Number(req.nextUrl.searchParams.get('dias')) || 14))
    const ids = Array.from({ length: dias }, (_, i) => diaBoliviaISO(Date.now() - i * 86400_000))
    const db = getDb()
    const [estado, docs] = await Promise.all([
      estadoTracking(),
      db.getAll(...ids.map((id) => db.collection('eventos_diarios').doc(id))),
    ])
    const resumenes = docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({
      config: estado.config,
      estado: { activo: estado.activo, motivo: estado.motivo },
      resumenes,
      proyectoFirebase: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    })
  } catch (err) {
    console.error('GET /api/admin/analitica', err)
    return NextResponse.json({ error: 'No se pudo cargar la analítica.' }, { status: 500 })
  }
}

// POST — guarda la configuración del registro de eventos.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const config = sanearConfigTracking(await req.json())
    await getDb().collection('configuracion').doc('tracking').set({ ...config, actualizado: new Date().toISOString() })
    invalidarCacheTracking()
    return NextResponse.json({ ok: true, config })
  } catch (err) {
    console.error('POST /api/admin/analitica', err)
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 500 })
  }
}
