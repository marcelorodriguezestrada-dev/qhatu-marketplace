import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// PATCH — activar/desactivar, cambiar orden, cambiar imagen o link.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const cambios: Record<string, unknown> = {}
    if (body.activo !== undefined) cambios.activo = !!body.activo
    if (body.imagenUrl !== undefined) cambios.imagenUrl = body.imagenUrl
    if (body.link !== undefined) cambios.link = body.link || null
    if (body.orden !== undefined) cambios.orden = Number(body.orden)

    await getDb().collection('banners').doc(params.id).update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/banners/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el banner.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    await getDb().collection('banners').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/banners/[id]', err)
    return NextResponse.json({ error: 'No se pudo eliminar el banner.' }, { status: 500 })
  }
}
