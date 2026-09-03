import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import { CarritoProvider } from '@/lib/store'
import { AuthProvider } from '@/lib/auth'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space-grotesk' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Qhatu — Marketplace Bolivia',
  description: 'Comprá y vendé en Bolivia, con pago por QR interbancario.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
        <AuthProvider>
          <CarritoProvider>{children}</CarritoProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
