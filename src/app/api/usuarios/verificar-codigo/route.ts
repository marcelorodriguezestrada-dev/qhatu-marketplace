import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest, getAuthAdmin } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const { codigo } = await req.json()
    if (!codigo) return NextResponse.json({ error: 'Falta el código.' }, { status: 400 })

    const db = getDb()
    const ref = db.collection('usuarios').doc(usuario.uid)
    const doc = await ref.get()
    const data = doc.data()

    if (!data?.codigoVerificacion) {
      return NextResponse.json({ error: 'No hay ningún código pendiente — pedí uno nuevo.' }, { status: 400 })
    }
    if (data.codigoExpiraEn && new Date(data.codigoExpiraEn) < new Date()) {
      return NextResponse.json({ error: 'Ese código venció — pedí uno nuevo.' }, { status: 400 })
    }
    if (String(codigo).trim() !== data.codigoVerificacion) {
      return NextResponse.json({ error: 'Código incorrecto.' }, { status: 400 })
    }

    await ref.set(
      { emailVerificado: true, codigoVerificacion: null, codigoExpiraEn: null },
      { merge: true }
    )
    // Mantenemos también el flag nativo de Firebase Auth sincronizado,
    // por si en algún momento se usa para algo del lado de Firebase
    // directamente (reglas de seguridad, por ejemplo).
    try {
      await getAuthAdmin().updateUser(usuario.uid, { emailVerified: true })
    } catch {
      // no es crítico — lo que realmente usa la app es el flag en Firestore
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/usuarios/verificar-codigo', err)
    return NextResponse.json({ error: 'No se pudo verificar el código.' }, { status: 500 })
  }
}
