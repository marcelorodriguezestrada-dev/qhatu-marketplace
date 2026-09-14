import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { evaluarConIA } from '@/lib/moderacionIA'
import { validarWhatsappPorPais, numeroConCodigoPais } from '@/lib/validarWhatsapp'
import { buscarPais, PAIS_FALLBACK_ID } from '@/data/paises'

export const dynamic = 'force-dynamic'

// GET — público: solo anuncios aprobados, los más nuevos primero.
// Con header x-admin-password válido, devuelve TODOS (para el panel
// de moderación en /admin).
export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const esAdmin = req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
    const snap = await db.collection('anuncios').get()
    let anuncios = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    if (!esAdmin) anuncios = anuncios.filter((a) => a.estado === 'aprobado')
    anuncios.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ anuncios })
  } catch (err) {
    console.error('GET /api/anuncios', err)
    return NextResponse.json({ error: 'No se pudieron cargar los anuncios.' }, { status: 500 })
  }
}

// POST — necesita estar logueado (así el anuncio queda atado a una
// cuenta real, y el admin sabe a quién pausar/eliminar si hace falta).
// Siempre entra como pendiente_revision, nunca se publica directo.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión para publicar un anuncio.' }, { status: 401 })

  try {
    const body = await req.json()
    const { titulo, descripcion, tipo, whatsapp, whatsappPais, precio, imagenUrl, rubro } = body

    if (!titulo || !descripcion || !whatsapp) {
      return NextResponse.json({ error: 'Faltan datos (título, descripción y WhatsApp son obligatorios).' }, { status: 400 })
    }

    const paisId = whatsappPais || PAIS_FALLBACK_ID
    const validacionWhatsapp = validarWhatsappPorPais(whatsapp, paisId)
    if (!validacionWhatsapp.valido) {
      return NextResponse.json({ error: validacionWhatsapp.motivo }, { status: 400 })
    }
    const whatsappCompleto = numeroConCodigoPais(whatsapp, buscarPais(paisId).codigo)

    const moderacionIA = await evaluarConIA(`Anuncio clasificado.\nTítulo: ${titulo}\nDescripción: ${descripcion}`)

    const db = getDb()
    const ref = await db.collection('anuncios').add({
      titulo,
      descripcion,
      tipo: tipo || 'otro',
      // Solo tiene sentido en anuncios "busqueda" — es lo que permite
      // el macheo automático 1 a 1 con profesionales de ese mismo
      // rubro exacto. En cualquier otro tipo de anuncio queda null.
      rubro: tipo === 'busqueda' && rubro ? rubro : null,
      whatsapp: whatsappCompleto,
      whatsappPais: paisId,
      precio: precio ? Number(precio) : null,
      imagenUrl: imagenUrl || '',
      autorUid: usuario.uid,
      autorEmail: usuario.email,
      estado: 'pendiente_revision',
      moderacionIA,
      vistas: 0,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ id: ref.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/anuncios', err)
    return NextResponse.json({ error: 'No se pudo publicar el anuncio.' }, { status: 500 })
  }
}
