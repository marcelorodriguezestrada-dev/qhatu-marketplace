// Admin → 🎯 Captar tiendas: prospectos (tiendas que queremos sumar a
// Clasi Click), la campaña de captación ("1 año gratis a las 10
// primeras") y lo que se comparte entre el panel y las APIs.

export type EstadoProspecto = 'nuevo' | 'contactado' | 'interesado' | 'registrado' | 'descartado'

export const ESTADOS_PROSPECTO: { id: EstadoProspecto; label: string; color: string }[] = [
  { id: 'nuevo', label: '🆕 Nuevo', color: '#6366f1' },
  { id: 'contactado', label: '💬 Contactado', color: '#0ea5e9' },
  { id: 'interesado', label: '🔥 Interesado', color: '#f59e0b' },
  { id: 'registrado', label: '✅ Registrado', color: '#16a34a' },
  { id: 'descartado', label: '✖️ Descartado', color: '#9ca3af' },
]

export type Prospecto = {
  id: string
  nombre: string
  rubro: string
  ciudad: string
  whatsapp: string
  direccion: string
  lat: number | null
  lng: number | null
  estado: EstadoProspecto
  notas: string
  contacto: string
  redes: string
  origen: 'mapa' | 'manual'
  osmId?: string
  beneficio: boolean
  estrategia?: EstrategiaProspecto | null
  createdAt: string
  updatedAt?: string
  contactadoAt?: string | null
  registradoAt?: string | null
  // Seguimiento: 0 = sin contactar, 1 = primer mensaje enviado,
  // 2 = seguimiento enviado, 3 = cierre enviado. proximoSeguimiento es la
  // fecha (YYYY-MM-DD) en que toca volver a escribirle.
  pasoSeguimiento?: number
  proximoSeguimiento?: string | null
  historial?: { fecha: string; accion: string }[]
  telefonoFijo?: boolean
  // Su cuenta de vendedor en Clasi Click, cuando le creamos la tienda.
  vendedorId?: string | null
  email?: string
}

export type Campana = { oferta: string; cupos: number; mensajeBase: string }
export const CAMPANA_DEFECTO: Campana = {
  oferta: '1 año gratis de tienda en Clasi Click',
  cupos: 10,
  mensajeBase: '',
}

export type EstrategiaProspecto = {
  resumen: string
  mensajeInicial: string
  seguimiento1: string
  seguimiento2: string
  argumentos: string[]
  objeciones: { objecion: string; respuesta: string }[]
  pasos: string[]
  // Guion para llamarlo por teléfono: qué decir en cada momento.
  guionLlamada?: { paso: string; decir: string }[]
}

export type PlanCampana = {
  resumen: string
  fases: { nombre: string; cuando: string; acciones: string[] }[]
  mensajeGeneral: string
  publicacion: string
  metas: string[]
}

// Tienda de OpenStreetMap (lo que muestra el mapa).
export type TiendaMapa = {
  osmId: string
  nombre: string
  rubro: string
  lat: number
  lng: number
  telefono: string
  direccion: string
  web: string
}

// Etiquetas de OSM → rubro en castellano.
const RUBROS_OSM: Record<string, string> = {
  clothes: 'Ropa', shoes: 'Calzado', boutique: 'Boutique', fashion: 'Moda', fashion_accessories: 'Accesorios', bag: 'Carteras y bolsos',
  jewelry: 'Joyería', watches: 'Relojes', cosmetics: 'Cosméticos', beauty: 'Belleza', hairdresser: 'Peluquería', perfumery: 'Perfumería',
  mobile_phone: 'Celulares', electronics: 'Electrónica', computer: 'Computación', appliance: 'Electrodomésticos', hardware: 'Ferretería',
  doityourself: 'Ferretería', furniture: 'Muebles', interior_decoration: 'Decoración', houseware: 'Artículos para el hogar', gift: 'Regalos',
  toys: 'Juguetes', baby_goods: 'Bebés', sports: 'Deportes', bicycle: 'Bicicletas', books: 'Librería', stationery: 'Librería y papelería',
  copyshop: 'Fotocopias', optician: 'Óptica', pharmacy: 'Farmacia', chemist: 'Farmacia', convenience: 'Tienda de barrio', supermarket: 'Supermercado',
  bakery: 'Panadería', butcher: 'Carnicería', greengrocer: 'Verdulería', pastry: 'Pastelería', confectionery: 'Dulces', alcohol: 'Licorería',
  beverages: 'Bebidas', kiosk: 'Kiosco', variety_store: 'Variedades', general: 'Tienda general', department_store: 'Tienda por departamentos',
  tailor: 'Sastrería', fabric: 'Telas', sewing: 'Costura', craft: 'Artesanías', art: 'Arte', florist: 'Florería', pet: 'Mascotas',
  car_parts: 'Repuestos de auto', car_repair: 'Taller mecánico', motorcycle: 'Motos', tyres: 'Llantas', photo: 'Fotografía', music: 'Música',
  second_hand: 'Usados', charity: 'Usados', tobacco: 'Tabaquería', laundry: 'Lavandería', dry_cleaning: 'Lavandería', travel_agency: 'Agencia de viajes',
  restaurant: 'Restaurante', cafe: 'Café', fast_food: 'Comida rápida', ice_cream: 'Heladería',
}
export const rubroOSM = (tags: Record<string, string>) => {
  const v = tags.shop || tags.craft || tags.amenity || ''
  return RUBROS_OSM[v] || (v ? v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Tienda')
}

// Celular boliviano para wa.me: "7123-4567", "+591 71234567", "591 2 2441234".
export function numeroWhatsapp(t: string): string {
  const d = String(t || '').split(/[;,/]/)[0].replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('591') && d.length >= 11) return d
  if (d.length === 8 && /^[67]/.test(d)) return `591${d}`
  if (d.startsWith('00591')) return d.slice(2)
  return d.length >= 10 ? d : ''
}

