import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

// PATCH { activa } — pausar/reanudar (pausada no suma más).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json()
  await getDb().collection('campanas').doc(params.id).set({ activa: body.activa !== false }, { merge: true })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const ref = getDb().collection('campanas').doc(params.id)
  const dias = await ref.collection('dias').get()
  const batch = getDb().batch()
  dias.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(ref)
  await batch.commit()
  return NextResponse.json({ ok: true })
}
