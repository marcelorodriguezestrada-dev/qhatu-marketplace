import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// El checkout hace polling a este endpoint para saber si vos (el
// vendedor) ya confirmaste el pago desde /admin. Es público a propósito:
// el comprador necesita poder consultar el estado de su propio pedido
// sin login.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const doc = await db.collection('pedidos').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ id: doc.id, ...doc.data() })
  } catch (err) {
    console.error('GET /api/pedidos/[id]', err)
    return NextResponse.json({ error: 'No se pudo consultar el pedido.' }, { status: 500 })
  }
}

// PATCH cambia el estado del pedido. Hay dos casos, con distinto nivel
// de permiso:
//  - estado: "informado_pago"  → lo dispara el COMPRADOR al apretar
//    "Ya pagué" en el checkout. No requiere contraseña: es solo un aviso,
//    todavía no mueve plata ni confirma nada por sí mismo.
//  - estado: "pagado"          → lo dispara EL VENDEDOR desde /admin,
//    después de revisar a mano que el QR realmente se pagó. Requiere el
//    header x-admin-password.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { estado } = body
    const db = getDb()
    const ref = db.collection('pedidos').doc(params.id)

    if (estado === 'informado_pago') {
      await ref.update({ estado: 'informado_pago', informadoPagoAt: new Date().toISOString() })
      return NextResponse.json({ ok: true })
    }

    if (estado === 'pagado') {
      const password = req.headers.get('x-admin-password')
      if (!password || password !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
      }
      await ref.update({ estado: 'pagado', pagadoAt: new Date().toISOString() })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/pedidos/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 })
  }
}
