import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { limpiarMovimiento } from '@/lib/finanzasServer'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// PATCH { campos } → edita un movimiento · DELETE → lo borra.
const autorizado = async (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return (await esClaveAdmin(pw))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const d = limpiarMovimiento(await req.json().catch(() => ({})), false)
  if ('error' in d) return NextResponse.json({ error: d.error }, { status: 400 })
  const ref = getDb().collection('finanzas').doc(params.id)
  await ref.update(d.datos)
  const doc = await ref.get()
  return NextResponse.json({ ok: true, movimiento: { id: doc.id, ...doc.data() } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  await getDb().collection('finanzas').doc(params.id).delete()
  return NextResponse.json({ ok: true })
}
