import type { Metadata } from 'next'
import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/anuncioPublico'

// Vista previa (Open Graph) al compartir el link de un producto por
// WhatsApp/Facebook: foto, nombre, precio y descripción corta. La página
// es un client component, por eso se arma acá del lado del servidor.
// Sin foto, usa la imagen generada en ./og.
async function leerProducto(id: string) {
  try {
    const doc = await getDb().collection('productos').doc(id).get()
    if (!doc.exists) return null
    const p = doc.data()!
    if (p.estado && p.estado !== 'activo') return null
    return { id: doc.id, ...p } as Record<string, any>
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await leerProducto(params.id)
  if (!p) return { title: 'Producto | Clasi Click' }

  const precio = p.precio ? `Bs ${Number(p.precio).toLocaleString('es-BO')}` : ''
  const off = p.precioOriginal && p.precioOriginal > p.precio ? ` (${Math.round((1 - p.precio / p.precioOriginal) * 100)}% OFF)` : ''
  const titulo = `${p.nombre}${precio ? ` — ${precio}${off}` : ''}`
  const descripcion =
    String(p.descripcionCorta || p.descripcionLarga || '').replace(/\s+/g, ' ').trim().slice(0, 160) ||
    `${p.vendedor ? `${p.vendedor} · ` : ''}Comprá en Clasi Click, Potosí.`
  const url = `${SITE_URL}/producto/${params.id}`
  const imagen = p.imagenUrl || `${SITE_URL}/producto/${params.id}/og`

  return {
    title: `${titulo} | Clasi Click`,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO', url, title: titulo, description: descripcion, images: [{ url: imagen, alt: p.nombre }] },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  }
}

export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return children
}
