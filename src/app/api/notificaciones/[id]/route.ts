import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// PATCH { leida: true } — solo el dueño de la notificación puede
// marcarla como leída.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const ref = db.collection('notificaciones').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ error: 'No encontrada.' }, { status: 404 })
    if (doc.data()?.uid !== usuario.uid) {
      return NextResponse.json({ error: 'Esta notificación no te pertenece.' }, { status: 403 })
    }
    await ref.update({ leida: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/notificaciones/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
  }
}
