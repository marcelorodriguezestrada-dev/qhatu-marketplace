import type { Metadata } from 'next'
import { buscarCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { SITE_URL } from '@/lib/sitio'
import { jsonLdTienda, ldJson, leerTiendaPublica } from '@/lib/seo'
import { DatosIniciales } from '@/components/DatosIniciales'

// Tienda de un vendedor: título "Tienda — productos en Ciudad" para
// Google, vista previa al compartir, datos estructurados (Store con sus
// productos y precios) y la tienda ya leída para que la página llegue armada.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  await cargarCiudadesServidor().catch(() => null)
  const d = await leerTiendaPublica(params.id)
  if (!d || !d.tienda.nombreNegocio) return { title: 'Tienda | Clasi Click', robots: { index: false } }
  const { tienda, productos } = d
  const ciudad = buscarCiudad(tienda.ciudad).nombre
  const ejemplos = productos.slice(0, 4).map((p) => p.nombre).filter(Boolean)
  const titulo = `${tienda.nombreNegocio} — tienda en ${ciudad}`
  const descripcion = `${productos.length} producto${productos.length === 1 ? '' : 's'} de ${tienda.nombreNegocio} en ${ciudad}${ejemplos.length ? `: ${ejemplos.join(', ')}` : ''}. Pagá con QR y recibí en tu casa con Clasi Click.`.slice(0, 200)
  const url = `${SITE_URL}/tienda/${params.id}`
  const imagen = tienda.logoUrl || productos.find((p) => p.imagenUrl)?.imagenUrl
  return {
    title: `${titulo} | Clasi Click`,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO', url, title: titulo, description: descripcion, ...(imagen ? { images: [{ url: imagen, alt: tienda.nombreNegocio }] } : {}) },
  }
}

export default async function TiendaLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const d = await leerTiendaPublica(params.id)
  return (
    <>
      {d && d.tienda.nombreNegocio && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLdTienda(d.tienda, d.productos)) }} />}
      <DatosIniciales datos={d ? { tienda: d } : {}}>{children}</DatosIniciales>
    </>
  )
}
