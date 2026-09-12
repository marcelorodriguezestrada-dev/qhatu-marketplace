import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'

export const dynamic = 'force-dynamic'

// Se llama justo después de crear la cuenta (ver /login) para guardar
// el celular — hoy es un dato obligatorio del registro, además del
// email. Ojo: esto valida el FORMATO del número (8 dígitos, empieza
// con 6 o 7), no que el número exista de verdad — confirmar eso
// requeriría un servicio pago tipo Twilio/WhatsApp Business API, que
// no está configurado en este proyecto.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const { celular } = await req.json()
    const chequeo = validarWhatsappBoliviano(celular || '')
    if (!chequeo.valido) {
      return NextResponse.json({ error: chequeo.motivo }, { status: 400 })
    }

    const db = getDb()
    await db.collection('usuarios').doc(usuario.uid).set(
      {
        celular: (celular || '').replace(/\D/g, ''),
        email: usuario.email,
        emailVerificado: false,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/usuarios/registrar', err)
    return NextResponse.json({ error: 'No se pudo guardar el celular.' }, { status: 500 })
  }
}
