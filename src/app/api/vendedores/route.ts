import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// POST: el vendedor logueado carga o actualiza su propio perfil de
// cobro (QR/CBU/nombre del negocio). Es un "upsert" — un solo documento
// por vendedor, con su uid como id, en la colección "vendedores".
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { qrImageUrl, cbu, nombreNegocio } = body
    const db = getDb()
    await db.collection('vendedores').doc(usuario.uid).set(
      {
        qrImageUrl: qrImageUrl || '',
        cbu: cbu || '',
        nombreNegocio: nombreNegocio || '',
        email: usuario.email,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/vendedores', err)
    return NextResponse.json({ error: 'No se pudo guardar tu perfil de cobro.' }, { status: 500 })
  }
}

// GET: listado de vendedores (solo admin).
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  const esAdmin = !!password && password === process.env.ADMIN_PASSWORD
  if (!esAdmin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }
  try {
    const db = getDb()
    const snap = await db.collection('vendedores').get()
    const vendedores = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ vendedores })
  } catch (err) {
    console.error('GET /api/vendedores', err)
    return NextResponse.json({ error: 'No se pudo listar vendedores.' }, { status: 500 })
  }
}
