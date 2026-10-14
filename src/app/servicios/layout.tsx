import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Servicios profesionales en Potosí y La Paz — electricistas, abogados, médicos y más | Clasi Click',
  description: 'Encontrá profesionales de confianza en tu ciudad: electricistas, plomeros, abogados, médicos, profesores, psicólogos y más. Mirá sus servicios, reseñas y contactalos por WhatsApp.',
  alternates: { canonical: '/servicios' },
}

export default function ServiciosLayout({ children }: { children: React.ReactNode }) {
  return children
}
