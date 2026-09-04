import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET: directorio completo, público. Cualquiera lo navega sin login.
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('profesionales').get()
    const profesionales = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ profesionales })
  } catch (err) {
    console.error('GET /api/profesionales', err)
    return NextResponse.json({ profesionales: [] })
  }
}

// POST: alta de un profesional nuevo. A diferencia de los productos
// (que cualquier usuario logueado puede publicar), acá según el
// planteo del negocio "el profesional debe contactar a la plataforma
// para que su anuncio sea subido" — o sea, la carga es administrativa,
// protegida con la misma ADMIN_PASSWORD que usás en /admin.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { nombre, rubro, descripcion, zona, lat, lng, whatsapp, icono, plan, imagenUrl, precio, experiencia } = body
    if (!nombre || !rubro || !whatsapp) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (nombre, rubro, whatsapp).' }, { status: 400 })
    }
    const db = getDb()
    const ref = await db.collection('profesionales').add({
      nombre,
      rubro,
      descripcion: descripcion || '',
      zona: zona || '',
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      whatsapp,
      icono: icono || 'otro',
      imagenUrl: imagenUrl || '',
      precio: precio ? Number(precio) : null, // null = "Precio a convenir"
      experiencia: experiencia || '',
      plan: plan === 'premium' ? 'premium' : 'basico',
      ratingPromedio: 0,
      cantidadResenas: 0,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/profesionales', err)
    return NextResponse.json({ error: 'No se pudo crear el profesional.' }, { status: 500 })
  }
}
