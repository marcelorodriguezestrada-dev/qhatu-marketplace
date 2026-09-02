import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET: lista completa de pedidos, para el panel /admin. Protegido con
// contraseña porque muestra datos de contacto de compradores.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const db = getDb()
    const snap = await db.collection('pedidos').get()
    const pedidos = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ pedidos })
  } catch (err) {
    console.error('GET /api/pedidos', err)
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos.' }, { status: 500 })
  }
}

// POST: lo llama el checkout al confirmar la compra. Crea el pedido en
// estado "pendiente_pago" — todavía no hay QR de por medio, eso lo
// muestra el frontend directamente (ver /checkout).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, total, comprador } = body
    if (!items || !items.length || !total) {
      return NextResponse.json({ error: 'Faltan datos del pedido.' }, { status: 400 })
    }
    const db = getDb()
    const ref = await db.collection('pedidos').add({
      items, total, comprador: comprador || null,
      estado: 'pendiente_pago',
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/pedidos', err)
    return NextResponse.json({ error: 'No se pudo crear el pedido.' }, { status: 500 })
  }
}