export const linkWhatsapp = (numero: string, texto: string) => {
  const n = numeroWhatsapp(numero)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export const cuposRestantes = (campana: Campana, prospectos: Pick<Prospecto, 'beneficio'>[]) =>
  Math.max(0, campana.cupos - prospectos.filter((p) => p.beneficio).length)

const nombreCiudad = (c: string) => (c === 'la-paz' ? 'La Paz' : 'Potosí')

// Mensaje de primer contacto sin IA (y base para la IA).
export function mensajeInicialBase(p: Pick<Prospecto, 'nombre' | 'rubro' | 'ciudad' | 'contacto'>, campana: Campana, quedan: number, sitio: string) {
  const saludo = p.contacto ? `¡Hola ${p.contacto}!` : `¡Hola! ¿Hablo con ${p.nombre}?`
  return (
    `${saludo} 👋 Soy de *Clasi Click*, el marketplace de ${nombreCiudad(p.ciudad)} donde la gente compra online y recibe en su casa.\n\n` +
    `Estamos sumando tiendas de ${p.rubro ? p.rubro.toLowerCase() : 'la ciudad'} y las *${campana.cupos} primeras* tienen *${campana.oferta}* 🎁` +
    (quedan > 0 ? ` (quedan ${quedan} cupos).` : '.') +
    `\n\nVos subís tus productos con foto y precio, nosotros te traemos compradores y nos encargamos del cobro con QR y del envío. ` +
    `¿Te muestro en 5 minutos cómo quedaría tu tienda?\n\n👉 ${sitio}`
  )
}

export function estrategiaBase(p: Pick<Prospecto, 'nombre' | 'rubro' | 'ciudad' | 'contacto'>, campana: Campana, quedan: number, sitio: string): EstrategiaProspecto {
  return {
    resumen: `Contactar a ${p.nombre} por WhatsApp con la oferta de lanzamiento (${campana.oferta}) usando la escasez de cupos, y cerrar con una demo corta cargando 3 productos juntos.`,
    mensajeInicial: mensajeInicialBase(p, campana, quedan, sitio),
    seguimiento1: `¡Hola de nuevo! 😊 Te escribo por lo de *${campana.oferta}* en Clasi Click. ${quedan > 0 ? `Ya quedan ${quedan} cupos. ` : ''}Si me pasás 3 fotos de tus productos con precio, te armo la tienda yo mismo sin costo y la ves funcionando hoy. ¿Te parece?`,
    seguimiento2: `Último aviso 🙌 Cerramos la promo de lanzamiento esta semana. Si querés tu tienda gratis por un año, respondeme "SÍ" y te la dejo lista. Si no es buen momento, no hay problema, ¡gracias por tu tiempo!`,
    argumentos: [
      'Vende también cuando la tienda está cerrada: la gente compra desde el celular.',
      'Cobro seguro con QR y envío a domicilio en la ciudad.',
      `Cero costo durante el primer año (${campana.oferta}).`,
      'Nosotros cargamos los productos al principio: no le quita tiempo.',
      'Aparece en las búsquedas de Clasi Click y en las campañas en redes.',
    ],
    objeciones: [
      { objecion: 'No tengo tiempo para subir productos.', respuesta: 'Pasame fotos por WhatsApp y te los cargo yo. Después actualizar precio o stock es un toque.' },
      { objecion: 'Ya vendo por Facebook / WhatsApp.', respuesta: 'Perfecto, esto suma: te da un link de tienda con carrito, cobro con QR y envío, y te llegan compradores nuevos.' },
      { objecion: '¿Y después del año cuánto cuesta?', respuesta: 'Te avisamos con tiempo y decidís vos; no hay contrato ni permanencia.' },
      { objecion: 'No confío en vender online.', respuesta: 'El comprador paga antes de que despachemos y vos ves cada pedido en tu panel. Te muestro uno de prueba.' },
    ],
    pasos: [
      'Día 1: mensaje inicial por WhatsApp (mañana, 10 a 12 h).',
      'Día 2: si no respondió, seguimiento 1 con la propuesta de armarle la tienda.',
      'Día 4: visita en persona o llamada si está interesado; cargar 3 productos juntos.',
      'Día 7: seguimiento 2 (cierre de la promo).',
      'Al registrarse: marcarlo "Registrado" acá para asignarle el cupo y compartir su tienda en redes.',
    ],
    guionLlamada: guionBase(p, campana, quedan),
  }
}

// Guion de llamada (sin IA): ~5 minutos, de la presentación al cierre.
export function guionBase(p: Pick<Prospecto, 'nombre' | 'rubro' | 'ciudad' | 'contacto'>, campana: Campana, quedan: number): { paso: string; decir: string }[] {
  const ciudad = nombreCiudad(p.ciudad)
  const rubro = p.rubro ? p.rubro.toLowerCase() : 'sus productos'
  return [
    { paso: '1. Saludo y permiso (20 s)', decir: `Hola${p.contacto ? ` ${p.contacto}` : ''}, ¿qué tal? Soy de Clasi Click, te escribí por WhatsApp. ¿Tenés 3 minutitos? Te cuento algo rápido que te puede traer más ventas.` },
    { paso: '2. Gancho', decir: `Estamos armando el marketplace de ${ciudad}: la gente entra desde el celular, ve productos con foto y precio, paga con QR y se lo llevamos a su casa. Y estamos eligiendo pocas tiendas de ${rubro} para empezar.` },
    { paso: '3. Preguntá y escuchá', decir: '¿Hoy vendés por Facebook, WhatsApp o TikTok? ¿Hacés envíos? ¿Cuántos productos tenés más o menos? ¿Qué es lo que más se vende?' },
    { paso: '4. Propuesta: su tienda virtual', decir: `Te creamos tu tienda virtual "${p.nombre}" con tu link propio para compartir en tus redes y estados. Cada producto con fotos, precio, talles y colores. El cliente compra solo, paga con QR y nosotros hacemos el envío; vos ves cada pedido en tu panel.` },
    { paso: '5. Oferta y escasez', decir: `Las ${campana.cupos} primeras tiendas tienen ${campana.oferta}${quedan > 0 ? `, y quedan ${quedan} cupos` : ''}. No hay contrato ni permanencia.` },
    { paso: '6. Siguiente paso (proponé vos)', decir: 'Si te parece, te la creo ahora mismo mientras hablamos: pasame por WhatsApp 5 fotos de tus productos más vendidos con el precio, y hoy mismo te mando el link de tu tienda funcionando.' },
    { paso: '7. Si duda', decir: '"No tengo tiempo" → los productos te los cargo yo. "Ya vendo por Facebook" → esto suma: te da un link con carrito y cobro, y te llegan compradores nuevos. "¿Y después del año?" → te avisamos con tiempo y decidís vos.' },
    { paso: '8. Cierre', decir: '¿Te parece bien? Entonces te pido: un correo (o te creo uno), las fotos con precio y a qué hora te puedo mostrar la tienda armada. ¡Bienvenido a Clasi Click!' },
  ]
}

// Mensaje con sus datos de acceso cuando le creamos la tienda.
export function mensajeTiendaLista(p: Pick<Prospecto, 'nombre' | 'contacto'>, email: string, password: string, sitio: string, vendedorId: string) {
  return (
    `${p.contacto ? `¡Hola ${p.contacto}!` : '¡Hola!'} 🎉 Ya está lista tu tienda *${p.nombre}* en Clasi Click.\n\n` +
    `🛍️ Tu tienda: ${sitio}/tienda/${vendedorId}\n(compartí este link en tus estados y redes)\n\n` +
    `Para entrar a tu panel y ver tus pedidos:\n👉 ${sitio}/login\nUsuario: ${email}\n${password ? `Contraseña: ${password}\n` : ''}\n` +
    `Cualquier cosa me escribís por acá 🙌`
  )
}


// ── Seguimiento ────────────────────────────────────────────────────────
export const PASOS_SEGUIMIENTO = [
  { paso: 1, label: 'Primer mensaje', dias: 2 },
  { paso: 2, label: 'Seguimiento', dias: 3 },
  { paso: 3, label: 'Cierre', dias: 0 },
]
export const hoyISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
// En el servidor (UTC) la fecha de Bolivia (UTC−4).
export const hoyBolivia = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
export const sumarDias = (dias: number, desde = new Date()) => hoyISO(new Date(desde.getTime() + dias * 86400000))

// Qué mensaje le toca ahora (según el paso en que va).
export function siguienteMensaje(p: Prospecto, campana: Campana, quedan: number, sitio: string): { paso: number; label: string; texto: string } | null {
  const paso = (p.pasoSeguimiento || 0) + 1
  if (paso > 3 || p.estado === 'registrado' || p.estado === 'descartado') return null
  const e = p.estrategia || estrategiaBase(p, campana, quedan, sitio)
  const texto = paso === 1 ? e.mensajeInicial : paso === 2 ? e.seguimiento1 : e.seguimiento2
  return { paso, label: PASOS_SEGUIMIENTO[paso - 1].label, texto }
}

// ¿Le toca seguimiento hoy (o está atrasado)?
export const tocaHoy = (p: Prospecto, hoy = hoyISO()) =>
  !!p.proximoSeguimiento && p.proximoSeguimiento <= hoy && (p.pasoSeguimiento || 0) < 3 && !['registrado', 'descartado'].includes(p.estado)

// Celular boliviano (8 dígitos que empiezan con 6 o 7) → tiene WhatsApp.
// Un fijo (+591 2 2311910) casi nunca tiene.
export function esCelular(t: string) {
  const d = String(t || '').replace(/\D/g, '').replace(/^591/, '')
  return d.length === 8 && /^[67]/.test(d)
}

// ── Pegar una lista ───────────────────────────────────────────────────
// "Negocio  Dirección  Teléfono" copiado de una planilla, de un chat o
// de la IA: una tienda por renglón, columnas separadas por tab, "|", ";"
// o 2+ espacios. Lo que va entre paréntesis queda como nota.
export type FilaPegada = { nombre: string; direccion: string; telefono: string; rubro: string; notas: string }

const ENCABEZADO = /^(negocio|nombre|tienda|empresa)\b/i
export function leerListaPegada(texto: string): FilaPegada[] {
  const filas: FilaPegada[] = []
  for (const linea0 of String(texto || '').split(/\r?\n/)) {
    const linea = linea0.replace(/^\s*(\d+[.)-]|[-*•])\s+/, '').trim()
    if (!linea || (ENCABEZADO.test(linea) && /direcci|tel[eé]f|whats|celular/i.test(linea)) || /^[-|:\s]+$/.test(linea)) continue
    let cols = linea.split(/\t|\s*\|\s*|\s*;\s*|\s{2,}/).map((c) => c.trim()).filter(Boolean)
    // Sin separadores: "Nombre, Dirección, +591 7..." o "Nombre - Dirección - tel"
    if (cols.length < 2) cols = linea.split(/\s+[-–]\s+|,\s+(?=[^,]*$)|,\s+/).map((c) => c.trim()).filter(Boolean)
    const notas: string[] = []
    const sinNotas = (c: string) => c.replace(/\(([^)]*)\)/g, (_m, n) => { if (n.trim()) notas.push(n.trim()); return '' }).replace(/\s+/g, ' ').trim()
    let telefono = ''
    const resto: string[] = []
    for (const c of cols) {
      const limpio = sinNotas(c)
      const tel = limpio.match(/(\+?\s*591[\s-]*)?(\d[\d\s-]{6,}\d)/)
      if (!telefono && tel && tel[0].replace(/\D/g, '').length >= 7 && limpio.replace(/[\d\s+()-]/g, '').length <= 2) { telefono = tel[0].replace(/\s+/g, ' ').trim(); continue }
      if (limpio) resto.push(limpio)
    }
    if (!telefono) {
      // teléfono pegado al final del texto
      const m = resto.length ? resto[resto.length - 1].match(/(\+?591[\s-]*)?([67]\d{7}|2\s?\d{6,7})\s*$/) : null
      if (m) { telefono = m[0].trim(); resto[resto.length - 1] = resto[resto.length - 1].slice(0, m.index).trim() }
    }
    const [nombre = '', direccion = '', ...mas] = resto.filter(Boolean)
    if (!nombre || nombre.length < 2) continue
    filas.push({ nombre, direccion: [direccion, ...mas].filter(Boolean).join(', '), telefono, rubro: '', notas: notas.join(' · ') })
  }
  return filas
}
