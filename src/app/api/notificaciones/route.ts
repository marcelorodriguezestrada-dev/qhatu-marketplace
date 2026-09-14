import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — las notificaciones del usuario logueado, más recientes primero.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const snap = await db.collection('notificaciones').where('uid', '==', usuario.uid).get()
    const notificaciones = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ notificaciones })
  } catch (err) {
    console.error('GET /api/notificaciones', err)
    return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
  }
}

// PATCH { todasLeidas: true } — marca todas las del usuario como leídas
// de una vez (para el botón "Marcar todas como leídas").
export async function PATCH(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const snap = await db.collection('notificaciones').where('uid', '==', usuario.uid).where('leida', '==', false).get()
    const batch = db.batch()
    snap.docs.forEach((d) => batch.update(d.ref, { leida: true }))
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/notificaciones', err)
    return NextResponse.json({ error: 'No se pudieron actualizar las notificaciones.' }, { status: 500 })
  }
}
