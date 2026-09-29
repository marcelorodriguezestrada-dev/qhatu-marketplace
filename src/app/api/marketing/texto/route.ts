import { NextRequest, NextResponse } from 'next/server'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { textoMarketingIA } from '@/lib/moderacionIA'
import { SITE_URL } from '@/lib/anuncioPublico'
import { linkProducto, pctDescuento, textoPlantilla, type ProductoMarketing } from '@/lib/marketing'

export const dynamic = 'force-dynamic'

// POST { productoIds: string[], red, tono } — texto para redes sociales
// de productos PROPIOS del vendedor logueado (máx. 5). IA si está
// disponible; si no, plantilla.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const body = await req.json()
    const ids = (Array.isArray(body.productoIds) ? body.productoIds : []).map(String).slice(0, 5)
    const red = ['facebook', 'instagram', 'whatsapp', 'tiktok'].includes(body.red) ? body.red : 'facebook'
    const tono = ({ cercano: 'cercano y amable', oferta: 'de oferta, con urgencia (sin inventar plazos)', elegante: 'elegante y cuidado' } as Record<string, string>)[body.tono] || 'cercano y amable'
    if (ids.length === 0) return NextResponse.json({ error: 'Elegí al menos un producto.' }, { status: 400 })

    const db = getDb()
    const docs = await db.getAll(...ids.map((id: string) => db.collection('productos').doc(id)))
    const productos: ProductoMarketing[] = docs
      .filter((d) => d.exists && (d.data() as any).vendedorId === usuario.uid)
      .map((d) => {
        const p = d.data() as any
        return { id: d.id, nombre: p.nombre, precio: Number(p.precio), precioOriginal: p.precioOriginal || null, descripcionCorta: p.descripcionCorta || '', talles: p.talles || [], colores: p.colores || [], stock: typeof p.stock === 'number' ? p.stock : null }
      })
    if (productos.length === 0) return NextResponse.json({ error: 'Esos productos no son tuyos.' }, { status: 403 })

    const tiendaDoc = await db.collection('vendedores').doc(usuario.uid).get()
    const tienda = (tiendaDoc.data() as any)?.nombreNegocio || ''
    const ciudad = buscarCiudad(ciudadDe(tiendaDoc.data() as any)).nombre
    const plantilla = textoPlantilla(productos, red, tienda, SITE_URL, ciudad)

    const datos = [
      `Tienda: ${tienda || 'sin nombre'} (${ciudad})`,
      ...productos.map((p) => {
        const d = pctDescuento(p)
        return [
          `- Producto: ${p.nombre}`,
          `  Precio: Bs ${p.precio}${d ? ` (antes Bs ${p.precioOriginal}, ${d}% de descuento)` : ''}`,
          p.descripcionCorta && `  Descripción: ${p.descripcionCorta}`,
          p.talles?.length && `  Talles: ${p.talles.join(', ')}`,
          p.colores?.length && `  Colores: ${p.colores.join(', ')}`,
          p.stock != null && p.stock > 0 && p.stock <= 3 && `  Quedan solo ${p.stock} unidades`,
          `  Link: ${linkProducto(SITE_URL, p.id, red)}`,
        ].filter(Boolean).join('\n')
      }),
      `Se compra en Clasi Click y se paga con QR. La tienda está en ${ciudad}: usá hashtags de ${ciudad}.`,
    ].join('\n')

    const ia = await textoMarketingIA(datos, red, tono)
    return NextResponse.json({ texto: ia || plantilla, conIA: !!ia })
  } catch (err) {
    console.error('POST /api/marketing/texto', err)
    return NextResponse.json({ error: 'No se pudo armar el texto.' }, { status: 500 })
  }
}
