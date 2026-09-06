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
