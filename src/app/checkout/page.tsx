'use client'

import { leerCampana } from '@/lib/campana'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useCiudad } from '@/lib/ciudad'
import { ciudadDe, envioPropioLlegaA, type CiudadId, type EnvioPropio } from '@/data/ciudades'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCarrito, ItemCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { ZONAS_ENVIO_POTOSI, ZONAS_AGRUPADAS, grupoDeBarrio, distanciaKm, costoPorDistancia } from '@/data/zonasPotosi'
import { validarDireccion, validarEntreCalles, validarZona, zonaLibreValida } from '@/lib/validarEntrega'
import { entreCallesNoCoinciden, type EntreCallesInfo } from '@/lib/entreCalles'
import InputSugerencias from '@/components/InputSugerencias'
import QrLimpio from '@/components/QrLimpio'
import { OPCIONES_CHECKOUT_DEFECTO, type OpcionesCheckout } from '@/lib/opcionesCheckout'
import { coincideInicio, leerDatosUsados, mezclarConCuenta, recordarDatos, type DatosUsados, type DireccionUsada } from '@/lib/datosUsados'
import { buscarZonaEn, normZona, zonaMasCercana, zonasCercanas } from '@/lib/zonasEnvio'
import { useZonasEnvio } from '@/lib/useZonasEnvio'
import { ElegirUbicacion } from '@/components/ElegirUbicacion'
import { leerComprobante, comprobanteValido, motivoRechazo, MAX_INTENTOS_COMPROBANTE, type ResultadoOCR } from '@/lib/ocrComprobante'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'
import { ProductIcon } from '@/components/ProductIcon'
import SelectorHorarioEntrega, { type Franja } from '@/components/SelectorHorarioEntrega'
import { evaluarCupon, tomarCuponPendiente, type Cupon } from '@/lib/cupones'
import { track } from '@/lib/tracking'
import { fechaEntregaDefault, hayEntregaHoy, envioExpressDisponible, HORA_CORTE_EXPRESS, tiendaAbierta, mensajeTiendaCerrada } from '@/lib/entregaDias'

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
  const hoy = new Date()
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)
  const entrega = fechaEntregaDefault(hoy)
  const fechaLegible = entrega.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
  // Si mañana cae domingo, la entrega se corre al lunes — ahí ya no
  // tiene sentido decir "mañana" (no lo es).
  const esRealmenteManana = entrega.toDateString() === manana.toDateString()
  return esRealmenteManana ? `mañana, ${fechaLegible}` : fechaLegible
}

