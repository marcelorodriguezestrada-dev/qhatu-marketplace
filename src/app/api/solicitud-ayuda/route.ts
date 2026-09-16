import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { nombre, celular, email, tienda, mensaje } = await req.json()
    if (!celular && !email) {
      return NextResponse.json({ error: 'Necesitamos al menos tu celular o email para contactarte.' }, { status: 400 })
    }
    const db = getDb()
    await db.collection('solicitudes_ayuda').add({
      nombre: nombre || '',
      celular: celular || '',
      email: email || '',
      tienda: tienda || '',
      mensaje: mensaje || '',
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const db = getDb()
  const snap = await db.collection('solicitudes_ayuda').orderBy('creadoEn', 'desc').get()
  const solicitudes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ solicitudes })
}

export async function PATCH(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id, estado } = await req.json()
  const db = getDb()
  await db.collection('solicitudes_ayuda').doc(id).update({ estado })
  return NextResponse.json({ ok: true })
}
