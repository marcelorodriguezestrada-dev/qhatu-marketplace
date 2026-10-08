import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CANALES_CAMPANA, OBJETIVOS_CAMPANA, METRICAS_CAMPANA, codigoCampana } from '@/lib/campanas'
import { sanearCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'

export const dynamic = 'force-dynamic'

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

// GET (admin): campañas con sus números y las visitas de los últimos 14 días.
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const db = getDb()
    const snap = await db.collection('campanas').get()
    const desde = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
    const campanas = await Promise.all(
      snap.docs.map(async (d) => {
        const x = d.data() as any
        const dias = await d.ref.collection('dias').get().catch(() => null)
        const serie = (dias?.docs || []).filter((dd) => dd.id >= desde).map((dd) => ({ dia: dd.id, visitas: dd.data().visitas || 0 }))
        const base: Record<string, any> = { id: d.id, nombre: x.nombre, canal: x.canal, objetivo: x.objetivo, destino: x.destino, ciudad: x.ciudad || 'potosi', activa: x.activa !== false, createdAt: x.createdAt }
        for (const m of METRICAS_CAMPANA) base[m] = x[m] || 0
        base.serie = serie
        return base
      })
    )
    campanas.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return NextResponse.json({ campanas })
  } catch (err) {
    console.error('GET /api/admin/campanas', err)
    return NextResponse.json({ campanas: [] })
  }
}

// POST (admin) { nombre, canal, objetivo, destino?, ciudad }
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const nombre = String(body.nombre || '').trim().slice(0, 60)
    if (nombre.length < 3) return NextResponse.json({ error: 'Poné un nombre a la campaña (ej: Marketplace octubre).' }, { status: 400 })
    const canal = CANALES_CAMPANA.some((c) => c.id === body.canal) ? body.canal : 'otro'
    const obj = OBJETIVOS_CAMPANA.find((o) => o.id === body.objetivo) || OBJETIVOS_CAMPANA[0]
    const destino = typeof body.destino === 'string' && body.destino.startsWith('/') && !body.destino.startsWith('//') ? body.destino.slice(0, 120) : obj.destino
    const id = codigoCampana(nombre)
    await cargarCiudadesServidor() // ciudades agregadas desde el admin
    const doc = { nombre, canal, objetivo: obj.id, destino, ciudad: sanearCiudad(body.ciudad), activa: true, createdAt: new Date().toISOString() }
    await getDb().collection('campanas').doc(id).set(doc)
    return NextResponse.json({ id, ...doc })
  } catch (err) {
    console.error('POST /api/admin/campanas', err)
    return NextResponse.json({ error: 'No se pudo crear la campaña.' }, { status: 500 })
  }
}
