// Marketing del vendedor: textos para redes sociales. La plantilla se usa
// si la IA no está disponible (y la IA la usa de referencia de datos).

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

export function linkProducto(site: string, id: string, red: string) {
  return `${site}/producto/${id}?ref=${red}`
}

export function pctDescuento(p: ProductoMarketing) {
  return p.precioOriginal && p.precioOriginal > p.precio ? Math.round((1 - p.precio / p.precioOriginal) * 100) : 0
}

const bs = (n: number) => `Bs ${Number(n).toLocaleString('es-BO')}`

export function textoPlantilla(productos: ProductoMarketing[], red: string, tienda: string, site: string): string {
  const lineas = productos.map((p) => {
    const d = pctDescuento(p)
    const precio = d ? `${bs(p.precio)} (antes ${bs(p.precioOriginal!)}, -${d}%)` : bs(p.precio)
    const extra = [p.talles?.length ? `Talles: ${p.talles.join(', ')}` : '', p.colores?.length ? `Colores: ${p.colores.join(', ')}` : ''].filter(Boolean).join(' · ')
    return `🛍️ ${p.nombre} — ${precio}${extra ? `\n   ${extra}` : ''}\n   👉 ${linkProducto(site, p.id, red)}`
  })
  const cabeza = productos.length === 1 ? `✨ ¡Nuevo en ${tienda || 'nuestra tienda'}!` : `✨ Mirá lo que tenemos en ${tienda || 'nuestra tienda'}:`
  const cierre = '📦 Pedilo en Clasi Click y pagá con QR. ¡Te lo llevamos!'
  const tags = red === 'instagram' || red === 'tiktok' ? '\n\n#Potosí #Bolivia #ClasiClick #ComprasOnline #HechoEnBolivia' : ''
  if (red === 'whatsapp') return `${cabeza}\n${lineas.join('\n')}\n${cierre}`
  return `${cabeza}\n\n${lineas.join('\n\n')}\n\n${cierre}${tags}`
}
