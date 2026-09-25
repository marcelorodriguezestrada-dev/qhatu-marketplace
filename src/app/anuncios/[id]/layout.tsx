import type { Metadata } from 'next'
import { labelTipoAnuncio } from '@/data/anuncios'
import { leerAnuncioPublico, SITE_URL } from '@/lib/anuncioPublico'

// La página del anuncio es un client component, así que la vista previa
// que muestran WhatsApp/Facebook al compartir el link (Open Graph) se
// arma acá, del lado del servidor: foto, título, precio y descripción.
// Si el anuncio no tiene foto, usamos la imagen generada en ./og.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const anuncio = await leerAnuncioPublico(params.id)
  if (!anuncio) return { title: 'Anuncio | Clasi Click' }

  const precio = anuncio.precio ? `Bs ${Number(anuncio.precio).toLocaleString('es-BO')} · ` : ''
  const titulo = `${precio}${anuncio.titulo}`
  const descripcion =
    String(anuncio.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 160) ||
    `${labelTipoAnuncio(anuncio.tipo)} en Clasi Click, Potosí.`
  const url = `${SITE_URL}/anuncios/${params.id}`
  const imagen = anuncio.imagenUrl || `${SITE_URL}/anuncios/${params.id}/og`

  return {
    title: `${titulo} | Clasi Click`,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: 'Clasi Click',
      locale: 'es_BO',
      url,
      title: titulo,
      description: descripcion,
      images: [{ url: imagen, alt: anuncio.titulo }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  }
}

export default function AnuncioLayout({ children }: { children: React.ReactNode }) {
  return children
}
