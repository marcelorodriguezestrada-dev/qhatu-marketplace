import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Anuncios clasificados en Potosí y La Paz — busco, ofrezco, vendo | Clasi Click',
  description: 'Anuncios clasificados de Bolivia: publicá qué buscás o qué ofrecés y te contactan por WhatsApp. Gratis en Clasi Click.',
  alternates: { canonical: '/anuncios' },
}

export default function AnunciosLayout({ children }: { children: React.ReactNode }) {
  return children
}
