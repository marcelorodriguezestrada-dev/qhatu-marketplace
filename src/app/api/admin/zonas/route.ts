import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { leerZonasExtra } from '@/lib/zonasEnvioServer'
import { armarZonas, buscarZonaEn, zonaMasCercana } from '@/lib/zonasEnvio'

export const dynamic = 'force-dynamic'

// Admin → Zonas de envío.
// GET → { extras, sugeridas: [{ id, nombre, pedidos, lat, lng, cercana, ultimoPedido }] }
// POST { accion: 'agregar', id?, nombre, lat, lng } → la suma a la lista (y borra la sugerida)
//      { accion: 'descartar', id } · { accion: 'quitar', nombre } (saca una agregada)
const autorizado = (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const extras = await leerZonasExtra()
    const zonas = armarZonas(extras)
    const snap = await getDb().collection('zonasSugeridas').get()
    const sugeridas = snap.docs
      .map((d) => {
        const x = d.data()
        const n = Math.max(1, Number(x.pedidos) || 1)
        const lat = Number(x.sumaLat) / n
        const lng = Number(x.sumaLng) / n
        return { id: d.id, nombre: x.nombre as string, pedidos: n, lat, lng, cercana: zonaMasCercana(zonas, lat, lng).nombre, ultimoPedido: x.ultimoPedido || null }
      })
      .filter((s) => !buscarZonaEn(zonas, s.nombre))
      .sort((a, b) => b.pedidos - a.pedidos)
    return NextResponse.json({ extras, sugeridas })
  } catch (err) {
    console.error('GET /api/admin/zonas', err)
    return NextResponse.json({ error: 'No se pudieron cargar las zonas.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const db = getDb()
    const ref = db.collection('config').doc('zonasEnvio')
    if (body.accion === 'agregar') {
      const nombre = String(body.nombre || '').trim().slice(0, 60)
      const lat = Number(body.lat), lng = Number(body.lng)
      if (nombre.length < 3 || !Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'Faltan el nombre o la ubicación de la zona.' }, { status: 400 })
      const extras = await leerZonasExtra()
      if (buscarZonaEn(armarZonas(extras), nombre)) return NextResponse.json({ error: 'Esa zona ya está en la lista.' }, { status: 409 })
      await ref.set({ extras: [...extras, { nombre, lat, lng }], updatedAt: new Date().toISOString() }, { merge: true })
      if (body.id) await db.collection('zonasSugeridas').doc(String(body.id)).delete().catch(() => {})
      return NextResponse.json({ ok: true })
    }
    if (body.accion === 'descartar' && body.id) {
      await db.collection('zonasSugeridas').doc(String(body.id)).delete()
      return NextResponse.json({ ok: true })
    }
    if (body.accion === 'quitar' && body.nombre) {
      const extras = await leerZonasExtra()
      await ref.set({ extras: extras.filter((z) => z.nombre !== body.nombre), updatedAt: new Date().toISOString() }, { merge: true })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/zonas', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
