import type { Metadata } from 'next'

// Calendario compartido por link: que no aparezca en Google.
export const metadata: Metadata = { title: 'Calendario de publicaciones · Clasi Click', robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
