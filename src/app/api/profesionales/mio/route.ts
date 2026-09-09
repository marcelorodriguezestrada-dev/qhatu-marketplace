import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — el perfil de servicio del usuario logueado, si publicó alguno.
// A diferencia de GET /api/profesionales/[id] (público), este busca por
// solicitanteUid en vez de por id, porque desde /mi-perfil el usuario no
// tiene por qué saber el id de su propio documento.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const snap = await db
      .collection('profesionales')
      .where('solicitanteUid', '==', usuario.uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (snap.empty) {
      return NextResponse.json({ profesional: null })
    }

    const doc = snap.docs[0]
    return NextResponse.json({ profesional: { id: doc.id, ...doc.data() } })
  } catch (err: any) {
    console.error('GET /api/profesionales/mio', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
