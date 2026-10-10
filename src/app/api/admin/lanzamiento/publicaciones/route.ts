import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearPublicacion } from '@/lib/lanzamiento'
import { crearPublicacion } from '@/lib/lanzamientoServer'

export const dynamic = 'force-dynamic'

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}
const noAutorizado = () => NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

// POST { publicaciones: [...] }: las agrega al calendario, cada una con su link rastreable.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const body = await req.json()
    const lista = (Array.isArray(body.publicaciones) ? body.publicaciones : [body.publicacion]).filter(Boolean).slice(0, 60)
    const creadas = []
    for (const p of lista) {
      const c = await crearPublicacion(p)
      if (c) creadas.push(c)
    }
    if (!creadas.length) return NextResponse.json({ error: 'Faltan datos: fecha, red y título.' }, { status: 400 })
    return NextResponse.json({ creadas })
  } catch (err) {
    console.error('POST /api/admin/lanzamiento/publicaciones', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}

// PATCH { id, cambios }: editar o cambiar el estado (por hacer / lista / publicada).
export async function PATCH(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const body = await req.json()
    const ref = getDb().collection('publicacionesMarketing').doc(String(body.id || ''))
    const actual = await ref.get()
    if (!actual.exists) return NextResponse.json({ error: 'No existe esa publicación.' }, { status: 404 })
    const p = sanearPublicacion({ ...actual.data(), ...(body.cambios || {}) })
    if (!p) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
    const extra = p.estado === 'publicada' && actual.data()?.estado !== 'publicada' ? { publicadaAt: new Date().toISOString() } : {}
    await ref.update({ ...p, ...extra, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/lanzamiento/publicaciones', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}

// DELETE ?id=: la saca del calendario (y su link, si nadie entró por él).
export async function DELETE(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const db = getDb()
    const id = req.nextUrl.searchParams.get('id') || ''
    const ref = db.collection('publicacionesMarketing').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ ok: true })
    const campanaId = doc.data()?.campanaId
    if (campanaId) {
      const c = await db.collection('campanas').doc(campanaId).get()
      if (c.exists && !c.data()?.visitas) await c.ref.delete()
    }
    await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/lanzamiento/publicaciones', err)
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 })
  }
}
