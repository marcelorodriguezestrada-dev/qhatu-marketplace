import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import { CarritoProvider } from '@/lib/store'
import { AuthProvider } from '@/lib/auth'
import { SITE_URL } from '@/lib/sitio'
import RegistrarVisita from '@/components/RegistrarVisita'
import VerificacionGate from '@/components/VerificacionGate'
import BarraModoAdmin from '@/components/BarraModoAdmin'
import { jsonLdSitio, ldJson } from '@/lib/seo'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import RegistrarCiudades from '@/components/RegistrarCiudades'
import InstalarApp from '@/components/InstalarApp'

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
  // App instalable (src/app/manifest.ts): ícono para iPhone y modo pantalla completa.
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Clasi Click', statusBarStyle: 'default' },
  openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO' },
  // Para verificar el sitio en Google Search Console sin tocar código:
  // poné el código en la variable GOOGLE_SITE_VERIFICATION de Vercel.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
}

// Color de la barra del celular (y de la app instalada).
export const viewport: Viewport = { themeColor: '#111A2E' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ciudades/países agregados desde el admin: para que toda página conozca su moneda desde el primer dibujo.
  const { ciudades, paises } = await cargarCiudadesServidor().catch(() => ({ ciudades: [] as any[], paises: [] as any[] }))
  const extras = ciudades.filter((c: any) => c.extra).map((c: any) => ({ ...c, activa: c.estado === 'abierta', regionesIP: [], ciudadesIP: [] }))
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
        <RegistrarCiudades ciudades={extras} paises={paises} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLdSitio()) }} />
        <RegistrarVisita />
        <InstalarApp />
        <AuthProvider>
          <VerificacionGate />
          <BarraModoAdmin />
          <CarritoProvider>{children}</CarritoProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
