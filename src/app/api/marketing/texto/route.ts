import { NextRequest, NextResponse } from 'next/server'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { textoMarketingIA } from '@/lib/moderacionIA'
import { SITE_URL } from '@/lib/anuncioPublico'
import { linkProducto, pctDescuento, textoPlantilla, type ProductoMarketing } from '@/lib/marketing'
import { codigoCampana } from '@/lib/campanas'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'

export const dynamic = 'force-dynamic'

// POST { productoIds: string[], red, tono } — texto para redes sociales
// de productos PROPIOS del vendedor logueado (máx. 5). IA si está
// disponible; si no, plantilla.
export async function POST(req: NextRequest) {
  await cargarCiudadesServidor().catch(() => null) // nombres de las ciudades agregadas desde el admin
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
    const ciudadId = ciudadDe(tiendaDoc.data() as any)
    const ciudad = buscarCiudad(ciudadId).nombre
    const plata = (n: number) => formatoMoneda(n, paisDeCiudad(ciudadId))
    // La publicación es una campaña de la tienda (campanas/{código}): sus
    // links la rastrean y lo que traiga se ve en Vender → Marketing y en
    // Admin → Marketing. Al regenerar se reusa la misma (body.campana).
    const ahora = new Date().toISOString()
    let campana = typeof body.campana === 'string' && /^[a-z0-9-]{3,40}$/.test(body.campana) ? body.campana : ''
    if (campana) {
      const prev = await db.collection('campanas').doc(campana).get()
      if (!prev.exists || prev.get('vendedorId') !== usuario.uid || prev.get('estado') === 'publicada') campana = ''
    }
    if (!campana) campana = codigoCampana(`${tienda || 'tienda'} ${red}`)
    await db.collection('campanas').doc(campana).set(
      {
        nombre: `${tienda || 'Tienda'} · ${red}`,
        canal: red,
        objetivo: 'compradores',
        destino: `/producto/${productos[0].id}`,
        ciudad: ciudadDe(tiendaDoc.data() as any),
        activa: true,
        origen: 'vendedor',
        vendedorId: usuario.uid,
        tiendaNombre: tienda,
        productoIds: productos.map((p) => p.id),
        productos: productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio })),
        estado: 'borrador',
        createdAt: ahora,
        updatedAt: ahora,
      },
      { merge: true },
    )
    const plantilla = textoPlantilla(productos, red, tienda, SITE_URL, ciudadId, campana)

    const datos = [
      `Tienda: ${tienda || 'sin nombre'} (${ciudad})`,
      ...productos.map((p) => {
        const d = pctDescuento(p)
        return [
          `- Producto: ${p.nombre}`,
          `  Precio: ${plata(p.precio)}${d ? ` (antes ${plata(p.precioOriginal!)}, ${d}% de descuento)` : ''}`,
          p.descripcionCorta && `  Descripción: ${p.descripcionCorta}`,
          p.talles?.length && `  Talles: ${p.talles.join(', ')}`,
          p.colores?.length && `  Colores: ${p.colores.join(', ')}`,
          p.stock != null && p.stock > 0 && p.stock <= 3 && `  Quedan solo ${p.stock} unidades`,
          `  Link (copialo tal cual, sin cambiarlo): ${linkProducto(SITE_URL, p.id, red, campana)}`,
        ].filter(Boolean).join('\n')
      }),
      `Se compra en Clasi Click y se paga con QR. La tienda está en ${ciudad}: usá hashtags de ${ciudad}.`,
    ].join('\n')

    let ia = await textoMarketingIA(datos, red, tono, ciudadId)
    // Si la IA tocó los links (perdió el código), va la plantilla: sin el
    // código no se puede medir la publicación.
    if (ia && !ia.includes(`c=${campana}`)) ia = null
    return NextResponse.json({ texto: ia || plantilla, conIA: !!ia, campana })
  } catch (err) {
    console.error('POST /api/marketing/texto', err)
    return NextResponse.json({ error: 'No se pudo armar el texto.' }, { status: 500 })
  }
}
