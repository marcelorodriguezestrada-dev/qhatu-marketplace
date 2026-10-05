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
  }
}
