import { itemsFeed, escXml } from '@/lib/feedProductos'
import { SITE_URL } from '@/lib/sitio'

// /feed/google.xml — catálogo para Google Merchant Center (formato RSS 2.0
// con el namespace g:). Se rearma cada hora. Ver src/lib/feedProductos.ts.
export const revalidate = 3600

export async function GET() {
  const items = await itemsFeed('google').catch(() => [])
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n` +
    `<title>Clasi Click</title>\n<link>${SITE_URL}</link>\n<description>Productos de tiendas de Bolivia en Clasi Click</description>\n` +
    items
      .map(
        (i) =>
          `<item>\n<g:id>${escXml(i.id)}</g:id>\n<g:title>${escXml(i.titulo)}</g:title>\n<g:description>${escXml(i.descripcion)}</g:description>\n` +
          `<g:link>${escXml(i.link)}</g:link>\n<g:image_link>${escXml(i.imagen)}</g:image_link>\n<g:availability>${i.disponible ? 'in_stock' : 'out_of_stock'}</g:availability>\n` +
          `<g:price>${escXml(i.precio)}</g:price>\n<g:condition>new</g:condition>\n<g:brand>${escXml(i.marca)}</g:brand>\n<g:identifier_exists>no</g:identifier_exists>\n` +
          (i.categoria ? `<g:product_type>${escXml(i.categoria)}</g:product_type>\n` : '') +
          `<g:custom_label_0>${escXml(i.ciudad)}</g:custom_label_0>\n</item>`
      )
      .join('\n') +
    `\n</channel>\n</rss>\n`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
