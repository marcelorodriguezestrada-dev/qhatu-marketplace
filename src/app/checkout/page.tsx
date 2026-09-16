'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCarrito, ItemCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { ZONAS_ENVIO_POTOSI, ZONAS_AGRUPADAS, grupoDeBarrio, barrioMasCercano } from '@/data/zonasPotosi'
import { MapaZonasPotosi } from '@/components/MapaZonasPotosi'
import { calcularFranja } from '@/lib/reparto'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// Ventana horaria aproximada de entrega, según a qué salida de la moto
// (8:00 o 14:00, ver src/lib/reparto.ts) entra un pedido pagado ahora
// mismo. Es una estimación para mostrarle al comprador, no un dato que
// se guarda — el horario real de reparto lo arma /admin con la ruta del
// día.
function ventanaEntrega(): string {
  return calcularFranja(new Date()) === '08:00' ? 'entre las 8:00 y las 12:00' : 'entre las 14:00 y las 18:00'
}

function linkWhatsappRetiroEfectivo(s: SubPedido): string {
  const detalle = s.items.map((it) => `- ${it.cantidad} × ${it.nombre}`).join('\n')
  const texto = `Hola! Quiero coordinar el retiro de mi pedido${s.pedidoId ? ` #${s.pedidoId.slice(0, 6)}` : ''} para pagarlo en efectivo al retirarlo:\n${detalle}\nTotal: ${bs(s.total)}\n¿Cuándo puedo pasar a buscarlo?`
  return `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

type Etapa = 'entrega' | 'creando' | 'pagando' | 'resumen' | 'error'

// Costo de envío por zona de Potosí — ver src/data/zonasPotosi.ts para
// las coordenadas y ajustar los precios reales.
const COSTOS_ENVIO: Record<string, number> = Object.fromEntries(ZONAS_ENVIO_POTOSI.map((z) => [z.nombre, z.costoEnvio]))

// QR/cuenta de la plataforma — se usa como respaldo para los items sin
// vendedor identificado (datos de ejemplo) o para vendedores que
// todavía no configuraron su propio QR/CBU en /vender.
const QR_PLATAFORMA = process.env.NEXT_PUBLIC_QR_IMAGE_URL || ''
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME || ''
const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || ''
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || ''

type SubPedido = {
  vendedorId: string | null
  vendedorNombre: string
  whatsapp: string
  items: ItemCarrito[]
  subtotal: number
  costoEnvio: number
  total: number
  qrImageUrl: string
  cbu: string
  cobroPropio: boolean
  pedidoId: string | null
  declarado: boolean
  estadoActual: string
}
// ok 
// Reparte el costo de envío proporcional al subtotal de cada vendedor,
// asegurando que la suma dé exacto (el "sobrante" de redondear para
// abajo se lo llevan los grupos con la parte decimal más alta).
function repartirEnvio(subtotales: number[], costoEnvioTotal: number): number[] {
  const totalSubtotal = subtotales.reduce((s, x) => s + x, 0)
  if (totalSubtotal === 0 || costoEnvioTotal === 0) return subtotales.map(() => 0)
  const partes = subtotales.map((st) => (st / totalSubtotal) * costoEnvioTotal)
  const redondeadas = partes.map((p) => Math.floor(p))
  let sobrante = Math.round(costoEnvioTotal - redondeadas.reduce((s, x) => s + x, 0))
  const ordenDecimales = partes
    .map((p, i) => ({ i, dec: p - Math.floor(p) }))
    .sort((a, b) => b.dec - a.dec)
  for (let k = 0; k < sobrante; k++) {
    redondeadas[ordenDecimales[k % ordenDecimales.length].i] += 1
  }
  return redondeadas
}

export default function CheckoutPage() {
  // useSearchParams() obliga a Next.js a renderizar esta parte del
  // lado del cliente en vez de poder prerenderizarla en el build — el
  // Suspense de acá afuera es lo que le permite seguir generando el
  // resto de la página estáticamente sin romper el build (si no,
  // "useSearchParams() should be wrapped in a suspense boundary").
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const { items: itemsCarrito, cambiarCantidad, quitar, vaciarTienda } = useCarrito()
  const { usuario, cargando: authCargando, emailVerificado } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Qué tienda se está pagando en esta visita a /checkout — la manda
  // el carrito como ?tienda=<vendedorId> (o "plataforma" para productos
  // sin vendedor propio). Cada tienda del carrito se compra por
  // separado, así que acá solo trabajamos con SUS productos — el resto
  // del carrito queda intacto para pagarlo en otra visita.
  const claveTienda = searchParams.get('tienda')
  const vendedorIdTienda = claveTienda && claveTienda !== 'plataforma' ? claveTienda : null
  const items = claveTienda
    ? itemsCarrito.filter((i) => (i.vendedorId || 'plataforma') === claveTienda)
    : itemsCarrito

  const [etapa, setEtapa] = useState<Etapa>('entrega')
  // QR/cuenta configurados por el admin desde /admin (ver
  // /api/configuracion/pagos). Si todavía no cargó nada, se usan las
  // variables de entorno de siempre como respaldo — así el checkout
  // nunca se queda sin QR para mostrar.
  const [qrPlataforma, setQrPlataforma] = useState(QR_PLATAFORMA)
  const [cbuPlataforma, setCbuPlataforma] = useState(BANK_ACCOUNT_NUMBER)
  useEffect(() => {
    fetch('/api/configuracion/pagos')
      .then((r) => r.json())
      .then((data) => {
        if (data.qrImageUrl) setQrPlataforma(data.qrImageUrl)
        if (data.cbu) setCbuPlataforma(data.cbu)
      })
      .catch(() => {})
  }, [])
  const [metodoEntrega, setMetodoEntrega] = useState<'envio' | 'retiro'>('envio')
  // Solo aplica cuando metodoEntrega es 'retiro' — con envío siempre es
  // QR (no tiene sentido pagar en efectivo algo que te llevan a domicilio
  // sin verse las caras).
  const [metodoPago, setMetodoPago] = useState<'qr' | 'efectivo'>('qr')

  // Qué vendedores del carrito habilitaron cobrar por QR. Ojo: no
  // alcanza con que hayan subido la foto del QR — tienen que haber
  // tildado "Pago con QR" en su tipo de ventas. Si subieron el QR pero
  // no lo tildaron, es porque no quieren cobrar por ahí.
  //
  // Se consulta acá, al entrar al checkout, porque de esto depende si
  // en "Retiro en tienda" se le puede ofrecer pagar por QR o solo
  // coordinar por WhatsApp — antes esto solo se sabía DESPUÉS, al
  // momento de crear el pedido.
  const [vendedoresConQR, setVendedoresConQR] = useState<Record<string, boolean>>({})
  const [consultandoVendedores, setConsultandoVendedores] = useState(true)

  const vendedorIdsCarrito = Array.from(
    new Set(items.map((i) => i.vendedorId).filter((v): v is string => !!v))
  )
  const claveVendedores = vendedorIdsCarrito.join(',')

  useEffect(() => {
    if (vendedorIdsCarrito.length === 0) {
      setVendedoresConQR({})
      setConsultandoVendedores(false)
      return
    }
    let cancelado = false
    setConsultandoVendedores(true)
    Promise.all(
      vendedorIdsCarrito.map((id) =>
        fetch(`/api/vendedores/${id}`)
          .then((r) => r.json())
          .then((data) => [id, !!data.aceptaPagoQr] as const)
          .catch(() => [id, false] as const)
      )
    )
      .then((pares) => {
        if (cancelado) return
        setVendedoresConQR(Object.fromEntries(pares))
      })
      .finally(() => {
        if (!cancelado) setConsultandoVendedores(false)
      })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveVendedores])

  // ¿Hay al menos un vendedor que habilitó cobrar por QR? Si no, en
  // retiro no tiene sentido mostrar la opción: no hay a quién pagarle
  // por ahí.
  const algunVendedorConQR = vendedorIdsCarrito.some((id) => vendedoresConQR[id])

  // Si ningún vendedor tiene QR, el pago en retiro se coordina sí o sí
  // por WhatsApp — forzamos 'efectivo' para que el flujo posterior
  // (que ya existía) mande al paso de WhatsApp en vez de a una pantalla
  // de QR vacía.
  useEffect(() => {
    if (metodoEntrega === 'retiro' && !consultandoVendedores && !algunVendedorConQR) {
      setMetodoPago('efectivo')
    }
  }, [metodoEntrega, consultandoVendedores, algunVendedorConQR])
  const [zonaEntrega, setZonaEntrega] = useState(ZONAS_ENVIO_POTOSI[0].nombre)
  // Qué "Zona 1/2/3" está elegida en el primer selector — el segundo
  // selector (el barrio) recién muestra las opciones de ese grupo.
  const [grupoZonaSel, setGrupoZonaSel] = useState(grupoDeBarrio(ZONAS_ENVIO_POTOSI[0].nombre)?.id || ZONAS_AGRUPADAS[0].id)
  const [mostrarMapaZonas, setMostrarMapaZonas] = useState(false)
  const [direccion, setDireccion] = useState('')
  // Ubicación GPS opcional — con esto el reparto puede armar la ruta de
  // la moto por cercanía en vez de ir a ciegas por la zona nomás. Si el
  // comprador no la comparte, igual puede pedir con envío; su parada
  // simplemente queda al final de la ruta para confirmar a mano.
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [subPedidos, setSubPedidos] = useState<SubPedido[]>([])
  const [pasoActual, setPasoActual] = useState(0)
  // Índices de subPedidos donde el usuario ya apretó "Continuar con la
  // compra" después de que el vendedor confirmó stock. Hasta que no lo
  // aprieta, aunque ya esté confirmado, mostramos el mensaje de
  // "disponible" en vez de saltar directo al QR de pago.
  const [pasosConfirmados, setPasosConfirmados] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Concretar una compra requiere estar logueado Y con el email
  // verificado (regla de toda la plataforma) — si alguien llega hasta
  // acá sin cuenta, o con una cuenta todavía sin verificar, lo mandamos
  // a /login antes de dejarlo seguir.
  useEffect(() => {
    if (authCargando) return
    if (!usuario || emailVerificado === false) router.push('/login')
  }, [authCargando, usuario, emailVerificado, router])

  const costoEnvio = metodoEntrega === 'retiro' ? 0 : (COSTOS_ENVIO[zonaEntrega] ?? 0)
  const subtotalCarrito = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  function usarMiUbicacion() {
    setBuscandoUbicacion(true)
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.')
      setBuscandoUbicacion(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        // Con la ubicación ya podemos adivinar el barrio más cercano y
        // completar la zona y el barrio solos, en vez de dejar que la
        // persona los busque a mano en la lista.
        const cercano = barrioMasCercano(pos.coords.latitude, pos.coords.longitude)
        setZonaEntrega(cercano.nombre)
        const grupo = grupoDeBarrio(cercano.nombre)
        if (grupo) setGrupoZonaSel(grupo.id)
        setBuscandoUbicacion(false)
      },
      () => {
        setError('No pudimos acceder a tu ubicación. Podés seguir sin ella, solo que la moto va a confirmar tu dirección a mano.')
        setBuscandoUbicacion(false)
      }
    )
  }

  async function confirmarEntregaYCrearPedidos() {
    // Si es retiro + efectivo, reservamos la pestaña de WhatsApp ACÁ
    // MISMO, todavía dentro del gesto de click del usuario — recién más
    // abajo, después de crear el pedido (que tarda porque es un fetch),
    // le asignamos la URL final. Si abriéramos la pestaña después de
    // esos awaits, el navegador ya no lo reconoce como una acción
    // directa del usuario y la mayoría de los navegadores bloquean el
    // popup silenciosamente — así evitamos ese bloqueo.
    const abrirWhatsappDirecto = metodoEntrega === 'retiro' && metodoPago === 'efectivo'
    const ventanaWhatsapp = abrirWhatsappDirecto ? window.open('', '_blank') : null

    setEtapa('creando')
    setError('')

    const grupos = new Map<string, ItemCarrito[]>()
    for (const item of items) {
      const clave = item.vendedorId || 'plataforma'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave)!.push(item)
    }

    const clavesVendedor = Array.from(grupos.keys())
    const subtotales = clavesVendedor.map((k) => grupos.get(k)!.reduce((s, i) => s + i.precio * i.cantidad, 0))
    const enviosRepartidos = repartirEnvio(subtotales, costoEnvio)

    try {
      const nuevos: SubPedido[] = []
      for (let i = 0; i < clavesVendedor.length; i++) {
        const clave = clavesVendedor[i]
        const grupoItems = grupos.get(clave)!
        const vendedorId = clave === 'plataforma' ? null : clave
        const subtotal = subtotales[i]
        const envioGrupo = enviosRepartidos[i]
        const totalGrupo = subtotal + envioGrupo

        let qrImageUrl = qrPlataforma
        let cbu = cbuPlataforma
        let cobroPropio = false
        let vendedorNombre = clave === 'plataforma' ? 'Clasi Click' : grupoItems[0]?.vendedor || 'Vendedor'
        let whatsappVendedor = ''

        if (vendedorId) {
          try {
            const res = await fetch(`/api/vendedores/${vendedorId}`)
            const data = await res.json()
            // El QR/CBU propio del vendedor solo se usa con retiro en
            // tienda — ahí el comprador ve el producto en mano antes de
            // pagar, así que tiene sentido que le pague directo a él.
            // Con envío, SIEMPRE se deposita a Clasi Click (nunca al
            // vendedor), y recién se le libera la plata una vez
            // confirmada la entrega — así protegemos al comprador si
            // el envío se complica.
            if (metodoEntrega === 'retiro' && data.configurado) {
              qrImageUrl = data.qrImageUrl || qrPlataforma
              cbu = data.cbu || cbuPlataforma
              cobroPropio = true
              if (data.nombreNegocio) vendedorNombre = data.nombreNegocio
            } else if (data.nombreNegocio) {
              vendedorNombre = data.nombreNegocio
            }
            whatsappVendedor = data.whatsapp || ''
          } catch {
            // si falla la consulta, seguimos con el QR de la plataforma como respaldo
          }
        }

        const metodoPagoGrupo = metodoEntrega === 'retiro' ? metodoPago : 'qr'

        const resPedido = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: grupoItems,
            total: totalGrupo,
            comprador: usuario?.email || null,
            vendedorId,
            vendedorNombre,
            vendedorWhatsapp: whatsappVendedor,
            zonaEntrega,
            direccion,
            lat: metodoEntrega === 'envio' ? lat : null,
            lng: metodoEntrega === 'envio' ? lng : null,
            costoEnvio: envioGrupo,
            metodoEntrega,
            metodoPago: metodoPagoGrupo,
          }),
        })
        const dataPedido = await resPedido.json()
        if (dataPedido.error) throw new Error(dataPedido.error)

        nuevos.push({
          vendedorId,
          vendedorNombre,
          whatsapp: whatsappVendedor,
          items: grupoItems,
          subtotal,
          costoEnvio: envioGrupo,
          total: totalGrupo,
          qrImageUrl,
          cbu,
          cobroPropio,
          pedidoId: dataPedido.id,
          declarado: false,
          estadoActual: metodoEntrega === 'envio' ? 'verificando_stock' : 'pendiente_pago',
        })
      }

      setSubPedidos(nuevos)
      setPasoActual(0)

      if (abrirWhatsappDirecto) {
        // Como el checkout ahora es siempre de UNA tienda a la vez, acá
        // solo hay un subPedido — le llevamos directo a WhatsApp con el
        // detalle del pedido, sin ninguna pantalla intermedia de por
        // medio.
        const link = nuevos[0] ? linkWhatsappRetiroEfectivo(nuevos[0]) : null
        if (link && ventanaWhatsapp) {
          ventanaWhatsapp.location.href = link
        } else if (link) {
          // Si el navegador bloqueó igual la pestaña que reservamos
          // (pasa en algunos navegadores de Android en modo muy
          // restrictivo), abrimos de nuevo como respaldo.
          window.open(link, '_blank')
        }
        // A partir de acá el resto se coordina por WhatsApp, no adentro
        // de la app — no tiene sentido dejar el carrito de esta tienda
        // esperando ni ponerse a consultar el estado del pedido cada
        // pocos segundos, como si fuera a "pagarse solo" en algún
        // momento.
        vaciarTienda(vendedorIdTienda)
        setEtapa('resumen')
      } else {
        setEtapa('pagando')
      }
    } catch (e: any) {
      setError(e.message || 'No se pudieron crear los pedidos.')
      setEtapa('error')
    }
  }

  function declararPagoActual() {
    const sub = subPedidos[pasoActual]
    if (!sub.pedidoId) return
    fetch(`/api/pedidos/${sub.pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'informado_pago' }),
    }).then(() => {
      setSubPedidos((prev) => prev.map((s, i) => (i === pasoActual ? { ...s, declarado: true, estadoActual: 'informado_pago' } : s)))
      if (pasoActual < subPedidos.length - 1) {
        setPasoActual(pasoActual + 1)
      } else {
        setEtapa('resumen')
      }
    })
  }

  // Mientras el paso actual está "verificando_stock" (solo pasa con
  // envío), consultamos cada pocos segundos si el vendedor ya lo
  // confirmó desde /mis-pedidos o vos desde /admin. En cuanto cambia,
  // esta misma pantalla pasa sola a mostrar el QR — el comprador no
  // tiene que hacer nada ni refrescar.
  useEffect(() => {
    if (etapa !== 'pagando') return
    const sub = subPedidos[pasoActual]
    if (!sub || sub.estadoActual !== 'verificando_stock' || !sub.pedidoId) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pedidos/${sub.pedidoId}`)
        const data = await res.json()
        if (data.estado && data.estado !== 'verificando_stock') {
          setSubPedidos((prev) => prev.map((s, i) => (i === pasoActual ? { ...s, estadoActual: data.estado } : s)))
        }
      } catch {
        // si falla una consulta, probamos de nuevo en el siguiente ciclo
      }
    }, 4000)
    return () => clearInterval(interval)
    // Solo nos importa si ESTE paso sigue en verificación — no hace
    // falta re-crear el intervalo por cambios en otros subpedidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, pasoActual, subPedidos[pasoActual]?.estadoActual, subPedidos[pasoActual]?.pedidoId])

  useEffect(() => {
    if (etapa !== 'resumen') return
    // Retiro + efectivo se coordina por WhatsApp, no acá adentro — no
    // hay ningún "pagado" digital que esperar, así que no tiene sentido
    // consultar el servidor cada 4 segundos para nada.
    if (metodoEntrega === 'retiro' && metodoPago === 'efectivo') return
    pollRef.current = setInterval(async () => {
      const actualizados = await Promise.all(
        subPedidos.map(async (s) => {
          if (!s.pedidoId || s.estadoActual === 'pagado') return s
          const res = await fetch(`/api/pedidos/${s.pedidoId}`)
          const data = await res.json()
          return { ...s, estadoActual: data.estado || s.estadoActual }
        })
      )
      setSubPedidos(actualizados)
      if (actualizados.every((s) => s.estadoActual === 'pagado')) {
        if (pollRef.current) clearInterval(pollRef.current)
        vaciarTienda(vendedorIdTienda)
      }
    }, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa])

  if (items.length === 0 && etapa !== 'resumen') {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-16 text-center">
        <p className="font-body text-sm text-inksoft mb-4">Tu carrito está vacío.</p>
        <button onClick={() => router.push('/')} className="font-body text-sm text-maroon underline">
          Volver a la tienda
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[420px] mx-auto px-5 py-10">
      <button onClick={() => router.push('/')} className="border-none bg-transparent text-inksoft font-body text-[13px] mb-5 p-0">
        ← Volver a la tienda
      </button>

      {etapa === 'entrega' && (
        <div className="bg-panel border border-line rounded-xl p-6">
          <div className="font-display text-lg font-bold text-ink mb-4">¿Cómo lo recibís?</div>

          <div className="flex gap-1 p-1 mb-4 bg-panelalt rounded-full">
            <button
              type="button"
              onClick={() => setMetodoEntrega('envio')}
              className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all ${
                metodoEntrega === 'envio' ? 'bg-ink text-white shadow-sm' : 'text-inksoft'
              }`}
            >
              🛵 Envío
            </button>
            <button
              type="button"
              onClick={() => setMetodoEntrega('retiro')}
              className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all ${
                metodoEntrega === 'retiro' ? 'bg-ink text-white shadow-sm' : 'text-inksoft'
              }`}
            >
              🏬 Retiro en tienda
            </button>
          </div>

          {metodoEntrega === 'envio' ? (
            <>
              <label className="block text-left mb-3">
                <span className="font-body text-[11px] text-inksoft block mb-1">Zona</span>
                <select
                  value={grupoZonaSel}
                  onChange={(e) => {
                    const grupo = ZONAS_AGRUPADAS.find((g) => g.id === e.target.value)
                    setGrupoZonaSel(e.target.value)
                    if (grupo) setZonaEntrega(grupo.barrios[0])
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm mb-2"
                >
                  {ZONAS_AGRUPADAS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label} · {bs(g.costoEnvio)}</option>
                  ))}
                </select>
                <span className="font-body text-[11px] text-inksoft block mb-1">Barrio</span>
                <select
                  value={zonaEntrega}
                  onChange={(e) => setZonaEntrega(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                >
                  {(ZONAS_AGRUPADAS.find((g) => g.id === grupoZonaSel)?.barrios || []).map((barrio) => (
                    <option key={barrio} value={barrio}>{barrio}</option>
                  ))}
                </select>
              </label>
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setMostrarMapaZonas((v) => !v)}
                  className="font-body text-[12px] text-teal font-semibold underline"
                >
                  {mostrarMapaZonas ? 'Ocultar mapa de zonas' : 'Ver mapa de zonas y costos de envío'}
                </button>
                {mostrarMapaZonas && (
                  <div className="mt-2">
                    <MapaZonasPotosi zonaSeleccionada={zonaEntrega} />
                  </div>
                )}
              </div>
              <label className="block text-left mb-3">
                <span className="font-body text-[11px] text-inksoft block mb-1">Dirección</span>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, número, barrio"
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                />
              </label>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={usarMiUbicacion}
                  disabled={buscandoUbicacion}
                  className="font-body text-[12px] text-teal font-semibold underline disabled:opacity-60"
                >
                  {buscandoUbicacion ? 'Buscando ubicación...' : lat != null ? '📍 Ubicación guardada ✓ (volver a compartir)' : '📍 Compartir mi ubicación'}
                </button>
                <div className="font-body text-[11px] text-inksoft mt-1">
                  Ayuda a que la moto arme la ruta más corta para llegar antes.
                </div>
              </div>
            </>
          ) : (
            <>
              {consultandoVendedores ? (
                <div className="font-body text-[12px] text-inksoft mb-4 bg-panelalt border border-line rounded-lg p-3">
                  Verificando cómo podés pagarle a cada vendedor...
                </div>
              ) : algunVendedorConQR ? (
                <>
                  <div className="font-body text-[12px] text-inksoft mb-4 bg-panelalt border border-line rounded-lg p-3">
                    Coordinás el retiro directo con cada vendedor por WhatsApp una vez que confirmes el pago.
                  </div>
                  <label className="block text-left mb-4">
                    <span className="font-body text-[11px] text-inksoft block mb-1.5">¿Cómo pagás?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMetodoPago('qr')}
                        className={`flex-1 py-2 rounded-lg border font-body text-[13px] font-semibold ${
                          metodoPago === 'qr' ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'
                        }`}
                      >
                        QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetodoPago('efectivo')}
                        className={`flex-1 py-2 rounded-lg border font-body text-[13px] font-semibold ${
                          metodoPago === 'efectivo' ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'
                        }`}
                      >
                        Efectivo
                      </button>
                    </div>
                  </label>
                </>
              ) : (
                /* Ningún vendedor del carrito tiene QR cargado todavía:
                   no hay a quién pagarle por ahí, así que se coordina
                   todo por WhatsApp directo. */
                <div className="font-body text-[12px] text-inksoft mb-4 bg-panelalt border border-line rounded-lg p-3">
                  Coordinás el pago y el retiro directo con cada vendedor por WhatsApp.
                </div>
              )}
            </>
          )}

          {/* Detalle de lo que se está comprando — antes solo se veía el
              subtotal, sin poder revisar qué productos eran. Ahora
              también se puede ajustar la cantidad o sacar un producto
              sin tener que volver atrás a la tienda. */}
          <div className="mb-4">
            <span className="font-body text-[11px] text-inksoft block mb-1.5">Tu pedido</span>
            <div className="border-t border-line divide-y divide-line">
              {items.map((it) => (
                <div key={`${it.id}__${it.tallaElegida || ''}__${it.colorElegida || ''}`} className="flex items-center justify-between gap-2 py-2.5 font-body text-[13px] text-ink">
                  <span className="flex-1 min-w-0">
                    {it.nombre}
                    {(it.tallaElegida || it.colorElegida) && (
                      <span className="block text-[11px] text-inksoft">
                        {[it.tallaElegida && `Talla ${it.tallaElegida}`, it.colorElegida].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(it, -1)}
                      className="w-6 h-6 border border-line rounded text-sm leading-none"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-[13px]">{it.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(it, 1)}
                      className="w-6 h-6 border border-line rounded text-sm leading-none"
                    >
                      +
                    </button>
                  </div>
                  <span className="shrink-0 w-16 text-right">{bs(it.precio * it.cantidad)}</span>
                  <button
                    type="button"
                    onClick={() => quitar(it)}
                    className="shrink-0 font-body text-[11px] text-maroon underline"
                  >
                    quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="font-body text-[12px] text-inksoft mb-1">Subtotal: {bs(subtotalCarrito)}</div>
          <div className="font-body text-[12px] text-inksoft mb-3">Envío: {bs(costoEnvio)}</div>
          <div className="font-display text-xl font-bold text-ink mb-4">{bs(subtotalCarrito + costoEnvio)}</div>
          <button
            onClick={confirmarEntregaYCrearPedidos}
            disabled={authCargando}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
          >
            {metodoEntrega === 'retiro' && metodoPago === 'efectivo' ? 'Continuar compra por WhatsApp' : 'Continuar al pago'}
          </button>
        </div>
      )}

      {etapa === 'creando' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center font-body text-sm text-inksoft">
          Preparando tu pedido...
        </div>
      )}

      {etapa === 'error' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          <div className="font-body text-sm text-maroon">{error}</div>
        </div>
      )}

      {etapa === 'pagando' && subPedidos[pasoActual] && subPedidos[pasoActual].estadoActual === 'verificando_stock' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          {subPedidos.length > 1 && (
            <div className="font-body text-[11px] text-inksoft mb-2">
              Pedido {pasoActual + 1} de {subPedidos.length}
            </div>
          )}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-ochresoft flex items-center justify-center text-3xl animate-pulse">
            🔍
          </div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            {subPedidos[pasoActual].vendedorNombre} está verificando el stock
          </div>
          <div className="font-body text-[13px] text-inksoft">
            No hace falta que hagas nada — en cuanto confirme, seguimos acá mismo.
          </div>
        </div>
      )}

      {etapa === 'pagando' && subPedidos[pasoActual] && subPedidos[pasoActual].estadoActual !== 'verificando_stock' && !pasosConfirmados.has(pasoActual) && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          {subPedidos.length > 1 && (
            <div className="font-body text-[11px] text-inksoft mb-2">
              Pedido {pasoActual + 1} de {subPedidos.length}
            </div>
          )}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-tealsoft flex items-center justify-center text-3xl">
            ✅
          </div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            El producto está disponible
          </div>
          <div className="font-body text-[13px] text-inksoft mb-5">
            {subPedidos[pasoActual].vendedorNombre} confirmó que tiene stock. Podés continuar con la compra.
          </div>
          <button
            onClick={() => setPasosConfirmados((prev) => new Set(prev).add(pasoActual))}
            className="w-full py-3 rounded-lg bg-maroon text-white font-body text-sm font-semibold"
          >
            Continuar con la compra
          </button>
        </div>
      )}

      {etapa === 'pagando' && subPedidos[pasoActual] && subPedidos[pasoActual].estadoActual !== 'verificando_stock' && pasosConfirmados.has(pasoActual) && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          {subPedidos.length > 1 && (
            <div className="font-body text-[11px] text-inksoft mb-2">
              Pago {pasoActual + 1} de {subPedidos.length}
            </div>
          )}
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            Pagale a {subPedidos[pasoActual].vendedorNombre}
          </div>
          <div className="font-body text-[13px] text-inksoft mb-5">
            {metodoEntrega === 'envio'
              ? 'Pagá'
              : subPedidos[pasoActual].cobroPropio
                ? 'Este vendedor cobra directo — el pago va a su cuenta, no a Clasi Click'
                : 'Este vendedor todavía no configuró su cobro — usá el QR general por ahora'}
          </div>

          {subPedidos[pasoActual].qrImageUrl ? (
            <img src={subPedidos[pasoActual].qrImageUrl} alt="Código QR de pago" loading="lazy" decoding="async" className="mx-auto w-48 rounded-lg border border-line" />
          ) : (
            <div className="text-left bg-panelalt border border-line rounded-lg p-4 font-body text-[13px] text-ink">
              {subPedidos[pasoActual].cbu ? (
                <div><strong>Cuenta / CBU:</strong> {subPedidos[pasoActual].cbu}</div>
              ) : (
                <>
                  {BANK_NAME && <div><strong>Banco:</strong> {BANK_NAME}</div>}
                  {BANK_ACCOUNT_NAME && <div><strong>Titular:</strong> {BANK_ACCOUNT_NAME}</div>}
                  {!BANK_NAME && <span className="text-inksoft">No hay datos de cobro configurados todavía.</span>}
                </>
              )}
            </div>
          )}

          <div className="font-display text-2xl font-bold text-ink mt-4 mb-1">{bs(subPedidos[pasoActual].total)}</div>
          {subPedidos[pasoActual].pedidoId && (
            <div className="font-body text-xs text-inksoft mb-5">
              Incluí la referencia <strong>#{subPedidos[pasoActual].pedidoId!.slice(0, 6)}</strong> en el pago si tu banco lo permite
            </div>
          )}

          <button
            onClick={declararPagoActual}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
          >
            Ya pagué
          </button>
        </div>
      )}

      {etapa === 'resumen' && metodoEntrega === 'retiro' && metodoPago === 'efectivo' && (
        <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center">
          <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">Pedido registrado</div>
          <div className="font-body text-[13px] text-inksoft">
            Coordiná el retiro y el pago directo por WhatsApp con el vendedor.
          </div>
        </div>
      )}

      {etapa === 'resumen' && !(metodoEntrega === 'retiro' && metodoPago === 'efectivo') && (
        <div>
          {subPedidos.every((s) => s.estadoActual === 'pagado') ? (
            <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center mb-4">
              <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
              <div className="font-display text-lg font-bold text-ink mb-1.5">Tu pedido está en marcha</div>
              {metodoEntrega === 'envio' ? (
                <div className="font-body text-[13px] text-inksoft">
                  Esperalo en la dirección que diste, {ventanaEntrega()}. Podés hacer el seguimiento acá abajo.
                </div>
              ) : (
                <div className="font-body text-[13px] text-inksoft">Los vendedores ya pueden preparar tu pedido.</div>
              )}
            </div>
          ) : (
            <div className="font-body text-sm text-inksoft mb-4 text-center">
              Avisamos a cada vendedor. Esto se actualiza solo a medida que van confirmando.
            </div>
          )}
          {subPedidos.map((s, i) => (
            <div key={i} className="bg-panel border border-line rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-body text-sm font-medium text-ink">{s.vendedorNombre}</span>
                <span className={`font-body text-[11px] font-semibold ${s.estadoActual === 'pagado' ? 'text-teal' : 'text-ochre'}`}>
                  {s.estadoActual === 'pagado' ? 'Pagado' : 'Esperando confirmación'}
                </span>
              </div>
              <div className="font-body text-xs text-inksoft mb-2">{bs(s.total)} · {s.items.length} producto(s)</div>
              {s.estadoActual === 'pagado' && s.pedidoId && (
                <Link
                  href={`/mis-pedidos/${s.pedidoId}`}
                  className="block text-center w-full py-2 rounded-lg border border-teal text-teal font-body text-xs font-semibold"
                >
                  Seguir mi pedido →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
