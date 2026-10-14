import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import { CarritoProvider } from '@/lib/store'
import { AuthProvider } from '@/lib/auth'
import { SITE_URL } from '@/lib/sitio'
import RegistrarVisita from '@/components/RegistrarVisita'
import VerificacionGate from '@/components/VerificacionGate'
import BarraModoAdmin from '@/components/BarraModoAdmin'
import { jsonLdSitio, ldJson } from '@/lib/seo'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space-grotesk' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' })

export const metadata: Metadata = {
  // Dominio del sitio: los links e imágenes al compartir (WhatsApp, Facebook) salen con este.
  metadataBase: new URL(SITE_URL),
  title: 'Clasi Click — Comprá en tiendas de Potosí y La Paz, pagá con QR',
  description:
    'Marketplace de Bolivia: ropa, calzado, tecnología y más de tiendas de tu ciudad, con pago por QR y envío a domicilio. También servicios profesionales (electricistas, abogados, médicos…) y anuncios.',
  keywords: ['comprar online Potosí', 'tiendas Potosí', 'tiendas La Paz', 'delivery Potosí', 'pago con QR Bolivia', 'marketplace Bolivia', 'servicios profesionales Potosí', 'Clasi Click'],
  applicationName: 'Clasi Click',
  openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO' },
  // Para verificar el sitio en Google Search Console sin tocar código:
  // poné el código en la variable GOOGLE_SITE_VERIFICATION de Vercel.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLdSitio()) }} />
        <RegistrarVisita />
        <AuthProvider>
          <VerificacionGate />
          <BarraModoAdmin />
          <CarritoProvider>{children}</CarritoProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
