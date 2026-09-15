import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — todos los anuncios que publicó el usuario logueado (con
// cualquier estado, no solo los aprobados — así puede ver si sigue en
// revisión o si se lo rechazaron). Hermano de /api/profesionales/mio,
// mismo motivo: desde /mis-anuncios el usuario no tiene por qué saber
// el id de cada anuncio suyo.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const snap = await db
      .collection('anuncios')
      .where('autorUid', '==', usuario.uid)
      .orderBy('createdAt', 'desc')
      .get()

    const anuncios = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ anuncios })
  } catch (err: any) {
    console.error('GET /api/anuncios/mios', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
