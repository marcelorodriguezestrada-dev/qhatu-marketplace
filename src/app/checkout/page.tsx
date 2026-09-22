'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCarrito, ItemCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { ZONAS_ENVIO_POTOSI, ZONAS_AGRUPADAS, grupoDeBarrio, barrioMasCercano, distanciaKm } from '@/data/zonasPotosi'
import { MapaZonasPotosi } from '@/components/MapaZonasPotosi'
import { leerComprobante, type ResultadoOCR } from '@/lib/ocrComprobante'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'
import { ProductIcon } from '@/components/ProductIcon'
import SelectorHorarioEntrega, { FRANJA_LABEL } from '@/components/SelectorHorarioEntrega'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// Ventana horaria aproximada de entrega, según a qué salida de la moto
// (8:00 o 14:00, ver src/lib/reparto.ts) entra un pedido pagado ahora
// mismo. Es una estimación para mostrarle al comprador, no un dato que
// se guarda — el horario real de reparto lo arma /admin con la ruta del
// día.
// Ya no calculamos una franja horaria de "hoy" — ahora la entrega es al
// día siguiente del pago, con horario todavía sin confirmar (lo
// coordina la moto directamente). Muestra la fecha de mañana en
// español, ej: "mañana, jueves 18 de septiembre".
function fechaEntregaTexto(fechaElegida?: string): string {
  if (fechaElegida) {
    const [y, m, d] = fechaElegida.split('-').map(Number)
    const fecha = new Date(y, m - 1, d)
    return fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  return `mañana, ${manana.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}`
}

function linkWhatsappRetiroEfectivo(s: SubPedido, nombreComprador: string): string {
  const detalle = s.items.map((it) => `${it.nombre} con foto de precio ${bs(it.precio)}`).join(', ')
  const texto = `Hola! Soy ${nombreComprador}. Quiero consultar sobre el producto ${detalle}.`
  return `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

type Etapa = 'entrega' | 'creando' | 'pagando' | 'esperando' | 'resumen' | 'error'

// Costo de envío por zona de Potosí — ver src/data/zonasPotosi.ts para
// las coordenadas y ajustar los precios reales.
const COSTOS_ENVIO: Record<string, number> = Object.fromEntries(ZONAS_ENVIO_POTOSI.map((z) => [z.nombre, z.costoEnvio]))
const COSTO_ENVIO_EXPRESS = 15

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
//
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
  const { usuario, cargando: authCargando, emailVerificado, obtenerToken } = useAuth()
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
  // Recién se muestran los campos de dirección/pago DESPUÉS de que el
  // comprador toca uno de los dos botones a propósito — antes, con
  // "envío" precargado por default, esos campos aparecían de entrada
  // sin que nadie eligiera nada, lo cual mareaba más de lo necesario.
  const [metodoElegido, setMetodoElegido] = useState(false)
  // Solo aplica cuando metodoEntrega es 'retiro' — con envío siempre es
  // QR (no tiene sentido pagar en efectivo algo que te llevan a domicilio
  // sin verse las caras).
  const [metodoPago, setMetodoPago] = useState<'qr' | 'efectivo'>('qr')

  // Envío express: en vez del costo por zona, un valor fijo — a cambio
  // de que la moto lo entregue el mismo día en vez de al día siguiente
  // (ver COSTO_ENVIO_EXPRESS más abajo). Solo aplica con envío, nunca
  // con retiro en tienda.
  const [envioExpress, setEnvioExpress] = useState(false)

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
  // Arranca vacío a propósito — hasta que el comprador no elige un
  // barrio, no mostramos ningún costo de envío (ver el resumen de
  // arriba de "¿Cómo lo recibís?"). Antes traía el primer barrio de la
  // lista precargado, así que el envío ya aparecía sin que nadie
  // hubiera elegido nada.
  const [zonaEntrega, setZonaEntrega] = useState('')
  // Qué "Zona 1/2/3" está elegida en el primer selector — el segundo
  // selector (el barrio) recién muestra las opciones de ese grupo.
  const [grupoZonaSel, setGrupoZonaSel] = useState(grupoDeBarrio(ZONAS_ENVIO_POTOSI[0].nombre)?.id || ZONAS_AGRUPADAS[0].id)
  const [mostrarMapaZonas, setMostrarMapaZonas] = useState(false)
  const [direccion, setDireccion] = useState('')
  const [entreCalles, setEntreCalles] = useState('')
  // Resultado de chequear la dirección contra OpenStreetMap:
  // - null    = todavía no se chequeó
  // - true    = la encontró → deja seguir
  // - false   = la consulta funcionó pero NO la encontró → esto SÍ
  //             bloquea, a pedido explícito (antes era solo un aviso,
  //             pero dejaba pasar cualquier cosa igual)
  // - 'error' = no se pudo ni consultar (Nominatim caído/sin red) → NO
  //             bloquea, porque no es culpa del comprador que un
  //             servicio gratis de terceros esté caído en ese momento
  const [direccionVerificada, setDireccionVerificada] = useState<boolean | 'error' | null>(null)
  const [verificandoDireccion, setVerificandoDireccion] = useState(false)
  const [motivoDireccion, setMotivoDireccion] = useState('')

  // Qué tan lejos del centro del barrio elegido puede caer la dirección
  // geocodificada y todavía darla por buena. Los barrios no tienen un
  // radio real (son polígonos, no círculos), así que este número es
  // generoso a propósito: alcanza para cubrir un barrio típico sin
  // rechazar direcciones válidas que caen cerca del borde, pero corta
  // cuando la dirección escrita claramente corresponde a otro barrio.
  const RADIO_BARRIO_KM = 1.5

  async function verificarDireccion(): Promise<boolean | 'error' | null> {
    if (!direccion.trim()) {
      setDireccionVerificada(null)
      return null
    }
    setVerificandoDireccion(true)
    try {
      const res = await fetch('/api/validar-direccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion }),
      })
      const data = await res.json()
      let resultado: boolean | 'error' | null = data.encontrada === null ? 'error' : !!data.encontrada
      let motivo = data.motivo || ''
      // Si la dirección sí se encontró en el mapa, todavía falta
      // chequear que quede cerca del barrio que el comprador eligió
      // arriba — Nominatim puede devolver una calle real que queda en
      // otro barrio de la ciudad, y hasta ahora eso pasaba sin avisar.
      if (resultado === true && zonaEntrega) {
        const barrioElegido = ZONAS_ENVIO_POTOSI.find((z) => z.nombre === zonaEntrega)
        if (barrioElegido) {
          const distancia = distanciaKm(data.lat, data.lng, barrioElegido.lat, barrioElegido.lng)
          if (distancia > RADIO_BARRIO_KM) {
            const cercano = barrioMasCercano(data.lat, data.lng)
            if (cercano.nombre !== zonaEntrega) {
              resultado = false
              motivo = `Esa dirección parece quedar en ${cercano.nombre}, no en ${zonaEntrega}. Revisá el barrio o la dirección.`
            }
          }
        }
      }
      setDireccionVerificada(resultado)
      setMotivoDireccion(motivo)
      // Si la persona no compartió su ubicación en vivo (más precisa),
      // usamos el punto que encontró Nominatim como mejor que nada —
      // ayuda a la moto igual, aunque sea aproximado a la calle.
      if (data.encontrada && lat == null && lng == null) {
        setLat(data.lat)
        setLng(data.lng)
      }
      return resultado
    } catch {
      setDireccionVerificada('error')
      return 'error'
    } finally {
      setVerificandoDireccion(false)
    }
  }
  // El nombre lo pedimos acá porque hoy ninguna cuenta lo tiene
  // garantizado — el registro solo pide email, contraseña y celular
  // (ver /login), así que sin esto el vendedor y el admin solo verían
  // un email en cada pedido, nunca un nombre real de a quién le están
  // vendiendo.
  const [nombreComprador, setNombreComprador] = useState('')
  const [whatsappComprador, setWhatsappComprador] = useState('')
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
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [resultadoOCR, setResultadoOCR] = useState<ResultadoOCR | null>(null)
  const [leyendoOCR, setLeyendoOCR] = useState(false)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  // Preferencia de entrega ya guardada (ver SelectorHorarioEntrega,
  // que hace el PATCH a /api/pedidos/[id] — acá solo se refleja el
  // resultado para el texto de arriba del resumen).
  const [franjaHoraria, setFranjaHoraria] = useState<'' | '8-13' | '13-19'>('')
  const [fechaElegida, setFechaElegida] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // uid de la persona que CREÓ el pedido. Firebase Auth sincroniza la
  // sesión entre pestañas del mismo navegador: si en otra pestaña se
  // entra con otra cuenta (por ejemplo la de admin), acá `usuario`
  // pasa a ser esa otra cuenta. El pedido sigue siendo del comprador
  // original, así que guardamos su uid aparte y lo usamos en vez de
  // `usuario.uid` para todo lo que tenga que ver con la espera.
  const uidCompradorRef = useRef<string | null>(null)
  // Espejo de subPedidos siempre actualizado, para que el intervalo del
  // polling no trabaje con una copia vieja capturada en el closure.
  const subPedidosRef = useRef<SubPedido[]>([])
  useEffect(() => {
    subPedidosRef.current = subPedidos
  }, [subPedidos])

  // ── La pantalla "Esperando la confirmación del pago" tiene que
  // sobrevivir a que el comprador salga de /checkout ─────────────────
  // Todo el estado del checkout (etapa, subPedidos, etc.) vive solo en
  // memoria de esta página: si la persona navega a otra ruta (por
  // ejemplo entra a /admin en la misma pestaña) el componente se
  // desmonta, y al volver arranca de cero en la etapa 'entrega' — el
  // mensaje de espera "desaparece" aunque el pedido siga en
  // 'informado_pago'. Por eso, mientras se espera, guardamos lo mínimo
  // en localStorage y lo restauramos al volver. El polling de más abajo
  // arranca solo en cuanto la etapa vuelve a ser 'esperando', así que si
  // el admin ya validó el pago mientras tanto, pasa directo al resumen.
  const claveEspera = `clasiclick_checkout_espera_${claveTienda || 'todas'}`
  const [restaurando, setRestaurando] = useState(true)

  useEffect(() => {
    if (authCargando) return
    try {
      const guardado = localStorage.getItem(claveEspera)
      if (guardado && usuario) {
        const d = JSON.parse(guardado)
        const vigente = typeof d?.guardadoAt === 'number' && Date.now() - d.guardadoAt < 48 * 60 * 60 * 1000
        if (vigente && d.uid === usuario.uid && Array.isArray(d.subPedidos) && d.subPedidos.length > 0) {
          uidCompradorRef.current = d.uid
          setSubPedidos(d.subPedidos)
          setMetodoEntrega(d.metodoEntrega === 'retiro' ? 'retiro' : 'envio')
          setMetodoPago(d.metodoPago === 'efectivo' ? 'efectivo' : 'qr')
          setEnvioExpress(!!d.envioExpress)
          setMetodoElegido(true)
          setEtapa('esperando')
        } else {
          // Vencido, o de otra cuenta que usó este mismo navegador.
          localStorage.removeItem(claveEspera)
        }
      }
    } catch {
      // JSON corrupto o localStorage bloqueado: se arranca normal.
    }
    setRestaurando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authCargando])

  // Precarga los datos que este comprador ya cargó en una compra
  // anterior (nombre, WhatsApp, barrio, dirección, entre calles) —
  // para no hacerlo escribir todo de nuevo cada vez. Recién se
  // consulta cuando ya sabemos que NO hay una espera para restaurar
  // (si no, pisaría los datos de un pedido en curso), y solo completa
  // los campos que sigan vacíos, por si la persona ya empezó a
  // escribir algo distinto.
  useEffect(() => {
    if (restaurando || etapa !== 'entrega' || !usuario) return
    let cancelado = false
    ;(async () => {
      try {
        const token = await obtenerToken()
        if (!token) return
        const res = await fetch('/api/usuarios/datos-envio', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        const d = data.datosEnvio
        if (!d || cancelado) return
        setNombreComprador((prev) => prev || d.nombreComprador || '')
        setWhatsappComprador((prev) => prev || d.whatsappComprador || '')
        setZonaEntrega((prev) => prev || d.zonaEntrega || '')
        setDireccion((prev) => prev || d.direccion || '')
        setEntreCalles((prev) => prev || d.entreCalles || '')
      } catch {
        // Sin datos guardados (o falló la consulta): el comprador
        // arranca con el formulario vacío, como siempre.
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurando, usuario])

  useEffect(() => {
    if (restaurando) return
    try {
      const cancelada = subPedidos.some((s) => s.estadoActual === 'cancelado')
      // Siempre el uid del comprador original, aunque `usuario` haya
      // cambiado por un login en otra pestaña (si no, al volver el
      // guardado quedaría a nombre del admin y se descartaría).
      const uidGuardar = uidCompradorRef.current ?? usuario?.uid ?? null
      if (etapa === 'esperando' && uidGuardar && !cancelada) {
        uidCompradorRef.current = uidGuardar
        localStorage.setItem(
          claveEspera,
          JSON.stringify({ uid: uidGuardar, guardadoAt: Date.now(), subPedidos, metodoEntrega, metodoPago, envioExpress })
        )
      } else if (etapa === 'resumen' || (etapa === 'esperando' && cancelada)) {
        // Ya se confirmó (o se canceló): no hay nada más que esperar.
        localStorage.removeItem(claveEspera)
      }
    } catch {
      // Sin localStorage la pantalla sigue funcionando, solo que no sobrevive a salir.
    }
  }, [restaurando, etapa, subPedidos, usuario, metodoEntrega, metodoPago, envioExpress, claveEspera])

  function salirDeEspera() {
    try {
      localStorage.removeItem(claveEspera)
    } catch {}
    router.push('/')
  }

  // Concretar una compra requiere estar logueado Y con el email
  // verificado (regla de toda la plataforma) — si alguien llega hasta
  // acá sin cuenta, o con una cuenta todavía sin verificar, lo mandamos
  // a /login antes de dejarlo seguir.
  //
  // OJO: este chequeo es solo para ENTRAR al checkout. Una vez que el
  // pedido ya se creó (pagando / esperando / resumen) no se vuelve a
  // mirar la sesión: si en otra pestaña se cierra sesión o se entra con
  // otra cuenta (ej. admin), Firebase lo sincroniza acá, `usuario`
  // cambia, y antes esto mandaba a /login — que a su vez rebotaba a la
  // home al ver una cuenta ya logueada. La pantalla de espera no
  // necesita la sesión: el polling a /api/pedidos/[id] es público.
  const pedidoYaCreado =
    etapa === 'pagando' || etapa === 'esperando' || etapa === 'resumen' || subPedidos.some((s) => !!s.pedidoId)

  useEffect(() => {
    if (authCargando) return
    if (pedidoYaCreado) return
    if (!usuario || emailVerificado === false) router.push('/login')
  }, [authCargando, usuario, emailVerificado, router, pedidoYaCreado])

  const costoEnvio = metodoEntrega === 'retiro' ? 0 : envioExpress ? COSTO_ENVIO_EXPRESS : (COSTOS_ENVIO[zonaEntrega] ?? 0)
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
    if (!nombreComprador.trim()) {
      setError('Escribí tu nombre y apellido antes de continuar.')
      return
    }
    if (!whatsappComprador.trim()) {
      setError('Escribí tu WhatsApp antes de continuar — lo necesitamos para el comprobante y para avisarte del pedido.')
      return
    }
    const validacionWhatsapp = validarWhatsappBoliviano(whatsappComprador)
    if (!validacionWhatsapp.valido) {
      setError(validacionWhatsapp.motivo || 'Revisá tu número de WhatsApp.')
      return
    }
    if (metodoEntrega === 'envio' && !zonaEntrega) {
      setError('Elegí tu barrio antes de continuar.')
      return
    }
    if (metodoEntrega === 'envio' && !direccion.trim()) {
      setError('Escribí tu dirección antes de continuar.')
      return
    }
    if (metodoEntrega === 'envio') {
      // Si todavía no se chequeó (por ejemplo, escribió y tocó
      // "Continuar" sin salir del campo de dirección), la chequeamos
      // recién acá — no dejamos pasar una dirección sin verificar.
      let resultado = direccionVerificada
      if (resultado === null) {
        resultado = await verificarDireccion()
      }
      if (resultado === false) {
        setError(motivoDireccion || 'No encontramos esa dirección — revisala antes de continuar.')
        return
      }
      // resultado === true, o 'error' (el servicio de verificación
      // falló) — en los dos casos se deja continuar.
    }
    if (metodoEntrega === 'envio' && !entreCalles.trim()) {
      setError('Escribí entre qué calles queda tu dirección antes de continuar — ayuda mucho a que la moto no se pierda.')
      return
    }

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
            nombreComprador,
            whatsappComprador,
            vendedorId,
            vendedorNombre,
            vendedorWhatsapp: whatsappVendedor,
            zonaEntrega,
            direccion,
            entreCalles: entreCalles || null,
            lat: metodoEntrega === 'envio' ? lat : null,
            lng: metodoEntrega === 'envio' ? lng : null,
            costoEnvio: envioGrupo,
            metodoEntrega,
            metodoPago: metodoPagoGrupo,
            envioExpress: metodoEntrega === 'envio' ? envioExpress : false,
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
          // Antes acá se ponía 'verificando_stock' y el comprador se
          // quedaba esperando a que el vendedor confirme. Ahora el
          // comprador sigue directo como si el producto ya estuviera
          // disponible — el pedido en la base SIGUE guardándose con
          // estado 'verificando_stock' (eso no cambió, ver
          // /api/pedidos), así que el vendedor y el admin lo siguen
          // viendo para confirmar el stock desde /mis-pedidos o
          // /admin. Si no había stock, se soluciona por WhatsApp
          // después, no bloqueando el pago acá.
          estadoActual: 'pendiente_pago',
        })
      }

      uidCompradorRef.current = usuario?.uid ?? null
      setSubPedidos(nuevos)
      setPasoActual(0)

      // Guardamos estos datos para la próxima compra — no bloquea nada
      // si falla (la compra ya se hizo), por eso no se espera ni se
      // muestra ningún error acá.
      obtenerToken()
        .then((token) => {
          if (!token) return
          fetch('/api/usuarios/datos-envio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ nombreComprador, whatsappComprador, zonaEntrega, direccion, entreCalles }),
          }).catch(() => {})
        })
        .catch(() => {})

      if (abrirWhatsappDirecto) {
        // Como el checkout ahora es siempre de UNA tienda a la vez, acá
        // solo hay un subPedido — le llevamos directo a WhatsApp con el
        // detalle del pedido, sin ninguna pantalla intermedia de por
        // medio.
        const link = nuevos[0] ? linkWhatsappRetiroEfectivo(nuevos[0], nombreComprador) : null
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

  // Confirma el pago DENTRO de la app. Exige comprobante subido — sin
  // eso no se puede avanzar (antes era opcional y el paso real pasaba
  // por WhatsApp; ahora WhatsApp es un extra).
  function declararPagoActual() {
    const sub = subPedidos[pasoActual]
    if (!sub.pedidoId) return
    if (!comprobanteUrl) {
      setError('Subí la foto del comprobante para confirmar el pago.')
      return
    }
    setError('')

    fetch(`/api/pedidos/${sub.pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'informado_pago',
        comprobanteUrl,
        // Guardamos lo que leyó el OCR para que el vendedor lo vea al
        // confirmar — le ahorra tener que comparar el monto a ojo.
        ocrMonto: resultadoOCR?.montoDetectado ?? null,
        ocrCoincide: resultadoOCR?.coincide ?? null,
      }),
    }).then(() => {
      setSubPedidos((prev) => prev.map((s, i) => (i === pasoActual ? { ...s, declarado: true, estadoActual: 'informado_pago' } : s)))
      setComprobanteUrl('')
      setResultadoOCR(null)
      if (pasoActual < subPedidos.length - 1) {
        setPasoActual(pasoActual + 1)
      } else {
        // No vamos directo al resumen: primero hay que esperar a que el
        // vendedor confirme el pago. Recién ahí tiene sentido elegir
        // horario de entrega.
        setEtapa('esperando')
      }
    })
  }

  async function subirComprobante(file: File | null) {
    if (!file) return
    setSubiendoComprobante(true)
    setError('')
    setResultadoOCR(null)

    // El OCR arranca en paralelo y NUNCA bloquea la subida: si tarda o
    // falla (conexión lenta, foto borrosa), el comprobante igual queda
    // subido y el comprador puede seguir. Es una ayuda, no un filtro.
    const montoEsperado = subPedidos[pasoActual]?.total ?? 0
    setLeyendoOCR(true)
    leerComprobante(file, montoEsperado)
      .then((r) => setResultadoOCR(r))
      .catch((e) => console.error('OCR falló, se ignora:', e))
      .finally(() => setLeyendoOCR(false))

    try {
      const token = await obtenerToken()
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setComprobanteUrl(data.url)
    } catch (e: any) {
      setError(e.message || 'No se pudo subir la imagen.')
    } finally {
      setSubiendoComprobante(false)
    }
  }

  // Antes acá había un polling que consultaba cada 4 segundos si el
  // vendedor ya había confirmado el stock, para sacar al comprador de
  // la pantalla de espera. Ya no hace falta: el comprador nunca entra
  // a ese estado del lado del cliente (ver más arriba), así que no
  // hay nada que esperar ni que consultar acá.

  useEffect(() => {
    // Corre tanto en la pantalla de espera como en el resumen: es lo que
    // detecta que el vendedor confirmó el pago.
    if (etapa !== 'esperando' && etapa !== 'resumen') return
    // Retiro + efectivo se coordina por WhatsApp, no acá adentro — no
    // hay ningún "pagado" digital que esperar, así que no tiene sentido
    // consultar el servidor cada 4 segundos para nada.
    if (metodoEntrega === 'retiro' && metodoPago === 'efectivo') return

    let cancelado = false

    async function consultar() {
      // Leemos el estado más fresco con el updater de React en vez de
      // la variable capturada por el closure — si no, cada tick del
      // intervalo trabaja con la lista congelada del primer render y
      // pisa lo que ya se había actualizado.
      const actuales = subPedidosRef.current
      const actualizados = await Promise.all(
        actuales.map(async (s) => {
          if (!s.pedidoId || s.estadoActual === 'pagado' || s.estadoActual === 'cancelado') return s
          try {
            const res = await fetch(`/api/pedidos/${s.pedidoId}`)
            const data = await res.json()
            return { ...s, estadoActual: data.estado || s.estadoActual }
          } catch {
            // Un fallo de red puntual no tiene que sacar al comprador de
            // la pantalla ni "resetear" nada: dejamos el estado como
            // está y reintentamos en el próximo tick.
            return s
          }
        })
      )
      if (cancelado) return
      setSubPedidos(actualizados)

      if (actualizados.every((s) => s.estadoActual === 'pagado')) {
        if (pollRef.current) clearInterval(pollRef.current)
        // Solo sacamos del carrito lo que se pagó en ESTA compra (no toda
        // la tienda): si el comprador volvió días después con productos
        // nuevos en el carrito, esos no se tocan.
        for (const s of actualizados) for (const it of s.items) quitar(it)
        setEtapa('resumen')
      } else if (actualizados.some((s) => s.estadoActual === 'cancelado')) {
        // Cancelado desde /admin: no tiene sentido seguir consultando.
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }

    consultar()
    pollRef.current = setInterval(consultar, 4000)
    return () => {
      cancelado = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa])

  // Hasta no saber si hay una espera guardada, no mostramos ni el
  // formulario ni "carrito vacío" (se vería un parpadeo antes de
  // restaurar la pantalla de espera).
  if (restaurando) return null

  const pedidoCancelado = subPedidos.some((s) => s.estadoActual === 'cancelado')

  // Ojo: 'esperando' tiene que estar contemplado acá. Si no, en cuanto
  // el carrito queda vacío (o el usuario recarga), el comprador sale
  // disparado a "Tu carrito está vacío" justo mientras espera que le
  // confirmen el pago — que es exactamente cuando NO hay que sacarlo.
  if (items.length === 0 && etapa !== 'resumen' && etapa !== 'esperando') {
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
          {/* Detalle de lo que se está comprando, con foto de cada
              producto — va primero para que el comprador vea qué está
              llevando antes de meterse a elegir método de entrega. */}
          <div className="mb-5">
            <div className="font-display text-lg font-bold text-ink mb-3">Tu pedido</div>
            <div className="border-t border-line divide-y divide-line">
              {items.map((it) => (
                <div key={`${it.id}__${it.tallaElegida || ''}__${it.colorElegida || ''}`} className="py-3 font-body text-[13px] text-ink">
                  <div className="flex items-center gap-3 mb-2">
                    {(it.thumbUrl || it.imagenUrl) ? (
                      <img
                        src={it.thumbUrl || it.imagenUrl}
                        alt={it.nombre}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-line bg-panelalt shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 leading-snug">
                      {it.nombre}
                      {(it.tallaElegida || it.colorElegida) && (
                        <span className="block text-[11px] text-inksoft">
                          {[it.tallaElegida && `Talla ${it.tallaElegida}`, it.colorElegida].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-[60px]">
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
                    <span className="shrink-0">{bs(it.precio * it.cantidad)}</span>
                    <button
                      type="button"
                      onClick={() => quitar(it)}
                      className="shrink-0 font-body text-[11px] text-maroon underline"
                    >
                      quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-panelalt rounded-lg px-3.5 py-3 mb-5">
            <div className="font-body text-[12px] text-inksoft mb-0.5">Subtotal: {bs(subtotalCarrito)}</div>
            {metodoEntrega === 'envio' && zonaEntrega && (
              <div className="font-body text-[12px] text-inksoft mb-1">
                {envioExpress ? 'Envío express' : 'Envío'}: {bs(costoEnvio)}
              </div>
            )}
            <div className="font-display text-xl font-bold text-ink">{bs(subtotalCarrito + costoEnvio)}</div>
          </div>

          <div className="font-display text-lg font-bold text-ink mb-3">¿Cómo quieres recibir tu pedido?</div>

          <div className="flex gap-1 p-1 mb-4 bg-panelalt rounded-full">
            <button
              type="button"
              onClick={() => { setMetodoEntrega('envio'); setMetodoElegido(true) }}
              className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all ${
                metodoElegido && metodoEntrega === 'envio' ? 'bg-ink text-white shadow-sm' : 'text-inksoft'
              }`}
            >
              🛵 Envío
            </button>
            <button
              type="button"
              onClick={() => { setMetodoEntrega('retiro'); setMetodoElegido(true) }}
              className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all ${
                metodoElegido && metodoEntrega === 'retiro' ? 'bg-ink text-white shadow-sm' : 'text-inksoft'
              }`}
            >
              🏬 Retiro en tienda
            </button>
          </div>

          {!metodoElegido && (
            <div className="font-body text-[12px] text-inksoft mb-2">Elegí una opción para seguir.</div>
          )}

          {metodoElegido && (
          <>
          <label className="block text-left mb-4">
            <span className="font-body text-[11px] text-inksoft block mb-1">Tu nombre *</span>
            <input
              value={nombreComprador}
              onChange={(e) => setNombreComprador(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
            />
          </label>

          <label className="block text-left mb-4">
            <span className="font-body text-[11px] text-inksoft block mb-1">Tu WhatsApp *</span>
            <input
              value={whatsappComprador}
              onChange={(e) => setWhatsappComprador(e.target.value)}
              placeholder="Ej: 71234567"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
            />
            <span className="font-body text-[11px] text-inksoft block mt-1">
              Para mandar el comprobante de pago y avisarte cuando esté confirmado.
            </span>
          </label>

          {metodoEntrega === 'envio' ? (
            <>
              <label className="block text-left mb-3">
                <span className="font-body text-[11px] text-inksoft block mb-1">Barrio</span>
                <select
                  value={zonaEntrega}
                  onChange={(e) => {
                    setZonaEntrega(e.target.value)
                    // Si ya había una dirección validada contra el barrio
                    // anterior, ese resultado queda viejo apenas cambia el
                    // barrio — se vuelve a chequear recién al salir del
                    // campo de dirección (o al tocar "Continuar").
                    setDireccionVerificada(null)
                    setMotivoDireccion('')
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                >
                  <option value="">Elegí tu barrio</option>
                  {ZONAS_ENVIO_POTOSI.map((z) => (
                    <option key={z.nombre} value={z.nombre}>{z.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-2.5 mb-3 bg-ochresoft border border-ochre rounded-lg px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={envioExpress}
                  onChange={(e) => setEnvioExpress(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="font-body text-[13px] text-ink">
                  <strong>🚀 Envío express — {bs(COSTO_ENVIO_EXPRESS)}</strong>
                  <br />
                  Tu pedido llega hoy mismo (en vez del costo por barrio y la entrega al día siguiente).
                </span>
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

              <label className="block text-left mb-1">
                <span className="font-body text-[11px] text-inksoft block mb-1">Dirección *</span>
                <input
                  value={direccion}
                  onChange={(e) => {
                    setDireccion(e.target.value)
                    setDireccionVerificada(null)
                    setMotivoDireccion('')
                  }}
                  onBlur={verificarDireccion}
                  placeholder="Calle, número, barrio"
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                />
              </label>
              <div className="mb-3 min-h-[16px]">
                {verificandoDireccion && (
                  <span className="font-body text-[11px] text-inksoft">Verificando dirección...</span>
                )}
                {!verificandoDireccion && direccionVerificada === true && (
                  <span className="font-body text-[11px] text-teal">✓ Encontramos esta dirección en el mapa.</span>
                )}
                {!verificandoDireccion && direccionVerificada === false && (
                  <span className="font-body text-[11px] text-maroon">
                    ⚠ {motivoDireccion || 'No encontramos esa dirección — revisá que esté bien escrita.'}
                  </span>
                )}
                {!verificandoDireccion && direccionVerificada === 'error' && (
                  <span className="font-body text-[11px] text-ochre">
                    No pudimos verificarla ahora (problema de conexión) — podés continuar igual.
                  </span>
                )}
              </div>
              <label className="block text-left mb-3">
                <span className="font-body text-[11px] text-inksoft block mb-1">Entre calles *</span>
                <input
                  value={entreCalles}
                  onChange={(e) => setEntreCalles(e.target.value)}
                  placeholder="Ej: entre Bolívar y Junín"
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                />
              </label>
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
                   todo por WhatsApp directo (sin mensaje explicativo
                   acá — se explica solo en el paso siguiente). */
                null
              )}
            </>
          )}

          {error && (
            <div className="font-body text-xs text-maroon mb-3">{error}</div>
          )}

          <button
            onClick={confirmarEntregaYCrearPedidos}
            disabled={authCargando}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
          >
            {metodoEntrega === 'retiro' && metodoPago === 'efectivo' ? 'Continuar compra por WhatsApp' : 'Continuar al pago'}
          </button>
          </>
          )}
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

      {/* Ya no existe la pantalla de "verificando stock" del lado del
          comprador, ni la de "el producto está disponible, confirmá
          para seguir" (ver la nota en confirmarEntregaYCrearPedidos)
          — se pasa directo al paso de pago de acá abajo. */}

      {etapa === 'pagando' && subPedidos[pasoActual] && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          {subPedidos.length > 1 && (
            <div className="font-body text-[11px] text-inksoft mb-2">
              Pago {pasoActual + 1} de {subPedidos.length}
            </div>
          )}
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-tealsoft flex items-center justify-center text-2xl">
            ✅
          </div>

          {/* Resumen de lo que se está pagando, antes del QR -- para
              que quede clara la compra justo en el momento de pagar,
              no solo más arriba en el paso de entrega. */}
          <div className="text-left bg-panelalt border border-line rounded-lg p-3.5 mb-4">
            <div className="font-body text-[11px] text-inksoft mb-1.5">Estás pagando</div>
            <div className="divide-y divide-line">
              {subPedidos[pasoActual].items.map((it, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className="w-9 h-9 rounded-md bg-panel border border-line overflow-hidden shrink-0 flex items-center justify-center">
                    {it.thumbUrl || it.imagenUrl ? (
                      <img src={it.thumbUrl || it.imagenUrl} alt={it.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <ProductIcon kind={it.icono} size={16} />
                    )}
                  </div>
                  <span className="flex-1 min-w-0 font-body text-[13px] text-ink">{it.cantidad} × {it.nombre}</span>
                  <span className="shrink-0 font-body text-[13px] text-ink">{bs(it.precio * it.cantidad)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-line font-body text-[13px] text-inksoft">
              <span>Subtotal</span>
              <span>{bs(subPedidos[pasoActual].subtotal)}</span>
            </div>
            {subPedidos[pasoActual].costoEnvio > 0 && (
              <div className="flex items-center justify-between font-body text-[13px] text-inksoft">
                <span>Envío</span>
                <span>{bs(subPedidos[pasoActual].costoEnvio)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 font-body text-sm font-bold text-ink">
              <span>Total a Pagar</span>
              <span>{bs(subPedidos[pasoActual].total)}</span>
            </div>
          </div>

          <div className="font-body text-base font-bold text-ink bg-ochresoft border border-ochre rounded-lg px-4 py-3 mb-4 text-center">
            Descargá el QR para el pago y, una vez realizado, volvé a esta página y subí el comprobante.
          </div>

          <div className="font-body text-[13px] text-ink font-medium mb-3">
            Pagá con el QR
          </div>
          {metodoEntrega !== 'envio' && (
            <div className="font-body text-[13px] text-inksoft mb-5">
              {subPedidos[pasoActual].cobroPropio
                ? 'Este vendedor cobra directo — el pago va a su cuenta, no a Clasi Click'
                : 'Este vendedor todavía no configuró su cobro — usá el QR general por ahora'}
            </div>
          )}

          {subPedidos[pasoActual].qrImageUrl ? (
            <>
              <img src={subPedidos[pasoActual].qrImageUrl} alt="Código QR de pago" loading="lazy" decoding="async" className="mx-auto w-48 rounded-lg border border-line mt-2" />
              <a
                href={subPedidos[pasoActual].qrImageUrl}
                download="qr-pago.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mt-3 w-full py-3 rounded-lg border-2 border-teal text-teal bg-tealsoft font-body text-sm font-bold"
              >
                ⬇ Descargar QR
              </a>
            </>
          ) : (
            <div className="text-left bg-panelalt border border-line rounded-lg p-4 font-body text-[13px] text-ink mt-2">
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

          <div className="font-display text-2xl font-bold text-ink mt-4 mb-4">{bs(subPedidos[pasoActual].total)}</div>

          <div className="text-left mb-4">
            <div className="font-body text-[13px] text-ink font-medium mb-2">
              📎 Subí la foto del comprobante
            </div>
            {comprobanteUrl ? (
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <img src={comprobanteUrl} alt="Comprobante" className="w-14 h-14 rounded-lg object-cover border border-line" />
                  <div className="flex-1">
                    <div className="font-body text-xs text-teal">✓ Comprobante subido</div>
                    <button
                      type="button"
                      onClick={() => { setComprobanteUrl(''); setResultadoOCR(null) }}
                      className="font-body text-[11px] text-inksoft underline"
                    >
                      Sacar y subir otra
                    </button>
                  </div>
                </div>

                {leyendoOCR && (
                  <div className="font-body text-[11px] text-inksoft">Leyendo el comprobante...</div>
                )}
                {!leyendoOCR && resultadoOCR?.coincide === true && (
                  <div className="font-body text-[11px] text-teal bg-tealsoft border border-teal rounded-lg px-2.5 py-2">
                    ✓ Leímos {bs(resultadoOCR.montoDetectado!)} en el comprobante — coincide con el total
                    {resultadoOCR.fechaDetectada && ` · ${resultadoOCR.fechaDetectada}`}
                  </div>
                )}
                {!leyendoOCR && resultadoOCR?.coincide === false && (
                  <div className="font-body text-[11px] text-maroon bg-maroonsoft border border-maroon rounded-lg px-2.5 py-2">
                    ⚠ Leímos {bs(resultadoOCR.montoDetectado!)} y el total es {bs(subPedidos[pasoActual].total)}. Revisá que sea el comprobante correcto — igual podés continuar y el vendedor lo verifica.
                  </div>
                )}
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  disabled={subiendoComprobante}
                  onChange={(e) => subirComprobante(e.target.files?.[0] || null)}
                  className="font-body text-xs text-inksoft"
                />
                {subiendoComprobante && <div className="font-body text-xs text-inksoft mt-1.5">Subiendo...</div>}
              </>
            )}
          </div>

          {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}

          <button
            onClick={declararPagoActual}
            disabled={!comprobanteUrl || subiendoComprobante}
            className="w-full py-3 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-40"
          >
            ✓ Continuar
          </button>
        </div>
      )}

      {etapa === 'esperando' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          <div
            className={`w-11 h-11 rounded-full text-white flex items-center justify-center mx-auto mb-3.5 text-xl ${
              pedidoCancelado ? 'bg-maroon' : 'bg-ochre animate-pulse'
            }`}
          >
            {pedidoCancelado ? '✕' : '⏳'}
          </div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            {pedidoCancelado ? 'Pedido cancelado' : 'Esperando la confirmación del pago'}
          </div>

          {pedidoCancelado ? (
            <>
              <div className="font-body text-[13px] text-inksoft mb-4">
                El vendedor canceló este pedido. Si ya pagaste, comunicate con él por WhatsApp para coordinar.
              </div>
              <button
                type="button"
                onClick={salirDeEspera}
                className="w-full py-2.5 rounded-lg border border-line bg-transparent font-body text-xs font-semibold text-inksoft mb-4"
              >
                Volver a la tienda
              </button>
            </>
          ) : (
            <div className="font-body text-[12px] text-inksoft bg-panelalt border border-line rounded-lg px-3 py-2.5 mb-4">
              No cierres esta pantalla — se actualiza sola. Si prefieres cerrarla, puedés seguir tu pedido desde{' '}
              <Link href="/mis-pedidos" className="text-maroon underline">Mis pedidos</Link>.
            </div>
          )}

          {subPedidos.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-2 border-t border-line">
              <span className="font-body text-xs text-ink truncate"> </span>
              <span
                className={`font-body text-[11px] font-semibold shrink-0 ${
                  s.estadoActual === 'pagado' ? 'text-teal' : s.estadoActual === 'cancelado' ? 'text-maroon' : 'text-ochre'
                }`}
              >
                {s.estadoActual === 'pagado' ? '✓ Confirmado' : s.estadoActual === 'cancelado' ? '✕ Cancelado' : 'Revisando...'}
              </span>
            </div>
          ))}
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
              <div className="font-display text-lg font-bold text-ink mb-1.5">Su compra se ha realizado con éxito!</div>
              {metodoEntrega === 'envio' ? (
                <div className="font-body text-[13px] text-inksoft">
                  {envioExpress
                    ? `El producto te llegará hoy${franjaHoraria ? `, en el horario de ${FRANJA_LABEL[franjaHoraria]}` : ', horario a confirmar'}.`
                    : `Estará recibiendo el pedido ${fechaEntregaTexto(fechaElegida)}${
                        franjaHoraria ? `, en el horario de ${FRANJA_LABEL[franjaHoraria]}` : ', horario a confirmar'
                      }.`}
                </div>
              ) : (
                <div className="font-body text-[13px] text-inksoft">Los vendedores ya pueden preparar tu pedido.</div>
              )}
            </div>
          ) : null}

          {/* Franja horaria de entrega — solo para envío, una vez
              confirmado el pago. Es una preferencia, no una garantía
              exacta (el reparto todavía depende de la moto/vendedor),
              por eso el texto dice "de" y no "a las". */}
          {metodoEntrega === 'envio' && subPedidos.every((s) => s.estadoActual === 'pagado') && (
            <div className="bg-panel border border-line rounded-xl p-4 mb-3">
              <SelectorHorarioEntrega
                pedidoIds={subPedidos.filter((s) => !!s.pedidoId).map((s) => s.pedidoId as string)}
                franjaInicial={franjaHoraria}
                fechaInicial={fechaElegida || null}
                soloHoy={envioExpress}
                onGuardado={({ franjaHoraria: f, fechaEntrega }) => {
                  setFranjaHoraria(f)
                  setFechaElegida(fechaEntrega || '')
                }}
              />
            </div>
          )}
          {subPedidos.map((s, i) => (
            <div key={i} className="bg-panel border border-line rounded-lg p-4 mb-3">
              <div className="flex items-center justify-end mb-1">
                <span className={`font-body text-[11px] font-semibold ${s.estadoActual === 'pagado' ? 'text-teal' : 'text-ochre'}`}>
                  {s.estadoActual === 'pagado' ? 'Pagado' : 'Esperando confirmación — te avisamos apenas se confirme'}
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