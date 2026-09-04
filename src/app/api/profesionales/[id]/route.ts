import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET: perfil público de un profesional, con sus reseñas incluidas.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const doc = await db.collection('profesionales').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    }
    const resenasSnap = await db
      .collection('profesionales')
      .doc(params.id)
      .collection('resenas')
      .get()
    const resenas = resenasSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ id: doc.id, ...doc.data(), resenas })
  } catch (err) {
    console.error('GET /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo cargar el perfil.' }, { status: 500 })
  }
}

// DELETE: solo admin.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const db = getDb()
    await db.collection('profesionales').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 })
  }
}
