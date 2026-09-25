import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearCupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

// GET — todos los cupones (admin), más nuevos primero.
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const snap = await getDb().collection('cupones').get()
    const cupones = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ cupones })
  } catch (err) {
    console.error('GET /api/admin/cupones', err)
    return NextResponse.json({ error: 'No se pudieron cargar los cupones.' }, { status: 500 })
  }
}

// POST — crea un cupón. El código es único (se guarda en mayúsculas).
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const { datos, error } = sanearCupon(await req.json())
    if (!datos) return NextResponse.json({ error }, { status: 400 })
    const db = getDb()
    const existente = await db.collection('cupones').where('codigo', '==', datos.codigo).limit(1).get()
    if (!existente.empty) return NextResponse.json({ error: `Ya existe un cupón con el código ${datos.codigo}.` }, { status: 400 })
    const ref = await db.collection('cupones').add({ ...datos, usosCount: 0, createdAt: new Date().toISOString() })
    return NextResponse.json({ id: ref.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/cupones', err)
    return NextResponse.json({ error: 'No se pudo crear el cupón.' }, { status: 500 })
  }
}
