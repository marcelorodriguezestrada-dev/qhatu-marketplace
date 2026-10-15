// Marketing del vendedor: textos para redes sociales. La plantilla se usa
// si la IA no está disponible (y la IA la usa de referencia de datos).
import { buscarCiudad } from '@/data/ciudades'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { estiloDe, v } from '@/lib/estiloRegional'

export const REDES_MARKETING = [
  { id: 'facebook', label: 'Facebook', icono: '📘' },
  { id: 'instagram', label: 'Instagram', icono: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icono: '💬' },
  { id: 'tiktok', label: 'TikTok', icono: '🎵' },
] as const

export const TONOS_MARKETING = [
  { id: 'cercano', label: '😊 Cercano' },
  { id: 'oferta', label: '🔥 Oferta / urgencia' },
  { id: 'elegante', label: '✨ Elegante' },
] as const

export type ProductoMarketing = {
  id: string
  nombre: string
  precio: number
  precioOriginal?: number | null
  descripcionCorta?: string
  talles?: string[]
  colores?: string[]
  stock?: number | null
}

// Con `campana`: el link lleva el código de la publicación (?c=, el
// seguimiento de Clasi Click: visitas y pedidos) y los UTM estándar, para
// que también lo vean Google Analytics y las estadísticas de la red.
export function linkProducto(site: string, id: string, red: string, campana?: string | null) {
  if (!campana) return `${site}/producto/${id}?ref=${red}`
  return `${site}/producto/${id}?c=${campana}&utm_source=${red}&utm_medium=social&utm_campaign=${campana}`
}

export function pctDescuento(p: ProductoMarketing) {
  return p.precioOriginal && p.precioOriginal > p.precio ? Math.round((1 - p.precio / p.precioOriginal) * 100) : 0
}

// Texto sin IA. Habla como en la ciudad de la tienda: tuteo boliviano o
// voseo argentino (ver src/lib/estiloRegional.ts), con su moneda.
export function textoPlantilla(productos: ProductoMarketing[], red: string, tienda: string, site: string, ciudadId = 'potosi', campana?: string | null): string {
  const pais = paisDeCiudad(ciudadId)
  const ciudad = buscarCiudad(ciudadId).nombre
  const plata = (n: number) => formatoMoneda(n, pais)
  const lineas = productos.map((p) => {
    const d = pctDescuento(p)
    const precio = d ? `${plata(p.precio)} (antes ${plata(p.precioOriginal!)}, -${d}%)` : plata(p.precio)
    const extra = [p.talles?.length ? `${v(ciudadId, 'Tallas', 'Talles')}: ${p.talles.join(', ')}` : '', p.colores?.length ? `Colores: ${p.colores.join(', ')}` : ''].filter(Boolean).join(' · ')
    return `🛍️ ${p.nombre} — ${precio}${extra ? `\n   ${extra}` : ''}\n   👉 ${linkProducto(site, p.id, red, campana)}`
  })
  const estilo = estiloDe(ciudadId)
  const cabeza = productos.length === 1 ? `✨ ¡Nuevo en ${tienda || 'nuestra tienda'}!` : `✨ ${v(ciudadId, 'Mira', 'Mirá')} lo que tenemos en ${tienda || 'nuestra tienda'}:`
  const cierre =
    estilo === 'argentina' ? '📦 Pedilo en Clasi Click y pagá con QR. ¡Te lo llevamos!'
    : estilo === 'potosi' ? '📦 Pídelo en Clasi Click y paga con QR. ¡Te lo llevamos a tu casa, casero! 🏔️'
    : '📦 Pídelo en Clasi Click y paga con QR. ¡Te lo llevamos a tu casa, casero!'
  const tags = estilo === 'argentina'
    ? `#${ciudad.replace(/\s+/g, '')} #Argentina #ClasiClick #ComprasOnline`
    : `#${ciudad.replace(/\s+/g, '')} ${estilo === 'potosi' ? '#VillaImperial ' : ''}#Bolivia #ClasiClick #ComprasOnline #HechoEnBolivia`
  if (red === 'whatsapp') return `${cabeza}\n${lineas.join('\n')}\n${cierre}`
  return `${cabeza}\n\n${lineas.join('\n\n')}\n\n${cierre}${red === 'instagram' || red === 'tiktok' ? `\n\n${tags}` : ''}`
}
