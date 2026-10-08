import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import { CarritoProvider } from '@/lib/store'
import { AuthProvider } from '@/lib/auth'
import { SITE_URL } from '@/lib/sitio'
import RegistrarVisita from '@/components/RegistrarVisita'
import VerificacionGate from '@/components/VerificacionGate'
import BarraModoAdmin from '@/components/BarraModoAdmin'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space-grotesk' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' })

export const metadata: Metadata = {
  // Dominio del sitio: los links e imágenes al compartir (WhatsApp, Facebook) salen con este.
  metadataBase: new URL(SITE_URL),
  title: 'Clasi Click — Marketplace Bolivia',
  description: 'Comprá y vendé en Bolivia, con pago por QR interbancario.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
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
