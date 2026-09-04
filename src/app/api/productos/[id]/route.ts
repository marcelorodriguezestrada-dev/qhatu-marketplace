import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// DELETE: solo el usuario que publicó el producto puede borrarlo.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }
  try {
    const db = getDb()
    const ref = db.collection('productos').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    }
    if (doc.data()?.vendedorId !== usuario.uid) {
      return NextResponse.json({ error: 'Ese producto no te pertenece.' }, { status: 403 })
    }
    await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/productos/[id]', err)
    return NextResponse.json({ error: 'No se pudo borrar el producto.' }, { status: 500 })
  }
}

// PATCH: editar precio/nombre/categoría — mismo chequeo de dueño.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }
  try {
    const db = getDb()
    const ref = db.collection('productos').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    }
    if (doc.data()?.vendedorId !== usuario.uid) {
      return NextResponse.json({ error: 'Ese producto no te pertenece.' }, { status: 403 })
    }
    const body = await req.json()
    const { nombre, categoria, precio, icono, imagenUrl } = body
    const cambios: Record<string, unknown> = {}
    if (nombre !== undefined) cambios.nombre = nombre
    if (categoria !== undefined) cambios.categoria = categoria
    if (precio !== undefined) cambios.precio = precio
    if (icono !== undefined) cambios.icono = icono
    if (imagenUrl !== undefined) cambios.imagenUrl = imagenUrl
    await ref.update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/productos/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el producto.' }, { status: 500 })
  }
}
