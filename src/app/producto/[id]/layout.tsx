import type { Metadata } from 'next'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { SITE_URL } from '@/lib/sitio'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { jsonLdProducto, ldJson, leerProductoPublico, textoCorto } from '@/lib/seo'
import { DatosIniciales } from '@/components/DatosIniciales'

// La página del producto es un client component. Acá (servidor) se arma:
// - el título y la descripción para Google y la vista previa (Open Graph)
//   al compartir por WhatsApp/Facebook (sin foto, usa la imagen de ./og);
// - los datos estructurados (schema.org Product: precio, stock, tienda),
//   para que Google pueda mostrar el precio en el resultado;
// - el producto ya leído, para que la página llegue con el contenido.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  await cargarCiudadesServidor().catch(() => null) // nombres de las ciudades agregadas desde el admin
  const p = await leerProductoPublico(params.id)
  if (!p) return { title: 'Producto | Clasi Click', robots: { index: false } }

  const ciudad = buscarCiudad(ciudadDe(p)).nombre
  const precio = p.precio ? formatoMoneda(Number(p.precio), paisDeCiudad(ciudadDe(p))) : ''
  const off = p.precioOriginal && p.precioOriginal > p.precio ? ` (${Math.round((1 - p.precio / p.precioOriginal) * 100)}% OFF)` : ''
  const titulo = `${p.nombre}${precio ? ` — ${precio}${off}` : ''}`
  const descripcion =
    textoCorto(p.descripcionCorta || p.descripcionLarga, 130) ||
    `${p.nombre}${p.tiendaNombre ? ` de ${p.tiendaNombre}` : ''}.`
  const descripcionFinal = `${descripcion} Comprá en ${ciudad} con pago QR y envío a domicilio.`.slice(0, 200)
  const url = `${SITE_URL}/producto/${params.id}`
  // Siempre la tarjeta armada en ./og (JPG 1200x630 con la foto, el nombre y
  // el precio): las fotos se suben en WebP y Facebook / WhatsApp no siempre
  // las muestran. ?v= cambia si se edita el producto, para que refresquen.
  const imagen = `${SITE_URL}/producto/${params.id}/og?v=${encodeURIComponent(String(p.updatedAt || p.createdAt || '1').slice(0, 19))}`

  return {
    title: `${titulo} en ${ciudad} | Clasi Click`,
    description: descripcionFinal,
    ...(Array.isArray(p.etiquetasBusqueda) && p.etiquetasBusqueda.length ? { keywords: p.etiquetasBusqueda.slice(0, 15) } : {}),
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO', url, title: titulo, description: descripcionFinal, images: [{ url: imagen, width: 1200, height: 630, alt: p.nombre, type: 'image/jpeg' }] },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcionFinal, images: [imagen] },
  }
}

export default async function ProductoLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const p = await leerProductoPublico(params.id)
  return (
    <>
      {p && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLdProducto(p)) }} />}
      <DatosIniciales datos={p ? { producto: p } : {}}>{children}</DatosIniciales>
    </>
  )
}
