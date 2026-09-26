import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { numeroLocalABolivia } from '@/lib/validarWhatsapp'
import { HORA_CORTE_EXPRESS } from '@/lib/entregaDias'
import { evaluarCupon } from '@/lib/cupones'
import { esCuentaPruebaServidor } from '@/lib/cuentasPrueba'
import { buscarCuponPorCodigo, registrarUsoCupon } from '@/lib/cuponesServer'
import { descontarStock, unidadesPorProducto, reponerStockDePedido } from '@/lib/stockServer'
import { sumarMetricaRecuperacion } from '@/lib/recuperacionServer'

export const dynamic = 'force-dynamic'

// GET: lista completa de pedidos, para el panel /admin. Protegido con
// contraseña porque muestra datos de contacto de compradores.
// También acepta un token de Firebase para que el vendedor pueda ver solo
// los pedidos que implican a sus productos.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password && password === process.env.ADMIN_PASSWORD) {
    try {
      const db = getDb()
      const snap = await db.collection('pedidos').get()
      const pedidos = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return NextResponse.json({ pedidos })
    } catch (err) {
      console.error('GET /api/pedidos admin', err)
      return NextResponse.json({ error: 'No se pudieron cargar los pedidos.' }, { status: 500 })
    }
  }

  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para ver tus pedidos.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const snap = await db.collection('pedidos').get()
    const pedidos = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((pedido: any) => {
        const comprador = typeof pedido.comprador === 'string' ? pedido.comprador.toLowerCase() : ''
        const email = typeof usuario.email === 'string' ? usuario.email.toLowerCase() : ''
        const items = Array.isArray(pedido.items) ? pedido.items : []
        const esComprador = comprador === email
        const esVendedor = items.some((item: any) => item?.vendedorId === usuario.uid || item?.vendedor === usuario.email)
        return esComprador || esVendedor
      })
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ pedidos })
  } catch (err) {
    console.error('GET /api/pedidos usuario', err)
    return NextResponse.json({ error: 'No se pudieron cargar tus pedidos.' }, { status: 500 })
  }
}

