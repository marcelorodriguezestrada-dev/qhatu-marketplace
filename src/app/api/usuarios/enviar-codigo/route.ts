import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { enviarCodigoVerificacion } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Genera un código de 6 dígitos, lo guarda con vencimiento a 15 minutos
// y lo manda por mail. Lo llama /login justo después de registrarse, y
// también el botón "Reenviar código" si el usuario lo perdió o venció.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  if (!usuario.email) return NextResponse.json({ error: 'Tu cuenta no tiene un email asociado.' }, { status: 400 })

  try {
    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    const expiraEn = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const db = getDb()
    await db.collection('usuarios').doc(usuario.uid).set(
      { codigoVerificacion: codigo, codigoExpiraEn: expiraEn },
      { merge: true }
    )

    const resultado = await enviarCodigoVerificacion(usuario.email, codigo)

    if (!resultado) {
      // No hay RESEND_API_KEY configurada — el código quedó guardado
      // igual, pero avisamos para no dejar a la persona esperando un
      // mail que nunca va a llegar.
      return NextResponse.json({ ok: true, enviado: false })
    }

    // Ojo: el SDK de Resend NO tira una excepción cuando el envío
    // falla del lado de ellos (por ejemplo, la cuenta todavía en modo
    // de prueba solo puede mandar al mail con el que te registraste en
    // Resend) — devuelve { data: null, error: {...} } normalmente. Si
    // no revisamos "error" acá, un envío que en realidad falló se lee
    // como si hubiese salido bien.
    if (resultado.error) {
      console.error('Resend rechazó el envío del código:', resultado.error)
      return NextResponse.json({ ok: true, enviado: false, motivo: resultado.error.message || null })
    }

    return NextResponse.json({ ok: true, enviado: true })
  } catch (err) {
    console.error('POST /api/usuarios/enviar-codigo', err)
    return NextResponse.json({ error: 'No se pudo enviar el código.' }, { status: 500 })
  }
}
