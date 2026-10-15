import { itemsFeed, escCsv } from '@/lib/feedProductos'

// /feed/meta.csv — catálogo para Meta Commerce Manager (Facebook e
// Instagram Shopping, anuncios de catálogo). Se rearma cada hora.
export const revalidate = 3600

const COLUMNAS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type', 'custom_label_0']

export async function GET() {
  const items = await itemsFeed('meta').catch(() => [])
  const filas = items.map((i) =>
    [i.id, i.titulo, i.descripcion, i.disponible ? 'in stock' : 'out of stock', 'new', i.precio, i.link, i.imagen, i.marca, i.categoria, i.ciudad].map(escCsv).join(',')
  )
  return new Response([COLUMNAS.join(','), ...filas].join('\n') + '\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
}
