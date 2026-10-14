import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CANALES_CAMPANA, OBJETIVOS_CAMPANA, METRICAS_CAMPANA, codigoCampana } from '@/lib/campanas'
import { sanearCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const esAdmin = async (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return (await esClaveAdmin(p))
}

// GET (admin): campañas con sus números y las visitas de los últimos 14 días.
export async function GET(req: NextRequest) {
  if (!(await esAdmin(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const db = getDb()
    const snap = await db.collection('campanas').get()
    const desde = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
    // ?origen=tiendas → las publicaciones que compartieron las tiendas desde
    // Vender → Marketing (cada una es una campaña con su link rastreado).
    if (req.nextUrl.searchParams.get('origen') === 'tiendas') {
      const publicaciones = snap.docs
        .filter((d) => d.data()?.origen === 'vendedor' && d.data()?.estado === 'publicada')
        .map((d) => {
          const x = d.data() as any
          const base: Record<string, any> = { id: d.id, vendedorId: x.vendedorId, tiendaNombre: x.tiendaNombre || '', red: x.canal, ciudad: x.ciudad || 'potosi', productos: x.productos || [], publicadaAt: x.publicadaAt || x.createdAt, vecesCompartida: x.vecesCompartida || 0 }
          for (const m of METRICAS_CAMPANA) base[m] = x[m] || 0
          return base
        })
        .sort((a, b) => String(b.publicadaAt).localeCompare(String(a.publicadaAt)))
      return NextResponse.json({ publicaciones })
    }
    // Las de cada publicación del plan de lanzamiento se ven en su propia
    // pestaña, y las de las tiendas en "Publicaciones de las tiendas".
    const campanas = await Promise.all(
      snap.docs.filter((d) => !d.data()?.lanzamiento && d.data()?.origen !== 'vendedor').map(async (d) => {
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
  if (!(await esAdmin(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
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
