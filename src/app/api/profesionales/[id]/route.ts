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

// PATCH: solo admin — usado para aprobar/rechazar solicitudes públicas,
// o para editar un profesional ya publicado.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { estado, nombre, rubro, descripcion, zona, whatsapp, icono, plan, imagenUrl, precio, experiencia } = body
    const cambios: Record<string, unknown> = {}

    if (estado !== undefined) {
      if (!['pendiente_revision', 'aprobado', 'rechazado'].includes(estado)) {
        return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
      }
      cambios.estado = estado
    }
    if (nombre !== undefined) cambios.nombre = nombre
    if (rubro !== undefined) cambios.rubro = rubro
    if (descripcion !== undefined) cambios.descripcion = descripcion
    if (zona !== undefined) cambios.zona = zona
    if (whatsapp !== undefined) cambios.whatsapp = whatsapp
    if (icono !== undefined) cambios.icono = icono
    if (plan !== undefined) cambios.plan = plan === 'premium' ? 'premium' : 'basico'
    if (imagenUrl !== undefined) cambios.imagenUrl = imagenUrl
    if (precio !== undefined) cambios.precio = precio ? Number(precio) : null
    if (experiencia !== undefined) cambios.experiencia = experiencia

    await getDb().collection('profesionales').doc(params.id).update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
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