function linkWhatsappRetiroEfectivo(s: SubPedido, nombreComprador: string, envio?: { direccion: string; referencia?: string } | null): string {
  // wa.me no permite adjuntar una imagen de verdad — solo texto
  // precargado. Mandamos el link "visor" de ImgBB (imagenViewerUrl,
  // con metadatos Open Graph) en vez del link directo al archivo — es
  // el que WhatsApp sabe convertir en una vista previa con miniatura.
  // Si el producto es viejo y no tiene ese campo (se subió antes de
  // este cambio), caemos al link directo como respaldo — abre igual,
  // solo que sin la miniatura automática.
  const detalle = s.items
    .map((it) => {
      const foto = it.imagenViewerUrl || it.imagenUrl
      return `${it.nombre}, precio ${bs(it.precio)}${foto ? ` — foto: ${foto}` : ''}`
    })
    .join('\n')
  const texto = envio
    ? `Hola! Soy ${nombreComprador}. Hice un pedido en Clasi Click con envío tuyo:\n${detalle}\n\nDirección: ${envio.direccion}${envio.referencia ? ` (${envio.referencia})` : ''}\n¿Coordinamos el envío y el pago?`
    : `Hola! Soy ${nombreComprador}. Quiero consultar sobre el producto:\n${detalle}`
  return `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

type Etapa = 'entrega' | 'creando' | 'pagando' | 'esperando' | 'resumen' | 'error'

// Extra sobre el costo de envío normal de la zona (no lo reemplaza) —
// a cambio, la moto lo entrega hoy mismo en vez de al día siguiente.
const COSTO_ENVIO_EXPRESS_EXTRA = 10

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
  // Descuento del cupón en productos que le tocó a este pedido.
  descuento?: number
  // Parte del envío que cubrió el cupón (envío gratis) — para mostrar
  // "Envío: Bs 5 → Gratis" en el resumen del pago.
  descuentoEnvio?: number
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
  const { usuario, cargando: authCargando, emailVerificado, obtenerToken , esPrueba } = useAuth()
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
  // WhatsApp de Clasi Click (Admin → configuración de pagos) — para el
  // botón de contacto cuando se anula una compra.
  const [whatsappPlataforma, setWhatsappPlataforma] = useState('')
  useEffect(() => {
    fetch('/api/configuracion/pagos')
      .then((r) => r.json())
      .then((data) => {
        if (data.qrImageUrl) setQrPlataforma(data.qrImageUrl)
        if (data.cbu) setCbuPlataforma(data.cbu)
        if (data.whatsapp) setWhatsappPlataforma(String(data.whatsapp).replace(/\D/g, ''))
      })
      .catch(() => {})
  }, [])
  // 'envio' = envío de Clasi Click (pago al QR de la plataforma);
  // 'vendedor' = envío propio del vendedor ("Hago envíos yo mismo": se le
  // paga a él, como en retiro, y él coordina la entrega); 'retiro'.
  const [metodoEntrega, setMetodoEntrega] = useState<'envio' | 'retiro' | 'vendedor'>('envio')
  // Recién se muestran los campos de dirección/pago DESPUÉS de que el
  // comprador toca uno de los dos botones a propósito — antes, con
  // "envío" precargado por default, esos campos aparecían de entrada
  // sin que nadie eligiera nada, lo cual mareaba más de lo necesario.
  const [metodoElegido, setMetodoElegido] = useState(false)
  // Solo aplica cuando metodoEntrega es 'retiro' — con envío siempre es
  // QR (no tiene sentido pagar en efectivo algo que te llevan a domicilio
  // sin verse las caras).
  const [metodoPago, setMetodoPago] = useState<'qr' | 'efectivo'>('qr')

  // Envío express: se suma un extra fijo al costo de envío normal de
  // la zona (ver COSTO_ENVIO_EXPRESS_EXTRA más abajo) — a cambio, la
  // moto lo entrega el mismo día en vez de al día siguiente. Solo
  // aplica con envío, nunca con retiro en tienda.
  const [envioExpress, setEnvioExpress] = useState(false)
  // Hasta que no toca "Envío normal" o "Envío express" no se muestran el
  // envío ni el total (aunque sus datos estén completos). No se restaura:
  // cada vez que entra lo tiene que elegir.
  const [tipoEnvioElegido, setTipoEnvioElegido] = useState(false)
  // Cupón de descuento / campaña (ver src/lib/cupones.ts). Se valida con
  // el servidor al tocar "Aplicar" y después se recalcula acá solo si
  // cambia el carrito, la zona o el método de entrega.
  const [codigoCupon, setCodigoCupon] = useState('')
  const [cuponAplicado, setCuponAplicado] = useState<Cupon | null>(null)
  const [errorCupon, setErrorCupon] = useState('')
  const [aplicandoCupon, setAplicandoCupon] = useState(false)
  // Cupones que este usuario puede usar ya (los del banner y los que le
  // avisaron por la campanita) — se muestran como botones para tocar y
  // aplicar sin escribir el código.
  const [cuponesDisponibles, setCuponesDisponibles] = useState<{ codigo: string; campana: string; tipo: string; descripcion: string; vence: string }[]>([])

  // El express solo se ofrece antes de las 17:00 (y nunca domingo). Lo
  // recalculamos cada minuto por si la pantalla quedó abierta y pasó la
  // hora de corte: ahí el botón se deshabilita y, si estaba elegido, se
  // cae solo a envío normal.
  const [expressHorario, setExpressHorario] = useState(() => envioExpressDisponible())
  useEffect(() => {
    const t = setInterval(() => setExpressHorario(envioExpressDisponible()), 60_000)
    return () => clearInterval(t)
  }, [])
  // Cuentas de prueba (ver src/lib/cuentasPrueba.ts): sin restricciones
  // de horario — tienda abierta y express siempre disponibles.
  const cuentaPrueba = esPrueba

  // Opciones del checkout que el admin prende o apaga (Admin → Envíos y
  // checkout): usar ubicación (GPS), marcar en el mapa, envío express y
  // retiro en tienda.
  const [opcionesCheckout, setOpcionesCheckout] = useState<OpcionesCheckout>(OPCIONES_CHECKOUT_DEFECTO)
  useEffect(() => {
    fetch('/api/config-checkout').then((r) => r.json()).then((d) => d?.opciones && setOpcionesCheckout({ ...OPCIONES_CHECKOUT_DEFECTO, ...d.opciones })).catch(() => {})
  }, [])
  useEffect(() => {
    if (!opcionesCheckout.express && envioExpress) setEnvioExpress(false)
  }, [opcionesCheckout.express, envioExpress])

  // Ubicación de prueba (cuentas de prueba): una casa fija en Potosí para
  // probar el envío desde cualquier lado. Se cambia marcando otra casa en
  // el mapa; "usar mi GPS real" la apaga.
  const UBICACION_PRUEBA = { lat: -19.5797, lng: -65.7618, direccion: 'Fortunato Gumiel 20', zona: 'Cuarto Centenario' }
  const [ubicacionPrueba, setUbicacionPrueba] = useState(UBICACION_PRUEBA)
  const [gpsRealPrueba, setGpsRealPrueba] = useState(false)
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('clasiclick_ubicacion_prueba') || 'null')
      if (u && typeof u.lat === 'number') setUbicacionPrueba({ ...UBICACION_PRUEBA, ...u })
      setGpsRealPrueba(localStorage.getItem('clasiclick_prueba_gps_real') === '1')
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function guardarUbicacionPrueba(u: typeof UBICACION_PRUEBA) {
    setUbicacionPrueba(u)
    try { localStorage.setItem('clasiclick_ubicacion_prueba', JSON.stringify(u)) } catch {}
  }
  // Al elegir "Envío" con una cuenta de prueba, se completa sola con la
  // casa de prueba (una vez; se puede cambiar o borrar).
  const pruebaCompletada = useRef(false)
  function completarConCasaPrueba() {
    setDireccion(ubicacionPrueba.direccion)
    setDireccionVerificada(true)
    setZonaTexto(ubicacionPrueba.zona)
    setZonaEntrega(ubicacionPrueba.zona)
    setOrigenBarrio('manual')
    setLat(ubicacionPrueba.lat)
    setLng(ubicacionPrueba.lng)
    setOrigenPunto('gps')
    // El punto de arranque es aproximado: si nunca se marcó la casa en el
    // mapa, se busca la dirección real en el mapa (una vez) y queda guardada.
    if (!(ubicacionPrueba as any).exacta) {
      fetch('/api/validar-direccion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direccion: ubicacionPrueba.direccion }) })
        .then((r) => r.json())
        .then((d) => {
          if (d?.encontrada !== true || typeof d.lat !== 'number') return
          setLat(d.lat)
          setLng(d.lng)
          guardarUbicacionPrueba({ ...ubicacionPrueba, lat: d.lat, lng: d.lng, exacta: true } as any)
        })
        .catch(() => {})
    }
  }
  function cambiarGpsRealPrueba(v: boolean) {
    setGpsRealPrueba(v)
    try { localStorage.setItem('clasiclick_prueba_gps_real', v ? '1' : '0') } catch {}
  }

  // Fuera de horario (20 a 8 h) no se puede pagar: en vez de solo cortar,
  // guardamos el carrito y le programamos un aviso en la 🔔 campanita
  // para las 8:00 (ver /api/compras-fuera-horario). El admin los ve en
  // Admin → Pedidos → "🌙 Quisieron comprar fuera de horario".
  const [cerradoAhora, setCerradoAhora] = useState(() => !tiendaAbierta())
  useEffect(() => {
    const t = setInterval(() => setCerradoAhora(!tiendaAbierta()), 60_000)
    return () => clearInterval(t)
  }, [])
  const [avisoApertura, setAvisoApertura] = useState<'' | 'guardando' | 'listo' | 'error'>('')
  async function avisarAlAbrir() {
    if (!usuario || !items.length) return
    setAvisoApertura('guardando')
    try {
      const token = await obtenerToken()
      const r = await fetch('/api/compras-fuera-horario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          items: items.map((i) => ({ id: String(i.id), nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, talla: i.tallaElegida, color: i.colorElegida, imagen: i.thumbUrl || i.imagenUrl })),
          total: totalCarrito,
          tienda: claveTienda,
          nombre: nombreComprador,
          whatsapp: whatsappComprador,
          ciudad: ciudadComprador,
        }),
      })
      setAvisoApertura(r.ok ? 'listo' : 'error')
    } catch {
      setAvisoApertura('error')
    }
  }
  const expressDisponible = cuentaPrueba || expressHorario
  useEffect(() => {
    if (envioExpress && !expressDisponible) setEnvioExpress(false)
  }, [envioExpress, expressDisponible])

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
  const [infoEnvioVendedores, setInfoEnvioVendedores] = useState<Record<string, { envioPropio: EnvioPropio | null; ciudad: CiudadId }>>({})
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
          .then((data) => [id, !!data.aceptaPagoQr, { envioPropio: data.envioPropio || null, ciudad: ciudadDe(data) }] as const)
          .catch(() => [id, false, { envioPropio: null, ciudad: ciudadDe(null) }] as const)
      )
    )
      .then((pares) => {
        if (cancelado) return
        setVendedoresConQR(Object.fromEntries(pares.map(([id, qr]) => [id, qr])))
        setInfoEnvioVendedores(Object.fromEntries(pares.map(([id, , info]) => [id, info])))
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

  // Qué formas de envío hay según la ciudad del comprador:
  // - Envío Clasi Click: si esa ciudad lo tiene (Admin → Ciudades) y
  //   todos los productos son de esa misma ciudad.
  // - Envío del vendedor: si TODOS los vendedores del carrito hacen
  //   envíos y llegan a la ciudad del comprador.
  const { ciudadId: ciudadComprador, abiertas: ciudadesAbiertas } = useCiudad()
  const configCiudad = ciudadesAbiertas.find((c) => c.id === ciudadComprador)
  const envioClasiCiudad = configCiudad ? configCiudad.envioClasiClick : ciudadComprador === 'potosi'
  const envioClasiDisponible = envioClasiCiudad && items.every((i) => ciudadDe(i as any) === ciudadComprador)
  const envioVendedorDisponible =
    !consultandoVendedores &&
    items.length > 0 &&
    items.every((i) => !!i.vendedorId) &&
    vendedorIdsCarrito.every((id) => envioPropioLlegaA(infoEnvioVendedores[id]?.envioPropio, infoEnvioVendedores[id]?.ciudad || 'potosi', ciudadComprador))
  const costoEnvioPorVendedor: Record<string, number | null> = Object.fromEntries(
    vendedorIdsCarrito.map((id) => [id, infoEnvioVendedores[id]?.envioPropio?.costo ?? null])
  )
  const envioVendedorTotal = Object.values(costoEnvioPorVendedor).reduce<number>((s, c) => s + (c || 0), 0)
  const envioVendedorACoordinar = Object.values(costoEnvioPorVendedor).some((c) => c === null)
  // Si la opción elegida no está disponible (ej: La Paz sin envío Clasi
  // Click), pasamos a la que sí.
  useEffect(() => {
    if (consultandoVendedores) return
    if (metodoEntrega === 'envio' && !envioClasiDisponible) setMetodoEntrega(envioVendedorDisponible ? 'vendedor' : 'retiro')
    else if (metodoEntrega === 'vendedor' && !envioVendedorDisponible) setMetodoEntrega(envioClasiDisponible ? 'envio' : 'retiro')
  }, [consultandoVendedores, metodoEntrega, envioClasiDisponible, envioVendedorDisponible])

  // Si ningún vendedor tiene QR, el pago en retiro se coordina sí o sí
  // por WhatsApp — forzamos 'efectivo' para que el flujo posterior
  // (que ya existía) mande al paso de WhatsApp en vez de a una pantalla
  // de QR vacía.
  useEffect(() => {
    if (metodoEntrega !== 'envio' && !consultandoVendedores && !algunVendedorConQR) {
      setMetodoPago('efectivo')
    }
  }, [metodoEntrega, consultandoVendedores, algunVendedorConQR])
  // Arranca vacío a propósito — hasta que el comprador no elige un
  // barrio, no mostramos ningún costo de envío (ver el resumen de
  // arriba de "¿Cómo lo recibís?"). Antes traía el primer barrio de la
  // lista precargado, así que el envío ya aparecía sin que nadie
  // hubiera elegido nada.
  const [zonaEntrega, setZonaEntrega] = useState('')
  // Zonas de envío: las fijas + las que agregó el admin (ver src/lib/zonasEnvio.ts).
  const zonas = useZonasEnvio()
  const cercanaA = (la: number, ln: number) => zonaMasCercana(zonas, la, ln)
  // Qué "Zona 1/2/3" está elegida en el primer selector — el segundo
  // selector (el barrio) recién muestra las opciones de ese grupo.
  const [grupoZonaSel, setGrupoZonaSel] = useState(grupoDeBarrio(ZONAS_ENVIO_POTOSI[0].nombre)?.id || ZONAS_AGRUPADAS[0].id)
  // De dónde salió el barrio: lo calculamos solos con la dirección (o
  // con la ubicación del celular), y el comprador solo lo elige a mano
  // si el mapa no encuentra su dirección o si quiere corregirlo.
  const [origenBarrio, setOrigenBarrio] = useState<'' | 'direccion' | 'gps' | 'mapa' | 'manual' | 'guardado'>('')
  // De dónde salió el punto (lat/lng) de la entrega: la dirección encontrada
  // en el mapa, la ubicación del celular o la casa marcada en el mapa. Con
  // el punto se controla que la zona elegida sea la correcta.
  const [origenPunto, setOrigenPunto] = useState<'' | 'direccion' | 'gps' | 'mapa'>('')
  const [mapaAbierto, setMapaAbierto] = useState(false)
  const [puntoMapa, setPuntoMapa] = useState<{ lat: number; lng: number } | null>(null)
  const [elegirBarrioAMano, setElegirBarrioAMano] = useState(false)
  const [direccion, setDireccion] = useState('')
  const [entreCalles, setEntreCalles] = useState('')
  // Lo que escribe en "Zona" (antes "barrio"); zonaEntrega es la zona de
  // la lista que corresponde (de ahí sale el costo del envío).
  const [zonaTexto, setZonaTexto] = useState('')
  const [zonaAbierta, setZonaAbierta] = useState(false)
  // Campos que ya tocó: recién ahí se muestran sus errores.
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const tocar = (campo: string) => setTocados((t) => (t[campo] ? t : { ...t, [campo]: true }))
  // Opcional — un punto de referencia extra (ej: "portón verde",
  // "al lado de la farmacia"), además de "entre calles". Le sirve a
  // la moto para encontrar direcciones sin numeración clara.
  const [referenciaAdicional, setReferenciaAdicional] = useState('')
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
  useEffect(() => {
    if (zonaEntrega && normZona(zonaTexto) !== normZona(zonaEntrega) && buscarZonaEn(zonas, zonaTexto)?.nombre !== zonaEntrega) setZonaTexto(zonaEntrega)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaEntrega])
  const direccionMuyCorta = (d: string) => d.trim().length < 5 || !/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(d)

  async function verificarDireccion(): Promise<{ resultado: boolean | 'error' | null; barrio: string; punto: { lat: number; lng: number } | null }> {
    if (!direccion.trim()) {
      setDireccionVerificada(null)
      return { resultado: null, barrio: '', punto: null }
    }
    setVerificandoDireccion(true)
    let barrioDetectado = ''
    try {
      const res = await fetch('/api/validar-direccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion }),
      })
      const data = await res.json()
      let resultado: boolean | 'error' | null = data.encontrada === null ? 'error' : !!data.encontrada
      let motivo = data.motivo || ''
      // Con la dirección encontrada sacamos el barrio (y el costo del
      // envío) solos. Si cae lejos de todos los barrios conocidos, es
      // que el mapa encontró otra cosa: se lo pedimos a mano.
      if (resultado === true && typeof data.lat === 'number') {
        const cercano = cercanaA(data.lat, data.lng)
        const lejos = distanciaKm(data.lat, data.lng, cercano.lat, cercano.lng) > RADIO_BARRIO_KM * 2
        if (lejos) {
          resultado = false
          motivo = 'No pudimos ubicar bien tu dirección en el mapa.'
        }
        // La zona ya no se completa sola: la escribe el comprador (las
        // zonas de la lista no siempre coinciden con cómo la llama la
        // gente). El punto sirve para el costo y el control interno.
      }
      if (resultado === false && !direccionMuyCorta(direccion)) {
        // No la encontró: no frenamos la compra, pedimos el barrio a mano.
        setElegirBarrioAMano(true)
      }
      setDireccionVerificada(resultado)
      setMotivoDireccion(motivo)
      // Si la persona no compartió su ubicación ni marcó su casa (más
      // precisos), usamos el punto que encontró el mapa: sirve para
      // controlar la zona y ayuda a la moto, aunque sea aproximado.
      let punto: { lat: number; lng: number } | null = null
      if (origenPunto === '' || origenPunto === 'direccion') {
        if (resultado === true && typeof data.lat === 'number') {
          punto = { lat: data.lat, lng: data.lng }
          setLat(data.lat)
          setLng(data.lng)
          setOrigenPunto('direccion')
        } else if (origenPunto === 'direccion') {
          setLat(null)
          setLng(null)
          setOrigenPunto('')
        }
      } else if (lat != null && lng != null) punto = { lat, lng }
      return { resultado, barrio: barrioDetectado, punto }
    } catch {
      setDireccionVerificada('error')
      setElegirBarrioAMano(true)
      return { resultado: 'error', barrio: '', punto: lat != null && lng != null ? { lat, lng } : null }
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
  // ¿La zona elegida coincide con el punto de la entrega? La zona de un
  // punto es la más cercana; si eligió otra que queda claramente más lejos
  // ("Fortunato Gumiel" no queda en Santa Rosa), no coincide. Margen más
  // grande para el punto de la dirección (el mapa la ubica aproximada) que
  // para el GPS o la casa marcada.
  const zonaDelPunto = lat != null && lng != null ? cercanaA(lat, lng) : null
  const zonaElegidaInfo = buscarZonaEn(zonas, zonaEntrega)
  // Con la casa marcada en el mapa o el GPS el punto es confiable: se puede
  // escribir una zona que no está en la lista, y el envío sale del punto.
  const puntoFiable = lat != null && lng != null && (origenPunto === 'mapa' || origenPunto === 'gps')

  // Entre calles según el mapa (OpenStreetMap): con la casa marcada (GPS o
  // mapa) sabemos en qué calle está y sus dos esquinas. Se sugieren y, si
  // lo escrito no cruza su calle cerca, se avisa (se puede confirmar igual
  // por si el mapa está incompleto). Con solo la dirección escrita no se
  // verifica: el punto que da el buscador puede caer en otra cuadra.
  const [infoEntre, setInfoEntre] = useState<EntreCallesInfo | null>(null)
  const [entreConfirmado, setEntreConfirmado] = useState(false)
  useEffect(() => {
    if (!puntoFiable || metodoEntrega !== 'envio') { setInfoEntre(null); return }
    let vivo = true
    const t = setTimeout(() => {
      fetch('/api/entre-calles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng, calle: direccion }) })
        .then((r) => r.json())
        .then((d) => { if (vivo) setInfoEntre(d?.calle ? d : null) })
        .catch(() => { if (vivo) setInfoEntre(null) })
    }, 700)
    return () => { vivo = false; clearTimeout(t) }
  }, [puntoFiable, metodoEntrega, lat, lng, direccion])
  const entreMalas = puntoFiable && !validarEntreCalles(entreCalles, direccion) ? entreCallesNoCoinciden(entreCalles, infoEntre) : null
  const entreNoCoincide = !!entreMalas && !entreConfirmado
  const sugerenciaEntre = infoEntre && infoEntre.sugeridas.length === 2 ? infoEntre.sugeridas.join(' y ') : ''
  const zonaLibre = !!zonaEntrega && !zonaElegidaInfo
  // El envío sale del PUNTO de la casa (dirección, GPS o mapa), no del
  // nombre de la zona: así escribir otra zona no cambia el precio. Sin
  // punto: el de la zona si está en la lista, o la tarifa más alta.
  const COSTO_SIN_PUNTO = 15
  const costoZona = lat != null && lng != null ? costoPorDistancia(lat, lng) : (zonaElegidaInfo?.costoEnvio ?? COSTO_SIN_PUNTO)
  // Validador secundario (interno, no se le muestra al comprador): ¿la
  // zona escrita cuadra con el punto? Va en el pedido para que el admin
  // vea "⚠ zona dudosa" y la moto confirme por WhatsApp.
  const zonaNoCoincide = false
  const validacionZona = (() => {
    if (!zonaEntrega) return null
    const cercana = zonaDelPunto
    const distEscrita = zonaElegidaInfo && lat != null && lng != null ? distanciaKm(lat, lng, zonaElegidaInfo.lat, zonaElegidaInfo.lng) : null
    const distCercana = cercana && lat != null && lng != null ? distanciaKm(lat, lng, cercana.lat, cercana.lng) : null
    const margen = origenPunto === 'direccion' ? 0.8 : 0.4
    return {
      escrita: zonaEntrega,
      enLista: !!zonaElegidaInfo,
      cercanaAlPunto: cercana?.nombre || null,
      distanciaKm: distEscrita != null ? Math.round(distEscrita * 100) / 100 : null,
      // null = no se puede saber (zona nueva o sin punto)
      coincide: distEscrita != null && distCercana != null ? distEscrita - distCercana <= margen : null,
      origenPunto: origenPunto || null,
    }
  })()
  const textoPunto = origenPunto === 'mapa' ? 'La casa que marcaste' : origenPunto === 'gps' ? 'Tu ubicación' : 'Tu dirección'
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
  // Comprobante rechazado por la lectura automática: se avisa, se deja
  // subir otro y a los 3 intentos el servidor anula la compra (ver
  // comprobanteRechazado en /api/pedidos/[id]).
  const [rechazoComprobante, setRechazoComprobante] = useState<{ intentos: number; motivo: string } | null>(null)
  const [registrandoRechazo, setRegistrandoRechazo] = useState(false)
  const rechazoRegistradoRef = useRef('')
  // Preferencia de entrega ya guardada (ver SelectorHorarioEntrega,
  // que hace el PATCH a /api/pedidos/[id] — acá solo se refleja el
  // resultado para el texto de arriba del resumen).
  const [franjaHoraria, setFranjaHoraria] = useState<Franja>('')
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
  const CLAVE_BORRADOR = 'clasiclick_checkout_datos'
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
          setMetodoEntrega(d.metodoEntrega === 'retiro' || d.metodoEntrega === 'vendedor' ? d.metodoEntrega : 'envio')
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
    // Lo que ya había completado si volvió atrás (al carrito, a otro
    // producto) o recargó la página hace poco: no se pierde. Pasadas 2
    // horas se considera una compra nueva y el formulario arranca vacío:
    // lo anterior aparece como sugerencia mientras escribe (ver más abajo).
    try {
      const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null')
      if (b && usuario && b.uid === usuario.uid && Date.now() - (b.guardadoAt || 0) < 2 * 60 * 60 * 1000) {
        if (b.metodoElegido) {
          setMetodoEntrega(b.metodoEntrega === 'retiro' || b.metodoEntrega === 'vendedor' ? b.metodoEntrega : 'envio')
          setMetodoElegido(true)
        }
        if (b.metodoPago === 'efectivo') setMetodoPago('efectivo')
        setEnvioExpress(!!b.envioExpress)
        if (b.nombreComprador) setNombreComprador(b.nombreComprador)
        if (b.whatsappComprador) setWhatsappComprador(b.whatsappComprador)
        if (b.direccion) setDireccion(b.direccion)
        if (b.zonaEntrega && (buscarZonaEn(zonas, b.zonaEntrega) || zonaLibreValida(b.zonaEntrega))) { setZonaEntrega(b.zonaEntrega); setOrigenBarrio(b.origenBarrio || 'guardado') }
        else if (b.zonaTexto) setZonaTexto(b.zonaTexto)
        if (b.entreCalles) setEntreCalles(b.entreCalles)
        if (b.referenciaAdicional) setReferenciaAdicional(b.referenciaAdicional)
        if (typeof b.lat === 'number' && typeof b.lng === 'number') { setLat(b.lat); setLng(b.lng); setOrigenPunto(b.origenPunto || 'direccion') }
        if (b.codigoCupon) setCodigoCupon(b.codigoCupon)
      }
    } catch {}
    setRestaurando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authCargando])

  // Datos de compras anteriores (nombre, WhatsApp, direcciones con su
  // zona y entre calles): ya NO se precargan; se sugieren mientras escribe
  // ("m" → "Marcelo Rodríguez"). Del navegador + lo guardado en su cuenta.
  const [datosUsados, setDatosUsados] = useState<DatosUsados>({ nombres: [], whatsapps: [], direcciones: [] })
  useEffect(() => {
    if (restaurando || !usuario) return
    let cancelado = false
    setDatosUsados(leerDatosUsados(usuario.uid))
    ;(async () => {
      try {
        const token = await obtenerToken()
        if (!token) return
        const data = await fetch('/api/usuarios/datos-envio', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
        if (!cancelado && data.datosEnvio) setDatosUsados((prev) => mezclarConCuenta(prev, data.datosEnvio))
      } catch {
        // Sin datos guardados: no hay sugerencias, nada más.
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurando, usuario])
  const sugerir = (lista: string[], escrito: string) => lista.filter((x) => coincideInicio(x, escrito)).slice(0, 4).map((texto) => ({ texto }))
  // Elegir una dirección usada completa también su zona, entre calles y referencia.
  const [verificarLuego, setVerificarLuego] = useState(false)
  function usarDireccion(d: DireccionUsada) {
    setDireccion(d.direccion)
    setDireccionVerificada(null)
    setMotivoDireccion('')
    if (origenPunto === 'direccion') { setLat(null); setLng(null); setOrigenPunto('') }
    if (d.zona && zonaLibreValida(d.zona)) { setZonaTexto(d.zona); setZonaEntrega(d.zona); setOrigenBarrio('guardado') }
    if (d.entreCalles) { setEntreCalles(d.entreCalles); setEntreConfirmado(false) }
    if (d.referencia) setReferenciaAdicional(d.referencia)
    setVerificarLuego(true)
  }
  useEffect(() => {
    if (!verificarLuego) return
    setVerificarLuego(false)
    if (!validarDireccion(direccion)) verificarDireccion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificarLuego])

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

  // Borrador de los datos de entrega (ver la restauración más arriba).
  useEffect(() => {
    if (restaurando || !usuario) return
    try {
      if (etapa === 'resumen') { localStorage.removeItem(CLAVE_BORRADOR); return }
      if (etapa !== 'entrega') return
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
        uid: usuario.uid, guardadoAt: Date.now(), metodoEntrega, metodoElegido, metodoPago, envioExpress,
        nombreComprador, whatsappComprador, direccion, zonaEntrega, zonaTexto, origenBarrio, origenPunto, entreCalles, referenciaAdicional, lat, lng,
        codigoCupon: cuponAplicado?.codigo || codigoCupon,
      }))
    } catch {}
  }, [restaurando, usuario, etapa, metodoEntrega, metodoElegido, metodoPago, envioExpress, nombreComprador, whatsappComprador, direccion, zonaEntrega, zonaTexto, origenBarrio, origenPunto, entreCalles, referenciaAdicional, lat, lng, codigoCupon, cuponAplicado])

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
  // ── Botón "atrás" del celular en el paso de pago ───────────────────
  // Al llegar al QR sumamos una entrada al historial (misma URL): así el
  // "atrás" vuelve a "Tu pedido" con todo lo que había completado, en vez
  // de salir de /checkout a la tienda. Los pedidos sin pagar que se
  // habían creado se anulan (devuelven el stock) para que al confirmar de
  // nuevo no queden repetidos; el carrito sigue intacto.
  const [avisoVolvio, setAvisoVolvio] = useState(false)
  useEffect(() => {
    if (etapa !== 'pagando') return
    if (!window.history.state?.ccPagando) window.history.pushState({ ccPagando: true }, '')
    const alVolver = () => volverAlPedido()
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa])

  function volverAlPedido() {
    const ids = subPedidosRef.current.map((s) => s.pedidoId).filter(Boolean) as string[]
    setSubPedidos([])
    setPasoActual(0)
    setPasosConfirmados(new Set())
    setComprobanteUrl('')
    setResultadoOCR(null)
    setRechazoComprobante(null)
    setError('')
    setAvisoVolvio(true)
    setEtapa('entrega')
    window.scrollTo({ top: 0 })
    obtenerToken()
      .then((token) => Promise.all(ids.map((id) =>
        fetch(`/api/pedidos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ compradorVuelve: true }),
        }).catch(() => null),
      )))
      .catch(() => {})
  }

  const pedidoYaCreado =
    etapa === 'pagando' || etapa === 'esperando' || etapa === 'resumen' || subPedidos.some((s) => !!s.pedidoId)

  useEffect(() => {
    if (authCargando) return
    if (pedidoYaCreado) return
    if (!usuario || emailVerificado === false) router.push('/login')
  }, [authCargando, usuario, emailVerificado, router, pedidoYaCreado])

  const costoEnvio =
    metodoEntrega === 'retiro'
      ? 0
      : metodoEntrega === 'vendedor'
        ? envioVendedorTotal
        : (zonaEntrega ? costoZona : 0) + (envioExpress ? COSTO_ENVIO_EXPRESS_EXTRA : 0)
  // Los cupones de envío gratis son solo para el envío de Clasi Click.
  const metodoCupon: 'envio' | 'retiro' = metodoEntrega === 'envio' ? 'envio' : 'retiro'
  const subtotalCarrito = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const extraExpress = metodoEntrega === 'envio' && envioExpress ? COSTO_ENVIO_EXPRESS_EXTRA : 0
  const resultadoCupon = cuponAplicado
    ? evaluarCupon(cuponAplicado, { subtotal: subtotalCarrito, costoEnvio, extraExpress, metodoEntrega: metodoCupon })
    : null
  const descuentoCupon = resultadoCupon?.ok ? resultadoCupon.descuentoProductos : 0
  const descuentoEnvioCupon = resultadoCupon?.ok ? resultadoCupon.descuentoEnvio : 0
  const costoEnvioFinal = costoEnvio - descuentoEnvioCupon
  // El envío y el total recién se muestran cuando eligió cómo recibirlo y,
  // con envío, completó una dirección válida y su zona.
  const entregaLista = metodoElegido && (metodoEntrega !== 'envio' || (tipoEnvioElegido && !!zonaEntrega && !validarDireccion(direccion) && !zonaNoCoincide && (lat != null || direccionVerificada === 'error')))
  const totalCarrito = subtotalCarrito - descuentoCupon + costoEnvioFinal

  async function aplicarCupon(codigoForzado?: string): Promise<boolean> {
    const codigo = (codigoForzado ?? codigoCupon).trim()
    if (!codigo) return false
    setCodigoCupon(codigo)
    setAplicandoCupon(true)
    setErrorCupon('')
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/cupones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codigo, subtotal: subtotalCarrito, costoEnvio, extraExpress, metodoEntrega: metodoCupon }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCuponAplicado(data.cupon)
      setCodigoCupon(data.cupon.codigo)
      track('aplicar_cupon', { cupon: data.cupon.codigo, tipo: data.cupon.tipo, subtotal: subtotalCarrito })
      return true
    } catch (e: any) {
      setCuponAplicado(null)
      setErrorCupon(e?.message || 'No se pudo aplicar el cupón.')
      return false
    } finally {
      setAplicandoCupon(false)
    }
  }

  // Cupón elegido desde el banner de la portada/producto (ver
  // BannerCuponPromo): se aplica solo una vez que hay carrito y sesión.
  // Evento "iniciar_checkout": una vez por visita al checkout con carrito.
  const checkoutRegistrado = useRef(false)
  useEffect(() => {
    if (checkoutRegistrado.current || !usuario || items.length === 0) return
    checkoutRegistrado.current = true
    track('iniciar_checkout', { productos: items.length, total: subtotalCarrito })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, items.length])

  const cuponPendienteRevisado = useRef(false)
  useEffect(() => {
    if (cuponPendienteRevisado.current || !usuario || items.length === 0 || cuponAplicado) return
    cuponPendienteRevisado.current = true
    const pendiente = tomarCuponPendiente()
    if (pendiente) aplicarCupon(pendiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, items.length])

  useEffect(() => {
    if (!usuario) return
    let cancelado = false
    obtenerToken()
      .then((token) => (token ? fetch('/api/cupones/disponibles', { headers: { Authorization: `Bearer ${token}` } }) : null))
      .then((r) => r?.json())
      .then((d) => { if (!cancelado && d?.cupones) setCuponesDisponibles(d.cupones) })
      .catch(() => {})
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.uid])

  function quitarCupon() {
    setCuponAplicado(null)
    setCodigoCupon('')
    setErrorCupon('')
  }

  // Cupón en la pantalla de pago: el pedido ya está creado, así que al
  // aplicar (o quitar) un cupón se anula el pedido sin pagar y se vuelve a
  // crear igual pero con el descuento (mismo flujo que "volver atrás").
  const [rehacer, setRehacer] = useState(false)
  const [rehaciendo, setRehaciendo] = useState(false)
  async function aplicarCuponEnPago(codigo?: string) {
    const ok = await aplicarCupon(codigo)
    if (ok && etapa === 'pagando') setRehacer(true)
  }
  function quitarCuponEnPago() {
    quitarCupon()
    if (etapa === 'pagando') setRehacer(true)
  }
  useEffect(() => {
    if (!rehacer) return
    setRehacer(false)
    ;(async () => {
      setRehaciendo(true)
      const ids = subPedidosRef.current.map((x) => x.pedidoId).filter(Boolean) as string[]
      try {
        const token = await obtenerToken()
        await Promise.all(ids.map((id) => fetch(`/api/pedidos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ compradorVuelve: true }) }).catch(() => null)))
      } catch {}
      setSubPedidos([])
      setPasoActual(0)
      await confirmarEntregaYCrearPedidos()
      setRehaciendo(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehacer])


  useEffect(() => {
    if (!cuentaPrueba || gpsRealPrueba || pruebaCompletada.current || restaurando) return
    if (etapa !== 'entrega' || !metodoElegido || metodoEntrega !== 'envio' || direccion.trim()) return
    pruebaCompletada.current = true
    completarConCasaPrueba()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaPrueba, gpsRealPrueba, restaurando, etapa, metodoElegido, metodoEntrega])

  function usarMiUbicacion() {
    // Cuenta de prueba: "mi ubicación" es la de prueba en Potosí (salvo
    // que elija usar el GPS real), para probar desde cualquier ciudad.
    if (cuentaPrueba && !gpsRealPrueba) {
      setLat(ubicacionPrueba.lat)
      setLng(ubicacionPrueba.lng)
      setOrigenPunto('gps')
      setMapaAbierto(false)
      return
    }
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
        // El punto da el costo del envío; la zona la escribe el comprador.
        setOrigenPunto('gps')
        setMapaAbierto(false)
        setBuscandoUbicacion(false)
      },
      () => {
        setError('No pudimos acceder a tu ubicación. Podés seguir sin ella, solo que la moto va a confirmar tu dirección a mano.')
        setBuscandoUbicacion(false)
      }
    )
  }

  // Dirección cargada (guardada de otra compra o recién escrita) que
  // todavía no se buscó en el mapa: se busca sola al dejar de escribir.
  useEffect(() => {
    if (etapa !== 'entrega' || metodoEntrega !== 'envio' || !metodoElegido) return
    if (direccionVerificada !== null || verificandoDireccion || lat != null || validarDireccion(direccion)) return
    const t = setTimeout(() => { verificarDireccion() }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion, direccionVerificada, lat, metodoEntrega, metodoElegido, etapa])

  // "Marcar mi casa en el mapa": la zona sale del punto marcado.
  function abrirMapa() {
    const z = buscarZonaEn(zonas, zonaEntrega)
    setPuntoMapa(lat != null && lng != null ? { lat, lng } : z ? { lat: z.lat, lng: z.lng } : { lat: -19.5893, lng: -65.7535 })
    setMapaAbierto(true)
  }
  function confirmarMapa() {
    if (!puntoMapa) return
    const cercano = cercanaA(puntoMapa.lat, puntoMapa.lng)
    if (distanciaKm(puntoMapa.lat, puntoMapa.lng, cercano.lat, cercano.lng) > RADIO_BARRIO_KM * 2) {
      setError('Ese punto queda fuera de las zonas de envío. Si es correcto, elegí “Retiro en tienda” o escribinos.')
      return
    }
    setLat(puntoMapa.lat)
    setLng(puntoMapa.lng)
    setOrigenPunto('mapa')
    // Cuenta de prueba: el punto marcado pasa a ser su ubicación de prueba.
    if (cuentaPrueba) guardarUbicacionPrueba({ ...ubicacionPrueba, lat: puntoMapa.lat, lng: puntoMapa.lng, direccion: direccion.trim() || ubicacionPrueba.direccion, exacta: true } as any)
    setMapaAbierto(false)
    setError('')
  }

  async function confirmarEntregaYCrearPedidos() {
    if (!cuentaPrueba && !tiendaAbierta()) {
      setCerradoAhora(true)
      setError('')
      avisarAlAbrir() // guarda (o actualiza) carrito, nombre y WhatsApp
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
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
      setError('Número de WhatsApp inválido.')
      return
    }
    if (metodoEntrega === 'envio' && envioExpress && !expressDisponible) {
      setEnvioExpress(false)
      setError(`El envío express solo está disponible para compras antes de las ${HORA_CORTE_EXPRESS}:00. Lo cambiamos a envío normal — revisá el total y volvé a confirmar.`)
      return
    }
    if (metodoEntrega === 'vendedor' && validarDireccion(direccion)) {
      tocar('direccion')
      setError(validarDireccion(direccion)!)
      return
    }
    if (metodoEntrega === 'envio') {
      setTocados({ direccion: true, zona: true, entre: true })
      const errDir = validarDireccion(direccion)
      if (errDir) {
        setError(errDir)
        return
      }
      // Si todavía no se chequeó (escribió y tocó "Continuar" sin salir
      // del campo), la chequeamos acá: de ahí sale el barrio.
      let puntoActual = lat != null && lng != null ? { lat, lng } : null
      if (!puntoActual && direccionVerificada === null) {
        const v = await verificarDireccion()
        puntoActual = v.punto
        if (!puntoActual && v.resultado !== 'error') {
          setError('No encontramos tu dirección en el mapa: marcá tu casa en el mapa o usá tu ubicación para calcular el envío.')
          return
        }
      }
      if (!puntoActual && direccionVerificada === false) {
        setError('No encontramos tu dirección en el mapa: marcá tu casa en el mapa o usá tu ubicación para calcular el envío.')
        return
      }
      if (!zonaEntrega && direccionVerificada === null) {
        const { barrio } = await verificarDireccion()
        if (barrio) {
          // Recién ahora sabemos el costo del envío: que lo vea antes de pagar.
          setError(`Calculamos tu envío para la zona ${barrio}. Revisá el total y tocá “Continuar” de nuevo.`)
          return
        }
      }
    }
    if (metodoEntrega === 'envio' && !tipoEnvioElegido) {
      setError('Elegí si querés Envío normal o Envío express.')
      return
    }
    if (metodoEntrega === 'envio' && !zonaEntrega) {
      setError(validarZona(zonaTexto, { zonas, conPunto: true }) || 'Elegí tu zona para calcular el envío.')
      return
    }
    if (metodoEntrega === 'envio' && zonaNoCoincide) {
      setError(`${textoPunto} queda en la zona ${zonaDelPunto!.nombre}, no en ${zonaEntrega}. Corregí la zona (o marcá tu casa en el mapa) para seguir.`)
      return
    }
    if (metodoEntrega === 'envio' && validarEntreCalles(entreCalles, direccion)) {
      setError(validarEntreCalles(entreCalles, direccion)!)
      return
    }
    if (metodoEntrega === 'envio' && entreNoCoincide) {
      setError(`Revisá "Entre calles": según el mapa ${entreMalas!.join(' y ')} no ${entreMalas!.length > 1 ? 'cruzan' : 'cruza'} la ${infoEntre!.calle} cerca de tu casa.${sugerenciaEntre ? ` Estás entre ${sugerenciaEntre}.` : ''}`)
      return
    }

    // Si es retiro + efectivo, reservamos la pestaña de WhatsApp ACÁ
    // MISMO, todavía dentro del gesto de click del usuario — recién más
    // abajo, después de crear el pedido (que tarda porque es un fetch),
    // le asignamos la URL final. Si abriéramos la pestaña después de
    // esos awaits, el navegador ya no lo reconoce como una acción
    // directa del usuario y la mayoría de los navegadores bloquean el
    // popup silenciosamente — así evitamos ese bloqueo.
    const abrirWhatsappDirecto = metodoEntrega !== 'envio' && metodoPago === 'efectivo'
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
    const enviosRepartidos = repartirEnvio(subtotales, costoEnvioFinal)
    // El descuento del cupón se reparte entre los vendedores igual que el
    // envío (proporcional al subtotal de cada uno).
    const cuponVigente = cuponAplicado && resultadoCupon?.ok ? cuponAplicado : null
    const descuentosRepartidos = repartirEnvio(subtotales, cuponVigente ? descuentoCupon : 0)
    const descuentosEnvioRepartidos = repartirEnvio(subtotales, cuponVigente ? descuentoEnvioCupon : 0)
    const checkoutId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    // El token va siempre: lo usa el cupón y también la cuenta de prueba
    // (el servidor la reconoce por el login para saltear el horario).
    const tokenCupon = await obtenerToken().catch(() => null)

    const nuevos: SubPedido[] = []
    try {
      for (let i = 0; i < clavesVendedor.length; i++) {
        const clave = clavesVendedor[i]
        const grupoItems = grupos.get(clave)!
        const vendedorId = clave === 'plataforma' ? null : clave
        const subtotal = subtotales[i]
        // Envío del vendedor: cada tienda cobra su propio envío.
        const envioGrupo = metodoEntrega === 'vendedor' ? (vendedorId ? costoEnvioPorVendedor[vendedorId] || 0 : 0) : enviosRepartidos[i]
        const descuentoGrupo = descuentosRepartidos[i]
        const totalGrupo = subtotal - descuentoGrupo + envioGrupo

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
            if (metodoEntrega !== 'envio' && data.configurado) {
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

        const metodoPagoGrupo = metodoEntrega !== 'envio' ? metodoPago : 'qr'

        const resPedido = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tokenCupon ? { Authorization: `Bearer ${tokenCupon}` } : {}) },
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
            referenciaAdicional: referenciaAdicional || null,
            lat: metodoEntrega === 'envio' ? lat : null,
            lng: metodoEntrega === 'envio' ? lng : null,
            origenUbicacion: metodoEntrega === 'envio' && lat != null ? origenPunto || null : null,
            validacionZona: metodoEntrega === 'envio' ? validacionZona : null,
            costoEnvio: envioGrupo,
            // Envío de toda la compra antes del cupón (si el carrito tiene
            // varias tiendas, el envío se reparte y cada pedido lleva una parte).
            costoEnvioCompra: costoEnvio,
            metodoEntrega,
            metodoPago: metodoPagoGrupo,
            envioExpress: metodoEntrega === 'envio' ? envioExpress : false,
            campana: leerCampana(),
            cupon: cuponVigente
              ? {
                  codigo: cuponVigente.codigo,
                  checkoutId,
                  subtotalCarrito,
                  costoEnvioCarrito: costoEnvio,
                  extraExpressCarrito: extraExpress,
                  descuentoProductos: descuentoGrupo,
                  descuentoEnvio: descuentosEnvioRepartidos[i],
                }
              : null,
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
          descuento: descuentoGrupo,
          descuentoEnvio: descuentosEnvioRepartidos[i],
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
      if (usuario) recordarDatos(usuario.uid, { nombre: nombreComprador, whatsapp: whatsappComprador, ...(metodoEntrega === 'envio' ? { direccion, zona: zonaEntrega, entreCalles, referencia: referenciaAdicional } : {}) })
      obtenerToken()
        .then((token) => {
          if (!token) return
          fetch('/api/usuarios/datos-envio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ nombreComprador, whatsappComprador, zonaEntrega, direccion, entreCalles, referenciaAdicional }),
          }).catch(() => {})
        })
        .catch(() => {})

      if (abrirWhatsappDirecto) {
        // Como el checkout ahora es siempre de UNA tienda a la vez, acá
        // solo hay un subPedido — le llevamos directo a WhatsApp con el
        // detalle del pedido, sin ninguna pantalla intermedia de por
        // medio.
        const link = nuevos[0] ? linkWhatsappRetiroEfectivo(nuevos[0], nombreComprador, metodoEntrega === 'vendedor' ? { direccion, referencia: referenciaAdicional } : null) : null
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
      // Si no se llegó a crear ningún pedido (ej. un producto se agotó
      // justo ahora), vuelve al carrito para que ajuste y reintente.
      setEtapa(nuevos.length === 0 ? 'entrega' : 'error')
    }
  }

  // Confirma el pago DENTRO de la app. Exige comprobante subido — sin
  // eso no se puede avanzar (antes era opcional y el paso real pasaba
  // por WhatsApp; ahora WhatsApp es un extra).
  // Cuando ya están la imagen subida y la lectura, si el comprobante no
  // es válido se registra el intento fallido y se vuelve a pedir otro.
  useEffect(() => {
    const sub = subPedidos[pasoActual]
    if (!sub?.pedidoId || !comprobanteUrl || !resultadoOCR || leyendoOCR) return
    if (comprobanteValido(resultadoOCR)) return
    if (rechazoRegistradoRef.current === comprobanteUrl) return
    rechazoRegistradoRef.current = comprobanteUrl
    const motivo = motivoRechazo(resultadoOCR, sub.total)
    setRegistrandoRechazo(true)
    ;(async () => {
      try {
        const token = await obtenerToken()
        const res = await fetch(`/api/pedidos/${sub.pedidoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ comprobanteRechazado: { url: comprobanteUrl, motivo, montoLeido: resultadoOCR.montoDetectado } }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setRechazoComprobante({ intentos: data.intentos, motivo })
        track('comprobante_rechazado', { intento: data.intentos, anulado: data.anulado ? 1 : 0, cupon: cuponAplicado?.codigo || '' })
        if (data.anulado) {
          setSubPedidos((prev) => prev.map((s, i) => (i === pasoActual ? { ...s, estadoActual: 'cancelado' } : s)))
        }
      } catch (e: any) {
        setRechazoComprobante({ intentos: 0, motivo })
        console.error('No se pudo registrar el comprobante rechazado:', e)
      } finally {
        setComprobanteUrl('')
        setResultadoOCR(null)
        setRegistrandoRechazo(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobanteUrl, resultadoOCR, leyendoOCR, pasoActual])

  // Al pasar al pago del siguiente vendedor arranca de cero.
  useEffect(() => {
    setRechazoComprobante(null)
  }, [pasoActual])

  function declararPagoActual() {
    const sub = subPedidos[pasoActual]
    if (!sub.pedidoId) return
    if (!comprobanteUrl) {
      setError('Subí la foto del comprobante para confirmar el pago.')
      return
    }
    // El monto leído por OCR no coincidió con el total — no se deja
    // avanzar hasta que suba un comprobante que sí coincida (ver botón
    // deshabilitado más abajo, esto es una segunda barrera por las
    // dudas).
    if (resultadoOCR && !comprobanteValido(resultadoOCR)) return
    if (sub.estadoActual === 'cancelado') return
    setError('')
    track('compra_confirmada', { total: sub.total, cupon: cuponAplicado?.codigo || '', envio: metodoEntrega, express: envioExpress ? 1 : 0 })

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
        ocrPareceComprobante: resultadoOCR ? resultadoOCR.pareceComprobante : null,
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
    track('subir_comprobante', { total: subPedidos[pasoActual]?.total ?? 0, cupon: cuponAplicado?.codigo || '' })

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
      // Mensaje fijo en vez del error crudo del servidor — cubre tanto
      // una falla técnica (red, ImgBB caído) como haber subido un
      // archivo que no es una imagen válida del comprobante.
      console.error('Error subiendo el comprobante:', e)
      setError('Comprobante Inválido, vuelva a intentarlo')
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
    if (metodoEntrega !== 'envio' && metodoPago === 'efectivo') return

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

  const bloqueCupon = (
            <div>
              {cuponAplicado ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="font-body text-xs">
                    <div className="font-semibold text-ink">🎟️ {cuponAplicado.codigo}</div>
                    {resultadoCupon?.ok ? (
                      <div className="text-teal">{resultadoCupon.descripcion} ✓</div>
                    ) : (
                      <div className="text-maroon">{resultadoCupon?.error}</div>
                    )}
                  </div>
                  <button type="button" onClick={quitarCuponEnPago} className="shrink-0 font-body text-[11px] text-maroon underline">
                    quitar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={codigoCupon}
                      onChange={(e) => { setCodigoCupon(e.target.value.toUpperCase()); setErrorCupon('') }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarCuponEnPago() } }}
                      placeholder="Si tiene un cupón de envío escriba aquí el código"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm uppercase placeholder:normal-case"
                    />
                    <button
                      type="button"
                      onClick={() => aplicarCuponEnPago()}
                      disabled={aplicandoCupon || !codigoCupon.trim()}
                      className="px-3.5 py-2 rounded-lg border-none bg-ink text-white font-body text-xs font-semibold disabled:opacity-50"
                    >
                      {aplicandoCupon ? '...' : 'Aplicar'}
                    </button>
                  </div>
                  {errorCupon && <div className="font-body text-[11px] text-maroon mt-1.5">{errorCupon}</div>}
                  {cuponesDisponibles.length > 0 && (
                    <div className="mt-2.5">
                      <div className="font-body text-[11px] text-inksoft mb-1.5">Cupones disponibles para vos — tocá uno para aplicarlo:</div>
                      <div className="flex flex-col gap-1.5">
                        {cuponesDisponibles.map((c) => (
                          <button
                            key={c.codigo}
                            type="button"
                            onClick={() => aplicarCuponEnPago(c.codigo)}
                            disabled={aplicandoCupon || rehaciendo}
                            className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg border border-dashed border-teal bg-tealsoft hover:bg-tealsoft/70 disabled:opacity-60"
                          >
                            <span className="text-lg leading-none" aria-hidden="true">{c.tipo === 'envio_gratis' ? '🚚' : '🎁'}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-body text-xs font-semibold text-ink">{c.campana ? `${c.campana}: ` : ''}{c.descripcion}</span>
                              <span className="block font-body text-[11px] text-inksoft">
                                Código <span className="font-semibold text-teal tracking-wide">{c.codigo}</span>{c.vence && ` · válido hasta el ${c.vence}`}
                              </span>
                            </span>
                            <span className="shrink-0 px-3 py-1.5 rounded-md bg-teal text-white font-body text-xs font-bold shadow-sm">Aplicar</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
  )

  return (
    <div className="max-w-[420px] mx-auto px-5 py-10">
      {etapa === 'pagando' ? (
        <button onClick={() => window.history.back()} className="border-none bg-transparent text-inksoft font-body text-[13px] mb-5 p-0">
          ← Volver a mi pedido
        </button>
      ) : (
        <button onClick={() => router.push('/')} className="border-none bg-transparent text-inksoft font-body text-[13px] mb-5 p-0">
          ← Volver a la tienda
        </button>
      )}
      {avisoVolvio && etapa === 'entrega' && (
        <div className="font-body text-xs text-teal bg-tealsoft border border-teal rounded-lg px-3 py-2 mb-4">
          Volviste a tu pedido: tus datos siguen cargados. Cambiá lo que necesites y confirmá de nuevo para pagar.
        </div>
      )}

      {!cuentaPrueba && cerradoAhora && etapa === 'entrega' && items.length > 0 && (
        <div className="bg-indigo-950 text-white rounded-xl px-4 py-3.5 mb-4">
          <div className="font-body text-sm font-semibold">🌙 {mensajeTiendaCerrada()}</div>
          <div className="font-body text-xs text-indigo-100 mt-1">
            Tomamos pedidos de 8:00 a 20:00. Tu carrito y tus datos quedan guardados.
          </div>
          {avisoApertura === 'listo' ? (
            <div className="font-body text-xs text-emerald-300 font-semibold mt-2">✓ Listo: a las 8:00 te avisamos en la 🔔 campanita para que termines tu compra en un toque.</div>
          ) : (
            <button type="button" onClick={avisarAlAbrir} disabled={avisoApertura === 'guardando' || !usuario} className="mt-2.5 px-3.5 py-2 rounded-lg border-none bg-white text-indigo-950 font-body text-xs font-semibold disabled:opacity-60">
              {avisoApertura === 'guardando' ? 'Guardando…' : '🔔 Avisame cuando abra'}
            </button>
          )}
          {avisoApertura === 'error' && <div className="font-body text-[11px] text-rose-300 mt-1">No se pudo guardar el aviso. Probá de nuevo.</div>}
        </div>
      )}
      {cuentaPrueba && (
        <div className="font-body text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">
          🧪 Cuenta de prueba: sin restricciones de horario (tienda y envío express siempre disponibles).
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>📍 {gpsRealPrueba ? 'Ubicación: tu GPS real' : <>Ubicación de prueba: <b>{ubicacionPrueba.direccion}</b> · {ubicacionPrueba.zona} (Potosí)</>}</span>
            {!gpsRealPrueba && etapa === 'entrega' && (
              <button type="button" onClick={() => { setMetodoEntrega('envio'); setMetodoElegido(true); completarConCasaPrueba() }} className="px-2 py-0.5 rounded border border-indigo-300 bg-white text-indigo-700 font-semibold">Completar con esta casa</button>
            )}
            <button type="button" onClick={() => cambiarGpsRealPrueba(!gpsRealPrueba)} className="underline bg-transparent border-none p-0 text-indigo-700">{gpsRealPrueba ? 'volver a la de Potosí' : 'usar mi GPS real'}</button>
            {!gpsRealPrueba && <span className="text-indigo-500">(para cambiarla, marcá otra casa en el mapa)</span>}
          </div>
        </div>
      )}

      {etapa === 'entrega' && (
        <div className="bg-panel border border-line rounded-xl p-6">
          <div className="font-display text-lg font-bold text-ink mb-3">¿Cómo quieres recibir tu pedido?</div>

          {/* Cómo recibirlo: opciones para elegir (como envío normal/express). */}
          <div className="grid gap-2 mb-4" role="radiogroup" aria-label="Cómo recibir el pedido">
            {[
              { id: 'envio' as const, mostrar: envioClasiDisponible, icono: '🛵', titulo: `Envío${envioVendedorDisponible ? ' Clasi Click' : ''}`, detalle: 'Te lo llevamos a tu casa' },
              { id: 'vendedor' as const, mostrar: envioVendedorDisponible, icono: '🚚', titulo: 'Envío del vendedor', detalle: 'Lo envía la tienda; el costo lo coordina con vos' },
              { id: 'retiro' as const, mostrar: opcionesCheckout.retiro || (!envioClasiDisponible && !envioVendedorDisponible), icono: '🏬', titulo: 'Retiro en tienda', detalle: 'Lo pasás a buscar, sin costo de envío' },
            ].filter((o) => o.mostrar).map((o) => {
              const elegida = metodoElegido && metodoEntrega === o.id
              return (
                <label key={o.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 cursor-pointer ${elegida ? 'border-teal bg-tealsoft' : 'border-line bg-panel'}`}>
                  <input type="radio" name="metodoEntrega" checked={elegida} onChange={() => { setMetodoEntrega(o.id); setMetodoElegido(true); setError('') }} className="sr-only" />
                  <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${elegida ? 'border-teal' : 'border-line'}`} aria-hidden>
                    {elegida && <span className="w-2.5 h-2.5 rounded-full bg-teal" />}
                  </span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block font-body text-sm font-semibold text-ink">{o.icono} {o.titulo}</span>
                    <span className="block font-body text-[11px] text-inksoft">{o.detalle}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {!envioClasiDisponible && !envioVendedorDisponible && !consultandoVendedores && (
            <div className="font-body text-[12px] text-inksoft mb-3 -mt-2">
              {envioClasiCiudad ? 'Algunos productos son de otra ciudad: coordiná el retiro o el envío con el vendedor.' : 'En tu ciudad todavía no hay envío de Clasi Click y este vendedor no hace envíos: podés retirarlo en la tienda.'}
            </div>
          )}

          {!metodoElegido && (
            <div className="font-body text-[12px] text-inksoft mb-2">Elegí una opción para seguir.</div>
          )}

          {metodoElegido && (
          <>
          <label className="block text-left mb-4">
            <span className="font-body text-[12px] font-semibold text-ink block mb-1">Tu nombre *</span>
            <InputSugerencias
              value={nombreComprador}
              onChange={setNombreComprador}
              opciones={sugerir(datosUsados.nombres, nombreComprador)}
              placeholder="Nombre y apellido"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
            />
          </label>

          <label className="block text-left mb-4">
            <span className="font-body text-[12px] font-semibold text-ink block mb-1">Tu WhatsApp *</span>
            <InputSugerencias
              value={whatsappComprador}
              onChange={setWhatsappComprador}
              opciones={sugerir(datosUsados.whatsapps, whatsappComprador)}
              placeholder="Ej: 71234567"
              inputMode="tel"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
            />
            <span className="font-body text-[11px] text-inksoft block mt-1">
              Para mandar el comprobante de pago y avisarte cuando esté confirmado.
            </span>
          </label>

          {metodoEntrega === 'envio' ? (
            <>
              <label className="block text-left mb-1">
                <span className="font-body text-[12px] font-semibold text-ink block mb-1">Calle y número *</span>
                <InputSugerencias
                  value={direccion}
                  opciones={datosUsados.direcciones.filter((d) => coincideInicio(d.direccion, direccion)).slice(0, 4).map((d) => ({ texto: d.direccion, detalle: [d.zona, d.entreCalles && `entre ${d.entreCalles}`].filter(Boolean).join(' · '), dato: d }))}
                  onElegir={(s) => usarDireccion(s.dato as DireccionUsada)}
                  icono="📍"
                  onChange={(v) => {
                    setDireccion(v)
                    setDireccionVerificada(null)
                    setMotivoDireccion('')
                    if (origenBarrio === 'direccion' || origenBarrio === 'guardado') setOrigenBarrio('')
                    if (origenPunto === 'direccion') { setLat(null); setLng(null); setOrigenPunto('') }
                  }}
                  onBlur={() => { tocar('direccion'); if (!validarDireccion(direccion) && direccionVerificada === null && !verificandoDireccion) verificarDireccion() }}
                  placeholder="Ej: Av. Universitaria 123"
                  className={`w-full px-3 py-2.5 rounded-lg border bg-panel font-body text-sm ${tocados.direccion && validarDireccion(direccion) ? 'border-maroon' : 'border-line'}`}
                />
              </label>
              <div className="mb-2 min-h-[16px] font-body text-[11px]">
                {tocados.direccion && validarDireccion(direccion) ? (
                  <span className="text-maroon">⚠ {validarDireccion(direccion)}</span>
                ) : verificandoDireccion ? (
                  <span className="text-inksoft">Buscando tu dirección en el mapa...</span>
                ) : direccionVerificada === false ? (
                  <span className="text-maroon">⚠ {motivoDireccion && !motivoDireccion.startsWith('No encontramos') ? motivoDireccion + ' ' : 'No encontramos esa dirección en el mapa. '}{lat == null ? 'Marcá tu casa en el mapa o usá tu ubicación.' : ''}</span>
                ) : direccionVerificada === 'error' ? (
                  <span className="text-ochre">No pudimos buscarla en el mapa ahora: marcá tu casa en el mapa o elegí tu zona abajo.</span>
                ) : origenPunto === 'direccion' ? (
                  <span className="text-teal">✓ Encontramos tu dirección en el mapa. ¿No es ahí? Marcá tu casa en el mapa.</span>
                ) : (
                  <span className="text-inksoft">El nombre de la calle y el número de la casa. Si no tiene número, poné “s/n”.</span>
                )}
              </div>
              <div className={`flex flex-wrap gap-2 mb-3 ${direccionVerificada === false && lat == null ? 'p-2.5 rounded-lg border border-maroon bg-maroonsoft' : ''}`}>
                {opcionesCheckout.gps && (
                <button
                  type="button"
                  onClick={usarMiUbicacion}
                  disabled={buscandoUbicacion}
                  className={`flex-1 min-w-[150px] px-3 py-2 rounded-lg border font-body text-[12px] font-semibold disabled:opacity-60 ${origenPunto === 'gps' ? 'border-teal bg-tealsoft text-teal' : 'border-line bg-panel text-ink'}`}
                >
                  {buscandoUbicacion ? 'Buscando...' : origenPunto === 'gps' ? '✓ Usamos tu ubicación' : '📍 Estoy ahí: usar mi ubicación'}
                </button>
                )}
                {opcionesCheckout.mapa && (
                <button
                  type="button"
                  onClick={() => (mapaAbierto ? setMapaAbierto(false) : abrirMapa())}
                  className={`flex-1 min-w-[150px] px-3 py-2 rounded-lg border font-body text-[12px] font-semibold ${origenPunto === 'mapa' ? 'border-teal bg-tealsoft text-teal' : 'border-line bg-panel text-ink'}`}
                >
                  {origenPunto === 'mapa' && !mapaAbierto ? '✓ Casa marcada (cambiar)' : '🗺️ Marcar mi casa en el mapa'}
                </button>
                )}
              </div>
              {mapaAbierto && puntoMapa && (
                <div className="mb-3">
                  <div className="font-body text-[11px] text-inksoft mb-1.5">Tocá el mapa o arrastrá el 📍 hasta tu casa.</div>
                  <ElegirUbicacion inicial={puntoMapa} onCambiar={(a, b) => setPuntoMapa({ lat: a, lng: b })} />
                  <div className="flex items-center gap-2 mt-2">
                    <span className="flex-1 font-body text-[12px] text-ink">
                      Envío desde ese punto: <strong>{bs(costoPorDistancia(puntoMapa.lat, puntoMapa.lng))}</strong>
                    </span>
                    <button type="button" onClick={() => setMapaAbierto(false)} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs">Cancelar</button>
                    <button type="button" onClick={confirmarMapa} className="px-3 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold">Confirmar</button>
                  </div>
                </div>
              )}

              {/* Zona (antes "barrio"): la escribe el comprador, libre. El costo
                  sale del punto de la casa; la zona solo se controla por dentro
                  (validacionZona) y las nuevas se suman a la lista. */}
              <div className="relative mb-1">
                <label className="block text-left">
                  <span className="font-body text-[12px] font-semibold text-ink block mb-1">Zona *</span>
                  <input
                    value={zonaTexto}
                    onChange={(e) => {
                      const v = e.target.value
                      setZonaTexto(v)
                      // Se escribe libre (sin lista): vale cualquier nombre real.
                      const z = buscarZonaEn(zonas, v)
                      setZonaEntrega(z && normZona(z.nombre) === normZona(v) ? z.nombre : zonaLibreValida(v) ? v.trim() : '')
                      setOrigenBarrio(v.trim() ? 'manual' : '')
                      setError('')
                    }}
                    onBlur={() => tocar('zona')}
                    placeholder="Ej: Cuarto Centenario, San Benito…"
                    autoComplete="off"
                    className={`w-full px-3 py-2.5 rounded-lg border bg-panel font-body text-sm ${tocados.zona && !zonaEntrega ? 'border-maroon' : zonaEntrega ? 'border-teal' : 'border-line'}`}
                  />
                </label>
              </div>
              <div className="mb-3 min-h-[16px] font-body text-[11px]">
                {zonaEntrega ? (
                  <span className="text-teal">
                    ✓ Envío <strong>{bs(costoZona)}</strong>
                    {lat != null && lng != null ? ' · calculado con la ubicación de tu casa' : zonaElegidaInfo ? ` a ${zonaEntrega}` : ' · tarifa estándar (marcá tu casa en el mapa para calcularla exacta)'}
                  </span>
                ) : tocados.zona || zonaTexto ? (
                  <span className="text-maroon">⚠ {validarZona(zonaTexto, { zonas, conPunto: true })}</span>
                ) : (
                  <span className="text-inksoft">Escribí el nombre de tu zona o barrio.</span>
                )}
              </div>

              <label className="block text-left mb-1">
                <span className="font-body text-[12px] font-semibold text-ink block mb-1">Entre calles *</span>
                <InputSugerencias
                  value={entreCalles}
                  opciones={sugerir(Array.from(new Set(datosUsados.direcciones.map((d) => d.entreCalles).filter(Boolean))), entreCalles)}
                  onChange={(v) => { setEntreCalles(v); setEntreConfirmado(false) }}
                  onBlur={() => tocar('entre')}
                  placeholder={sugerenciaEntre ? `Ej: ${sugerenciaEntre}` : 'Ej: Bolívar y Junín'}
                  className={`w-full px-3 py-2.5 rounded-lg border bg-panel font-body text-sm ${(tocados.entre && validarEntreCalles(entreCalles, direccion)) || (tocados.entre && entreNoCoincide) ? 'border-maroon' : 'border-line'}`}
                />
              </label>
              <div className="mb-3 min-h-[16px] font-body text-[11px]">
                {tocados.entre && validarEntreCalles(entreCalles, direccion) && !sugerenciaEntre ? (
                  <span className="text-maroon">⚠ {validarEntreCalles(entreCalles, direccion)}</span>
                ) : entreNoCoincide && tocados.entre ? (
                  <div className="text-maroon">
                    ⚠ Según el mapa, {entreMalas!.join(' y ')} no {entreMalas!.length > 1 ? 'cruzan' : 'cruza'} la <b>{infoEntre!.calle}</b> cerca de tu casa.
                    {sugerenciaEntre && <> Tu cuadra está entre <b>{sugerenciaEntre}</b>.</>}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {sugerenciaEntre && (
                        <button type="button" onClick={() => setEntreCalles(sugerenciaEntre)} className="px-2.5 py-1 rounded-md border-none bg-teal text-white font-body text-[11px] font-semibold">Usar “{sugerenciaEntre}”</button>
                      )}
                      <button type="button" onClick={() => setEntreConfirmado(true)} className="px-2 py-1 rounded-md border border-line bg-panel text-inksoft font-body text-[11px]">Están bien, dejarlas así</button>
                    </div>
                  </div>
                ) : sugerenciaEntre && (!entreCalles.trim() || validarEntreCalles(entreCalles, direccion)) ? (
                  <div className="text-inksoft">
                    📍 Según el mapa, tu casa en la {infoEntre!.calle} está entre <b>{sugerenciaEntre}</b>.{' '}
                    <button type="button" onClick={() => { setEntreCalles(sugerenciaEntre); tocar('entre') }} className="text-teal underline bg-transparent border-none p-0 font-body text-[11px] font-semibold">Usar estas</button>
                  </div>
                ) : !entreMalas && puntoFiable && infoEntre?.cruces.length && entreCalles.trim() && !validarEntreCalles(entreCalles, direccion) ? (
                  <span className="text-teal">✓ Coincide con el mapa.</span>
                ) : (
                  <span className="text-inksoft">Las dos calles a los costados de tu cuadra.</span>
                )}
              </div>
              <label className="block text-left mb-4">
                <span className="font-body text-[12px] font-semibold text-ink block mb-1">Otro dato de referencia <span className="font-normal text-inksoft">(opcional)</span></span>
                <input
                  value={referenciaAdicional}
                  onChange={(e) => setReferenciaAdicional(e.target.value)}
                  placeholder="Ej: portón verde, al lado de la farmacia"
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                />
              </label>

              {/* Tipo de envío: opciones para elegir (no botones de acción),
                  con cuándo llega y cuánto cuesta cada una. */}
              <fieldset className="mb-3 border-none p-0 m-0">
                <legend className="font-body text-[12px] font-semibold text-ink mb-1.5">¿Cuándo lo querés recibir?</legend>
                <div className="grid gap-2">
                  {[
                    { express: false, icono: '🛵', titulo: 'Envío normal', detalle: `Llega ${fechaEntregaTexto()}`, precio: zonaEntrega || lat != null ? bs(costoZona) : '', disabled: false, mostrar: true },
                    { express: true, icono: '⚡', titulo: 'Envío express', detalle: expressDisponible ? `Llega hoy mismo · pedí antes de las ${HORA_CORTE_EXPRESS}:00` : `Solo para pedidos antes de las ${HORA_CORTE_EXPRESS}:00`, precio: zonaEntrega || lat != null ? bs(costoZona + COSTO_ENVIO_EXPRESS_EXTRA) : `+${bs(COSTO_ENVIO_EXPRESS_EXTRA)}`, disabled: !expressDisponible, mostrar: opcionesCheckout.express && (cuentaPrueba || hayEntregaHoy()) },
                  ].filter((o) => o.mostrar).map((o) => {
                    const elegida = tipoEnvioElegido && envioExpress === o.express
                    return (
                      <label
                        key={o.titulo}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 cursor-pointer ${o.disabled ? 'opacity-50 cursor-not-allowed border-line bg-panelalt' : elegida ? 'border-teal bg-tealsoft' : 'border-line bg-panel'}`}
                      >
                        <input type="radio" name="tipoEnvio" checked={elegida} disabled={o.disabled} onChange={() => { setEnvioExpress(o.express); setTipoEnvioElegido(true); setError('') }} className="sr-only" />
                        <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${elegida ? 'border-teal' : 'border-line'}`} aria-hidden>
                          {elegida && <span className="w-2.5 h-2.5 rounded-full bg-teal" />}
                        </span>
                        <span className="flex-1 min-w-0 text-left">
                          <span className="block font-body text-sm font-semibold text-ink">{o.icono} {o.titulo}</span>
                          <span className="block font-body text-[11px] text-inksoft">{o.detalle}</span>
                        </span>
                        {o.precio && <span className="font-body text-sm font-semibold text-ink shrink-0">{o.precio}</span>}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              {descuentoEnvioCupon > 0 && (
                <div className="font-body text-sm text-teal bg-tealsoft border border-teal rounded-lg px-3 py-2.5 mb-3">
                  🎉 <strong>¡Envío gratis!</strong>
                  {costoEnvioFinal > 0 && <> — pagás solo el extra del express ({bs(costoEnvioFinal)})</>}
                </div>
              )}


            </>
          ) : (
            <>
              {metodoEntrega === 'vendedor' && (
                <>
                  <div className="font-body text-[12px] text-ink mb-3 bg-tealsoft border border-teal rounded-lg p-3">
                    🚚 El envío lo hace el vendedor: le pagás a él y coordinan la entrega por WhatsApp.
                    {vendedorIdsCarrito.map((id) => {
                      const e = infoEnvioVendedores[id]?.envioPropio
                      const nombre = items.find((i) => i.vendedorId === id)?.vendedor || 'Vendedor'
                      return (
                        <div key={id} className="mt-1 text-inksoft">
                          · {nombre}: {e?.costo != null ? bs(e.costo) : 'costo a coordinar'}{e?.detalle ? ` — ${e.detalle}` : ''}
                        </div>
                      )
                    })}
                  </div>
                  <label className="block text-left mb-3">
                    <span className="font-body text-[11px] text-inksoft block mb-1">Dirección de entrega *</span>
                    <input
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Calle, número y zona"
                      className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                    />
                  </label>
                  <label className="block text-left mb-4">
                    <span className="font-body text-[11px] text-inksoft block mb-1">Otro dato de referencia (opcional)</span>
                    <input
                      value={referenciaAdicional}
                      onChange={(e) => setReferenciaAdicional(e.target.value)}
                      placeholder="Ej: portón verde, al lado de la farmacia"
                      className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
                    />
                  </label>
                </>
              )}
              {consultandoVendedores ? (
                <div className="font-body text-[12px] text-inksoft mb-4 bg-panelalt border border-line rounded-lg p-3">
                  Verificando cómo podés pagarle a cada vendedor...
                </div>
              ) : algunVendedorConQR ? (
                <>
                  <div className="font-body text-[12px] text-inksoft mb-4 bg-panelalt border border-line rounded-lg p-3">
                    {metodoEntrega === 'vendedor' ? 'Coordinás la entrega con cada vendedor por WhatsApp una vez que confirmes el pago.' : 'Coordinás el retiro directo con cada vendedor por WhatsApp una vez que confirmes el pago.'}
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

          {/* Resumen antes de pagar (cuando ya eligió cómo recibirlo y, con
              envío, el tipo de envío): se pueden cambiar cantidades, quitar
              o volver a agregar más productos. */}
          {entregaLista && items.length > 0 && (
            <div className="mb-4 rounded-xl border border-line bg-panelalt p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-body text-sm font-semibold text-ink">🧾 Resumen de tu pedido</div>
                <Link href={vendedorIdTienda ? `/tienda/${vendedorIdTienda}` : '/'} className="font-body text-[12px] text-teal font-semibold underline">➕ Agregar más</Link>
              </div>
              <div className="divide-y divide-line">
                {items.map((it) => (
                  <div key={`${it.id}__${it.tallaElegida || ''}__${it.colorElegida || ''}`} className="flex items-center gap-2.5 py-2">
                    <div className="w-10 h-10 rounded-md bg-panel border border-line overflow-hidden shrink-0 flex items-center justify-center">
                      {it.thumbUrl || it.imagenUrl ? <img src={it.thumbUrl || it.imagenUrl} alt={it.nombre} className="w-full h-full object-cover" /> : <ProductIcon kind={it.icono} size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-[13px] text-ink truncate">{it.nombre}</div>
                      {(it.tallaElegida || it.colorElegida) && <div className="font-body text-[11px] text-inksoft">{[it.tallaElegida && `Talla ${it.tallaElegida}`, it.colorElegida].filter(Boolean).join(' · ')}</div>}
                      <div className="flex items-center gap-2 mt-1">
                        <button type="button" onClick={() => cambiarCantidad(it, -1)} disabled={it.cantidad <= 1} className="w-6 h-6 rounded border border-line bg-panel text-xs disabled:opacity-40" aria-label="Menos">−</button>
                        <span className="font-body text-xs text-ink w-4 text-center">{it.cantidad}</span>
                        <button type="button" onClick={() => cambiarCantidad(it, 1)} className="w-6 h-6 rounded border border-line bg-panel text-xs" aria-label="Más">+</button>
                        <button type="button" onClick={() => quitar(it)} className="font-body text-[11px] text-maroon underline bg-transparent border-none p-0 ml-1">quitar</button>
                      </div>
                    </div>
                    <span className="font-body text-[13px] text-ink shrink-0">{bs(it.precio * it.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line mt-1 pt-2 grid gap-0.5 font-body text-[13px]">
                <div className="flex justify-between text-inksoft"><span>Subtotal</span><span>{bs(subtotalCarrito)}</span></div>
                {descuentoCupon > 0 && <div className="flex justify-between text-teal"><span>Cupón {cuponAplicado?.codigo}</span><span>−{bs(descuentoCupon)}</span></div>}
                {metodoEntrega === 'envio' && (
                  <div className="flex justify-between text-inksoft"><span>{envioExpress ? 'Envío express' : 'Envío'}</span><span>{descuentoEnvioCupon > 0 ? <><span className="line-through mr-1">{bs(costoEnvio)}</span><span className="text-teal font-semibold">{costoEnvioFinal === 0 ? 'Gratis' : bs(costoEnvioFinal)}</span></> : bs(costoEnvio)}</span></div>
                )}
                {metodoEntrega === 'vendedor' && <div className="flex justify-between text-inksoft"><span>Envío del vendedor</span><span>{envioVendedorTotal > 0 ? bs(envioVendedorTotal) : 'a coordinar'}</span></div>}
                {metodoEntrega === 'retiro' && <div className="flex justify-between text-inksoft"><span>Retiro en tienda</span><span>Sin costo</span></div>}
                <div className="flex justify-between font-semibold text-ink text-sm pt-1"><span>Total</span><span>{bs(totalCarrito)}</span></div>
              </div>
            </div>
          )}

          {error && (
            <div className="font-body text-xs text-maroon mb-3">{error}</div>
          )}

          <button
            onClick={confirmarEntregaYCrearPedidos}
            disabled={authCargando}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
          >
            {metodoEntrega !== 'envio' && metodoPago === 'efectivo' ? 'Continuar compra por WhatsApp' : 'Pagar'}
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
          {/* Resumen de lo que se está pagando, antes del QR -- para
              que quede clara la compra justo en el momento de pagar,
              no solo más arriba en el paso de entrega. */}
          <div className="text-left bg-panelalt border border-line rounded-lg p-3.5 mb-4">
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
            {(subPedidos[pasoActual].descuento || 0) > 0 && (
              <div className="flex items-center justify-between font-body text-[13px] text-teal">
                <span>Descuento cupón</span>
                <span>−{bs(subPedidos[pasoActual].descuento || 0)}</span>
              </div>
            )}
            {(subPedidos[pasoActual].descuentoEnvio || 0) > 0 ? (
              <div className="flex items-center justify-between font-body text-[13px] text-inksoft">
                <span>Envío</span>
                <span>
                  <span className="line-through mr-1.5">{bs(subPedidos[pasoActual].costoEnvio + (subPedidos[pasoActual].descuentoEnvio || 0))}</span>
                  <span className="text-teal font-semibold">
                    {subPedidos[pasoActual].costoEnvio === 0 ? '🎉 Gratis' : bs(subPedidos[pasoActual].costoEnvio)}
                  </span>
                </span>
              </div>
            ) : subPedidos[pasoActual].costoEnvio > 0 && (
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

          {!comprobanteUrl && subPedidos[pasoActual].estadoActual !== 'cancelado' && (
            <div className="text-left mb-4">
              {rehaciendo ? <div className="font-body text-xs text-inksoft">Aplicando…</div> : bloqueCupon}
            </div>
          )}

          <div className="font-body text-base font-bold text-ink bg-ochresoft border border-ochre rounded-lg px-4 py-3 mb-4 text-center">
            Descargue el QR para el pago. Una vez realizado vuelva a esta página y suba el comprobante.
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
              <QrLimpio url={subPedidos[pasoActual].qrImageUrl!} nombreArchivo={`qr-pago-${bs(subPedidos[pasoActual].total).replace(/\D/g, '')}bs.png`} />
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

          <div className="mb-4" />

          {subPedidos[pasoActual].estadoActual === 'cancelado' ? (
            <div className="font-body text-sm text-maroon bg-maroonsoft border border-maroon rounded-lg px-4 py-4 text-left">
              <div className="font-bold text-base mb-1">❌ Compra anulada</div>
              <div>Se rechazaron {MAX_INTENTOS_COMPROBANTE} comprobantes inválidos para este pago, cualquier duda contactese por WhatsApp.</div>
              {whatsappPlataforma && (
                <a
                  href={`https://wa.me/${whatsappPlataforma.length === 8 ? `591${whatsappPlataforma}` : whatsappPlataforma}?text=${encodeURIComponent(`Hola Clasi Click, mi compra #${(subPedidos[pasoActual].pedidoId || '').slice(0, 6)} fue anulada por el comprobante. ¿Me pueden ayudar?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 rounded-lg bg-teal text-white font-body text-sm font-semibold no-underline"
                >
                  💬 Escribir a Clasi Click por WhatsApp
                </a>
              )}
              <Link href="/" className="inline-block mt-3 font-semibold underline">Volver al inicio</Link>
            </div>
          ) : (
          <>
          <div className="text-left mb-4">
            {rechazoComprobante && !comprobanteUrl && (
              <div className="font-body text-sm text-maroon bg-maroonsoft border-2 border-maroon rounded-lg px-3.5 py-3 mb-3">
                <div className="font-bold text-base">❌ Comprobante Inválido, vuelva a intentarlo</div>
                {/* El motivo exacto no se le muestra al comprador (queda
                    guardado en el pedido y lo ve el admin). */}
                {rechazoComprobante.intentos > 0 && (
                  <div className="mt-1 font-semibold">
                    Intento {rechazoComprobante.intentos} de {MAX_INTENTOS_COMPROBANTE}
                    {MAX_INTENTOS_COMPROBANTE - rechazoComprobante.intentos === 1 && ' — si el próximo tampoco es válido, la compra se anula.'}
                  </div>
                )}
              </div>
            )}
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
                      Volver a subir el comprobante
                    </button>
                  </div>
                </div>

                {leyendoOCR && (
                  <div className="font-body text-[11px] text-inksoft">Leyendo el comprobante...</div>
                )}
                {!leyendoOCR && resultadoOCR?.coincide === true && (
                  <div className="font-body text-[11px] text-teal bg-tealsoft border border-teal rounded-lg px-2.5 py-2">
                    ✓ Comprobante verificado
                  </div>
                )}
                {(registrandoRechazo || (!leyendoOCR && resultadoOCR && !comprobanteValido(resultadoOCR))) && (
                  <div className="font-body text-[11px] text-inksoft">Revisando el comprobante...</div>
                )}
              </div>
            ) : (
              <>
                <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-teal text-teal bg-tealsoft font-body text-sm font-bold cursor-pointer ${subiendoComprobante ? 'opacity-50 pointer-events-none' : ''}`}>
                  📷 Subí comprobante
                  <input
                    type="file"
                    accept="image/*"
                    disabled={subiendoComprobante}
                    onChange={(e) => { subirComprobante(e.target.files?.[0] || null); e.target.value = '' }}
                    className="sr-only"
                  />
                </label>
                {subiendoComprobante && <div className="font-body text-xs text-inksoft mt-1.5">Subiendo...</div>}
              </>
            )}
          </div>

          {error && <div className="font-body text-base font-bold text-maroon bg-maroonsoft border-2 border-maroon rounded-lg px-3.5 py-3 mb-3">❌ {error}</div>}

          <button
            onClick={declararPagoActual}
            disabled={!comprobanteUrl || subiendoComprobante || leyendoOCR || registrandoRechazo || (!!resultadoOCR && !comprobanteValido(resultadoOCR))}
            className="w-full py-3 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-40"
          >
            ✓ Continuar
          </button>
          </>
          )}
        </div>
      )}

      {etapa === 'esperando' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          <div
            className={`w-11 h-11 rounded-full text-white flex items-center justify-center mx-auto mb-3.5 text-xl ${
              pedidoCancelado ? 'bg-maroon' : 'bg-ochre animate-pulse'
            }`}
          >
            {pedidoCancelado ? '✕' : '🤔'}
          </div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            {pedidoCancelado ? 'Pedido cancelado' : 'Procesando Pago'}
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
              (puede tardar unos minutos) o puedes seguir tu pedido desde{' '}
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

      {etapa === 'resumen' && metodoEntrega !== 'envio' && metodoPago === 'efectivo' && (
        <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center">
          <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">Pedido registrado</div>
          <div className="font-body text-[13px] text-inksoft">
            {metodoEntrega === 'vendedor' ? 'Coordiná el envío y el pago directo por WhatsApp con el vendedor.' : 'Coordiná el retiro y el pago directo por WhatsApp con el vendedor.'}
          </div>
        </div>
      )}

      {etapa === 'resumen' && !(metodoEntrega !== 'envio' && metodoPago === 'efectivo') && (
        <div>
          {/* Una vez que se confirma el día/horario de entrega (ver
              SelectorHorarioEntrega más abajo), este cartel desaparece
              — la confirmación pasa a ser la de "Su compra se ha
              realizado con éxito" del selector, no hace falta repetir
              las dos. Con retiro en tienda no hay horario que elegir,
              así que ahí este cartel se queda siempre. */}
          {subPedidos.every((s) => s.estadoActual === 'pagado') && !(metodoEntrega === 'envio' && franjaHoraria) ? (
            <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center mb-4">
              <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
              <div className="font-display text-lg font-bold text-ink mb-1.5">Su pago se ha realizado con éxito!</div>
              {metodoEntrega === 'envio' ? (
                <div className="font-body text-[13px] text-inksoft">
                  {envioExpress ? 'El producto te llegará hoy.' : `Estará recibiendo el pedido ${fechaEntregaTexto(fechaElegida)}.`}
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