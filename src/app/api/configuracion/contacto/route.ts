import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — público: el WhatsApp de la plataforma en sí (no el de un
// vendedor o profesional puntual). Lo usa /ayuda para el botón de
// "Escribinos por WhatsApp" y cualquier otro lugar que necesite un
// contacto general de Clasi Click.
export async function GET() {
  try {
    const doc = await getDb().collection('configuracion').doc('contacto').get()
    if (!doc.exists) return NextResponse.json({ whatsapp: '' })
    return NextResponse.json({ whatsapp: doc.data()?.whatsapp || '' })
  } catch (err) {
    console.error('GET /api/configuracion/contacto', err)
    return NextResponse.json({ whatsapp: '' })
  }
}

// POST — solo admin: carga/actualiza ese número.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const whatsapp = String(body.whatsapp || '').replace(/\D/g, '')
    await getDb().collection('configuracion').doc('contacto').set(
      { whatsapp, actualizadoEn: new Date().toISOString() },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/configuracion/contacto', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
