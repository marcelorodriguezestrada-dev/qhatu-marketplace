import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Lo consulta /login justo después de iniciar sesión (no solo al
// registrarse) — cubre el caso de alguien que se registró y cerró la
// app antes de terminar de verificar el código.
//
// Ojo: las cuentas que ya existían ANTES de este sistema no tienen
// documento en `usuarios/`, así que las tratamos como verificadas por
// default — si no, de un día para el otro le pedimos código a gente
// que ya venía usando la cuenta normalmente sin haber tenido nunca la
// chance de verificar nada.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const doc = await db.collection('usuarios').doc(usuario.uid).get()
    const emailVerificado = !doc.exists || doc.data()?.emailVerificado !== false
    return NextResponse.json({ emailVerificado })
  } catch (err) {
    console.error('GET /api/usuarios/estado', err)
    // Si falla la consulta, dejamos pasar — mejor no bloquear a nadie
    // por un error nuestro de lectura.
    return NextResponse.json({ emailVerificado: true })
  }
}
