import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — solo admin: todos los vendedores con perfil de tienda cargado
// (no todos los usuarios son vendedores, esta colección solo tiene un
// doc por cada uno que llegó a guardar algo en "Mi tienda").
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const snap = await getDb().collection('vendedores').get()
    const vendedores = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ vendedores })
  } catch (err) {
    console.error('GET /api/admin/vendedores', err)
    return NextResponse.json({ error: 'No se pudo cargar la lista de vendedores.' }, { status: 500 })
  }
}
