import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { validarWhatsappBoliviano, numeroLocalABolivia } from '@/lib/validarWhatsapp'

export const dynamic = 'force-dynamic'

// GET: público sin filtrar solo los aprobados (para /servicios). Si se
// manda la contraseña de admin, devuelve TODOS sin filtrar — así el
// panel /admin puede ver también las solicitudes pendientes y
// rechazadas, no solo lo que ya está publicado.
export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const snap = await db.collection('profesionales').get()
    let profesionales = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[]

    const password = req.headers.get('x-admin-password')
    const esAdmin = !!password && password === process.env.ADMIN_PASSWORD

    if (!esAdmin) {
      profesionales = profesionales.filter((p) => !p.estado || p.estado === 'aprobado')
    }

    return NextResponse.json({ profesionales })
  } catch (err) {
    console.error('GET /api/profesionales', err)
    return NextResponse.json({ profesionales: [] })
  }
}

// POST: alta directa de un profesional desde /admin — queda aprobado
// de inmediato, porque quien lo carga sos vos mismo. Para que un
// profesional se autopostule y quede pendiente de tu revisión, existe
// el endpoint separado /api/profesionales/solicitud.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { nombre, rubro, descripcion, zona, lat, lng, whatsapp, instagram, icono, plan, imagenUrl, precio, experiencia } = body
    if (!nombre || !rubro || !whatsapp) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (nombre, rubro, whatsapp).' }, { status: 400 })
    }

    const validacionWhatsapp = validarWhatsappBoliviano(whatsapp)
    if (!validacionWhatsapp.valido) {
      return NextResponse.json({ error: validacionWhatsapp.motivo }, { status: 400 })
    }
    const whatsappCompleto = numeroLocalABolivia(whatsapp)

    const db = getDb()
    const ref = await db.collection('profesionales').add({
      nombre,
      rubro,
      descripcion: descripcion || '',
      zona: zona || '',
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      whatsapp: whatsappCompleto,
      instagram: instagram || '',
      icono: icono || rubro || 'otro',
      imagenUrl: imagenUrl || '',
      precio: precio ? Number(precio) : null, // null = "Precio a convenir"
      experiencia: experiencia || '',
      plan: plan === 'premium' ? 'premium' : 'basico',
      estado: 'aprobado',
      ratingPromedio: 0,
      cantidadResenas: 0,
      vistas: 0,
      clicsWhatsapp: 0,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/profesionales', err)
    return NextResponse.json({ error: 'No se pudo crear el profesional.' }, { status: 500 })
  }
}
