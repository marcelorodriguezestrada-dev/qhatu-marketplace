import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearConfigVolante } from '@/lib/volantes'

export const dynamic = 'force-dynamic'

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

// Plantillas de volantes guardadas (Admin → Marketing → Volantes).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const snap = await getDb().collection('volantes_plantillas').get()
    const plantillas = snap.docs
      .map((d) => ({ id: d.id, nombre: d.data().nombre, config: sanearConfigVolante(d.data().config), createdAt: d.data().createdAt }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return NextResponse.json({ plantillas })
  } catch (err) {
    console.error('GET /api/admin/volantes', err)
    return NextResponse.json({ plantillas: [] })
  }
}

// POST { nombre, config, id? } — crear o actualizar.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json()
  const nombre = String(body.nombre || '').trim().slice(0, 50)
  if (nombre.length < 2) return NextResponse.json({ error: 'Poné un nombre a la plantilla.' }, { status: 400 })
  const datos = { nombre, config: sanearConfigVolante(body.config), updatedAt: new Date().toISOString() }
  const col = getDb().collection('volantes_plantillas')
  if (typeof body.id === 'string' && body.id) {
    await col.doc(body.id).set(datos, { merge: true })
    return NextResponse.json({ id: body.id })
  }
  const ref = await col.add({ ...datos, createdAt: datos.updatedAt })
  return NextResponse.json({ id: ref.id })
}

export async function DELETE(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) await getDb().collection('volantes_plantillas').doc(id).delete()
  return NextResponse.json({ ok: true })
}
