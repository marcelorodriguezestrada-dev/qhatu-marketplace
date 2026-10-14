import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Categorías — ropa, calzado, tecnología, hogar y más en Potosí | Clasi Click',
  description: 'Todas las categorías de productos de las tiendas de Potosí y La Paz en Clasi Click. Pagá con QR y recibí en tu casa.',
  alternates: { canonical: '/categorias' },
}

export default function CategoriasLayout({ children }: { children: React.ReactNode }) {
  return children
}
