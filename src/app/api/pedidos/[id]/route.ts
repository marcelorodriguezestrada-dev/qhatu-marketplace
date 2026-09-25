import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { MAX_INTENTOS_COMPROBANTE } from '@/lib/ocrComprobante'

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
    const { estado, pagoVendedorMedio, franjaHoraria, fechaEntrega } = body

    const db = getDb()
    const ref = db.collection('pedidos').doc(params.id)

    // Comprobante rechazado por la lectura automática del checkout (no
    // parece comprobante, monto distinto, otra moneda o ilegible). Lo
    // manda el propio comprador (con su login). Suma un intento; al
    // tercero la compra se anula sola. Se guarda cada imagen rechazada
    // para que el admin la pueda ver.
    if (body.comprobanteRechazado) {
      const usuario = await getUsuarioDesdeRequest(req)
      if (!usuario?.email) return NextResponse.json({ error: 'Iniciá sesión para subir el comprobante.' }, { status: 401 })
      const r = body.comprobanteRechazado
      const resultado = await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref)
        if (!doc.exists) return { error: 'Pedido no encontrado.', status: 404 }
        const pedido = doc.data() as any
        if (String(pedido.comprador || '').toLowerCase() !== usuario.email!.toLowerCase()) {
          return { error: 'Este pedido no es tuyo.', status: 401 }
        }
        if (pedido.estado === 'cancelado') return { intentos: pedido.intentosComprobante || MAX_INTENTOS_COMPROBANTE, anulado: true }
        if (!['pendiente_pago', 'verificando_stock'].includes(pedido.estado)) {
          return { error: 'Este pedido ya no está esperando el pago.', status: 400 }
        }
        const intentos = (pedido.intentosComprobante || 0) + 1
        const anulado = intentos >= MAX_INTENTOS_COMPROBANTE
        const ahora = new Date().toISOString()
        const cambios: Record<string, unknown> = {
          intentosComprobante: intentos,
          comprobantesRechazados: FieldValue.arrayUnion({
            url: typeof r.url === 'string' ? r.url.slice(0, 500) : '',
            motivo: String(r.motivo || '').slice(0, 200),
            montoLeido: typeof r.montoLeido === 'number' ? r.montoLeido : null,
            fecha: ahora,
          }),
          updatedAt: ahora,
        }
        if (anulado) {
          cambios.estado = 'cancelado'
          cambios.canceladoAt = ahora
          cambios.canceladoMotivo = `Compra anulada: ${MAX_INTENTOS_COMPROBANTE} comprobantes inválidos.`
        }
        tx.update(ref, cambios)
        return { intentos, anulado }
      })
      if ('error' in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
      return NextResponse.json({ ...resultado, maxIntentos: MAX_INTENTOS_COMPROBANTE })
    }

    // El comprador elige en qué franja del día prefiere recibir el
    // envío, ya con el pedido pagado y confirmado — es solo una
    // preferencia suya sobre SU pedido (igual que "informado_pago" o
    // el comprobante), así que no pedimos login para guardarla: alcanza
    // con conocer el id del pedido.
    if (franjaHoraria) {
      if (!['8-13', '13-19'].includes(franjaHoraria)) {
        return NextResponse.json({ error: 'Franja horaria inválida.' }, { status: 400 })
      }
      // fechaEntrega: si el comprador no puede recibirlo mañana (el
      // día por default), eligió otro día de la semana desde
      // /checkout — yyyy-mm-dd. `null` es explícito: vuelve a la
      // fecha por default si la persona cambió de opinión.
      if (fechaEntrega !== undefined && fechaEntrega !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega)) {
        return NextResponse.json({ error: 'Fecha de entrega inválida.' }, { status: 400 })
      }
      await ref.update({ franjaHoraria, fechaEntrega: fechaEntrega || null, updatedAt: new Date().toISOString() })
      return NextResponse.json({ ok: true })
    }

    // Acción aparte: nosotros (la plataforma) le pagamos al vendedor lo
    // que le corresponde por un pedido con envío (esa plata había
    // entrado a nuestra cuenta, no a la de él, justamente para poder
    // sostener la garantía hasta que se confirme la entrega). Es
    // exclusivamente del admin — ni el comprador ni el vendedor pueden
    // marcarlo ellos mismos.
    if (pagoVendedorMedio) {
      if (!['efectivo', 'qr'].includes(pagoVendedorMedio)) {
        return NextResponse.json({ error: 'Medio de pago inválido.' }, { status: 400 })
      }
      const password = req.headers.get('x-admin-password')
      if (!password || password !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Solo el admin puede registrar el pago al vendedor.' }, { status: 401 })
      }
      await ref.update({
        pagoVendedorHecho: true,
        pagoVendedorMedio,
        pagoVendedorAt: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true })
    }

    if (!estado) {
      return NextResponse.json({ error: 'Falta el estado del pedido.' }, { status: 400 })
    }

    const estadosValidos = ['informado_pago', 'pendiente_pago', 'pagado', 'en_preparacion', 'en_entrega', 'entregado', 'cancelado']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }

    if (estado === 'informado_pago') {
      // Una compra anulada (3 comprobantes inválidos) ya no se puede
      // "revivir" avisando que se pagó.
      const actual = await ref.get()
      if (actual.data()?.estado === 'cancelado') {
        return NextResponse.json({ error: 'Esta compra fue anulada.' }, { status: 400 })
      }
      const cambios: Record<string, unknown> = { estado: 'informado_pago', informadoPagoAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      // Opcional: la URL de la captura del comprobante, si el comprador
      // la subió desde el checkout — así el vendedor/admin la puede ver
      // sin depender de que se la manden aparte por WhatsApp.
      if (typeof body.comprobanteUrl === 'string' && body.comprobanteUrl) cambios.comprobanteUrl = body.comprobanteUrl
      // Resultado del OCR del comprobante — es informativo, para que el
      // vendedor vea si el monto leído coincide sin compararlo a ojo.
      // No decide nada por sí solo: la confirmación sigue siendo manual.
      if (typeof body.ocrMonto === 'number') cambios.ocrMonto = body.ocrMonto
      if (typeof body.ocrCoincide === 'boolean') cambios.ocrCoincide = body.ocrCoincide
      // false = la imagen no tiene texto de comprobante (ej. una foto
      // cualquiera) — el admin lo ve marcado en rojo antes de confirmar.
      if (typeof body.ocrPareceComprobante === 'boolean') cambios.ocrPareceComprobante = body.ocrPareceComprobante
      await ref.update(cambios)
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

    const payload: Record<string, unknown> = { estado, updatedAt: new Date().toISOString() }
    if (estado === 'pendiente_pago') payload.stockConfirmadoAt = new Date().toISOString()
    if (estado === 'pagado') payload.pagadoAt = new Date().toISOString()
    if (estado === 'en_preparacion') payload.enPreparacionAt = new Date().toISOString()
    if (estado === 'en_entrega') payload.enEntregaAt = new Date().toISOString()
    if (estado === 'entregado') {
      payload.entregadoAt = new Date().toISOString()
      // Foto de comprobante de entrega -- el producto en la puerta o en
      // manos de quien lo recibe, que saca la moto al entregar. Es
      // opcional: si por algún motivo no se pudo sacar, igual se puede
      // marcar como entregado.
      if (typeof body.fotoEntregaUrl === 'string' && body.fotoEntregaUrl) payload.fotoEntregaUrl = body.fotoEntregaUrl
    }
    if (estado === 'cancelado') payload.canceladoAt = new Date().toISOString()

    await ref.update(payload)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/pedidos/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 })
  }
}

// DELETE: solo el admin puede eliminar un pedido.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  const esAdmin = !!password && password === process.env.ADMIN_PASSWORD
  if (!esAdmin) {
    return NextResponse.json({ error: 'Solo el admin puede eliminar pedidos.' }, { status: 401 })
  }
  try {
    const db = getDb()
    await db.collection('pedidos').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/pedidos/[id]', err)
    return NextResponse.json({ error: 'No se pudo eliminar el pedido.' }, { status: 500 })
  }
}