// POST: lo llama el checkout al confirmar la compra. Crea el pedido en
// estado "pendiente_pago" — todavía no hay QR de por medio, eso lo
// muestra el frontend directamente (ver /checkout).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, total, comprador, nombreComprador, whatsappComprador, zonaEntrega, direccion, entreCalles, referenciaAdicional, costoEnvio, metodoEntrega, metodoPago, vendedorId, vendedorNombre, vendedorWhatsapp, lat, lng, envioExpress, cupon } = body
    if (!items || !items.length || !total) {
      return NextResponse.json({ error: 'Faltan datos del pedido.' }, { status: 400 })
    }
    // Mismo corte que el checkout (envioExpressDisponible), pero con la
    // hora de Bolivia (UTC-4, sin horario de verano): el servidor corre
    // en UTC y no podemos confiar en el reloj del navegador.
    // Las cuentas de prueba (Admin → Usuarios) no tienen restricción de
    // horario — verificado con el login, no con lo que mande el navegador.
    const usuarioLogueado = await getUsuarioDesdeRequest(req)
    const esPrueba = await esCuentaPruebaServidor(usuarioLogueado)
    if (envioExpress && !esPrueba) {
      const ahoraBolivia = new Date(Date.now() - 4 * 60 * 60 * 1000)
      if (ahoraBolivia.getUTCDay() === 0 || ahoraBolivia.getUTCHours() >= HORA_CORTE_EXPRESS) {
        return NextResponse.json(
          { error: `El envío express solo está disponible para compras antes de las ${HORA_CORTE_EXPRESS}:00. Elegí envío normal para continuar.` },
          { status: 400 }
        )
      }
    }
    const db = getDb()
    const ref = db.collection('pedidos').doc()

    // Cupón: el checkout manda el código, la compra completa (una compra
    // con varios vendedores se parte en varios pedidos, todos con el
    // mismo checkoutId) y la parte del descuento que le toca a este
    // pedido. Volvemos a evaluar el cupón acá; el uso se registra recién
    // después de guardar el pedido (si ahí falla, se deshace el pedido).
    let cuponPedido: Record<string, unknown> | null = null
    let usoCuponPendiente: { c: NonNullable<Awaited<ReturnType<typeof buscarCuponPorCodigo>>>; checkoutId: string; uid: string; email: string | null } | null = null
    if (cupon?.codigo) {
      const usuario = usuarioLogueado
      if (!usuario) return NextResponse.json({ error: 'Iniciá sesión para usar un cupón.' }, { status: 401 })
      const c = await buscarCuponPorCodigo(cupon.codigo)
      if (!c) return NextResponse.json({ error: 'El cupón ya no existe. Sacalo y volvé a intentar.' }, { status: 400 })
      const resultado = evaluarCupon(c, {
        subtotal: Number(cupon.subtotalCarrito) || 0,
        costoEnvio: Number(cupon.costoEnvioCarrito) || 0,
        extraExpress: Number(cupon.extraExpressCarrito) || 0,
        metodoEntrega: metodoEntrega === 'retiro' ? 'retiro' : 'envio',
      })
      if (!resultado.ok) return NextResponse.json({ error: `Cupón ${c.codigo}: ${resultado.error}` }, { status: 400 })
      const descuentoProductos = Math.max(0, Number(cupon.descuentoProductos) || 0)
      const descuentoEnvio = Math.max(0, Number(cupon.descuentoEnvio) || 0)
      // La parte de este pedido nunca puede superar el descuento de toda
      // la compra (+1 Bs de margen por el redondeo del reparto).
      if (descuentoProductos > resultado.descuentoProductos + 1 || descuentoEnvio > resultado.descuentoEnvio + 1) {
        return NextResponse.json({ error: 'El descuento del cupón no coincide. Volvé a aplicarlo.' }, { status: 400 })
      }
      const checkoutId = String(cupon.checkoutId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || ref.id
      usoCuponPendiente = { c, checkoutId, uid: usuario.uid, email: usuario.email }
      cuponPedido = { cuponId: c.id, codigo: c.codigo, campana: c.campana || '', tipo: c.tipo, descuentoProductos, descuentoEnvio, checkoutId }
    }

    const datosPedido = {
      // Descuento de cupón (lo absorbe Clasi Click, ver src/lib/cupones.ts).
      // `total` y `costoEnvio` ya vienen con el descuento aplicado.
      cupon: cuponPedido,
      // Pedido hecho con una cuenta de prueba (ver src/lib/cuentasPrueba.ts).
      esPrueba,
      items,
      total: Number(total),
      comprador: comprador || null,
      // Nombre y apellido que la persona escribió en el checkout — a
      // diferencia de `comprador` (el email de la cuenta), esto es lo
      // que el vendedor y el admin ven como "a nombre de quién" es el
      // pedido, porque el registro de cuenta no pide nombre (ver
      // /login: solo pide email, contraseña y celular).
      nombreComprador: nombreComprador || null,
      whatsappComprador: whatsappComprador ? numeroLocalABolivia(whatsappComprador) : null,
      vendedorId: vendedorId || null,
      // Guardamos nombre y WhatsApp del vendedor tal como estaban al
      // momento de la compra — así /admin puede mostrar de qué tienda
      // es cada pedido y contactarlo directo, sin tener que ir a
      // buscarlo aparte a la colección de vendedores cada vez.
      vendedorNombre: vendedorNombre || (vendedorId ? 'Vendedor' : 'Clasi Click'),
      vendedorWhatsapp: vendedorWhatsapp || '',
      zonaEntrega: zonaEntrega || 'No especificado',
      direccion: direccion || null,
      // Referencia opcional ("entre calle X y calle Y") — ayuda a
      // ubicar la dirección cuando el barrio no tiene numeración clara,
      // sin ser obligatoria.
      entreCalles: entreCalles || null,
      // Otro dato de interés opcional (ej: "portón verde", "al lado de
      // la farmacia") — igual que entreCalles, ayuda a ubicar la
      // dirección pero no es obligatorio.
      referenciaAdicional: referenciaAdicional || null,
      // Ubicación opcional que comparte el comprador al pedir con
      // envío — la usa /admin (pestaña Reparto) para armar la ruta de
      // la moto por cercanía. Sin esto, el pedido igual se puede
      // repartir, solo que a mano.
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      costoEnvio: Number(costoEnvio || 0),
      // Envío express: entrega el mismo día en vez del día siguiente, a
      // cambio de un costo fijo en vez del costo por barrio (ver
      // COSTO_ENVIO_EXPRESS en /checkout). Se lo mostramos a /admin y al
      // vendedor para que sepan que este pedido en particular es
      // urgente, no para el reparto de mañana.
      envioExpress: !!envioExpress,
      metodoEntrega: metodoEntrega || 'delivery',
      // 'qr' (default, pago por transferencia/QR) o 'efectivo' — solo
      // tiene sentido con retiro en tienda. Le sirve al vendedor para
      // saber si tiene que esperar una transferencia o cobrar en mano.
      metodoPago: metodoPago || 'qr',
      // Con envío arrancamos pidiéndole al vendedor que confirme que
      // tiene stock antes de mostrarle el QR al comprador — así no
      // depositan por algo que capaz ya no está disponible. Con retiro
      // en tienda no hace falta este paso: el comprador ve el producto
      // en mano antes de pagar.
      estado: metodoEntrega === 'envio' ? 'verificando_stock' : 'pendiente_pago',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Stock: se verifica y descuenta en la misma transacción que crea el
    // pedido — así dos personas no pueden comprar la última unidad a la
    // vez. Productos sin stock cargado no se controlan (ver src/lib/stock.ts).
    const unidades = unidadesPorProducto(items)
    const creado = await db.runTransaction(async (tx) => {
      const r = await descontarStock(tx, unidades)
      if (!r.ok) return r
      tx.set(ref, { ...datosPedido, stockDescontado: r.descontado })
      return r
    })
    if (!creado.ok) return NextResponse.json({ error: creado.error, sinStock: true }, { status: 409 })

    if (usoCuponPendiente) {
      const { c, checkoutId, uid, email } = usoCuponPendiente
      const uso = await registrarUsoCupon(c, { checkoutId, uid, email, pedidoId: ref.id })
      if (!uso.ok) {
        // El cupón ya no se podía usar (límite alcanzado justo ahora, etc.):
        // deshacemos el pedido y devolvemos el stock.
        await reponerStockDePedido(ref)
        await ref.delete().catch(() => {})
        return NextResponse.json({ error: `Cupón ${c.codigo}: ${uso.error}` }, { status: 400 })
      }
    }
    // Métrica de "Estabas mirando esto": compra de un producto que se le
    // recordó a esta persona en los últimos 7 días (se cuenta una vez).
    if (usuarioLogueado) {
      try {
        const ids = Object.keys(unidades).slice(0, 10)
        const intereses = ids.length ? await db.getAll(...ids.map((pid) => db.collection('intereses').doc(`${usuarioLogueado.uid}_${pid}`))) : []
        for (const d of intereses) {
          const i = d.data()
          if (d.exists && i?.avisadoEn && !i.convertido && Date.now() - Date.parse(i.avisadoEn) < 7 * 86400_000) {
            await d.ref.update({ convertido: new Date().toISOString(), pedidoId: ref.id })
            await sumarMetricaRecuperacion('compras')
          } else if (d.exists && !i?.avisadoEn) {
            // Compró antes de que hiciera falta avisarle: no se le avisa.
            await d.ref.update({ descartado: 'compro' })
          }
        }
      } catch (err) {
        console.error('métrica recuperación', err)
      }
    }
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/pedidos', err)
    return NextResponse.json({ error: 'No se pudo crear el pedido.' }, { status: 500 })
  }
}
