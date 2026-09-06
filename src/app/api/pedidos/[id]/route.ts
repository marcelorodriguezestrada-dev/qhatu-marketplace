import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

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

// PATCH cambia el estado del pedido. Hay tres casos, con distinto nivel
// de permiso:
//  - estado: "informado_pago"  → lo dispara el COMPRADOR al apretar
//    "Ya pagué" en el checkout. No requiere nada: es solo un aviso,
//    todavía no mueve plata ni confirma nada por sí mismo.
//  - Estados de operación ("pagado", "en_preparacion", "en_entrega",
//    "entregado", "cancelado") → los puede disparar VOS desde /admin
//    (con ADMIN_PASSWORD), o EL VENDEDOR de ese pedido en particular
//    (con su login de Firebase) desde /vender — porque en un pedido con
//    QR/CBU propio, es el vendedor quien recibe la plata directo y
//    quien gestiona la entrega, no la plataforma.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { estado } = body
    if (!estado) {
      return NextResponse.json({ error: 'Falta el estado del pedido.' }, { status: 400 })
    }

    const estadosValidos = ['informado_pago', 'pagado', 'en_preparacion', 'en_entrega', 'entregado', 'cancelado']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }

    const db = getDb()
    const ref = db.collection('pedidos').doc(params.id)

    if (estado === 'informado_pago') {
      await ref.update({ estado: 'informado_pago', informadoPagoAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      return NextResponse.json({ ok: true })
    }

    const password = req.headers.get('x-admin-password')
    const esAdmin = !!password && password === process.env.ADMIN_PASSWORD

    if (!esAdmin) {
      const usuario = await getUsuarioDesdeRequest(req)
      const doc = await ref.get()
      const pedido = doc.data() as any
      const items = Array.isArray(pedido?.items) ? pedido.items : []
      const esVendedorDeEstePedido =
        !!usuario && items.some((item: any) => item?.vendedorId === usuario.uid)

      if (!esVendedorDeEstePedido) {
        return NextResponse.json({ error: 'No autorizado para cambiar el estado de este pedido.' }, { status: 401 })
      }
    }

    const payload: Record<string, string> = { estado, updatedAt: new Date().toISOString() }
    if (estado === 'pagado') payload.pagadoAt = new Date().toISOString()
    if (estado === 'en_preparacion') payload.enPreparacionAt = new Date().toISOString()
    if (estado === 'en_entrega') payload.enEntregaAt = new Date().toISOString()
    if (estado === 'entregado') payload.entregadoAt = new Date().toISOString()
    if (estado === 'cancelado') payload.canceladoAt = new Date().toISOString()

    await ref.update(payload)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/pedidos/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 })
  }
}
