import { NextRequest, NextResponse } from 'next/server'
import { ciudadDesdeGeoIP } from '@/data/ciudades'

// Ciudad SUGERIDA por la ubicación aproximada de la IP (Vercel la manda
// gratis en los headers x-vercel-ip-*). Solo se usa para proponerla en
// el cartel "📍 ¿Dónde estás?" — la ciudad real es la que la persona
// elige (se guarda en su navegador, ver src/lib/ciudad.ts). En local
// (sin Vercel) estos headers no vienen y no se sugiere nada.
export const COOKIE_CIUDAD_IP = 'clasiclick_ciudad_ip'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  if (req.cookies.get(COOKIE_CIUDAD_IP)) return res
  const sugerida = ciudadDesdeGeoIP(
    req.headers.get('x-vercel-ip-country'),
    req.headers.get('x-vercel-ip-country-region'),
    req.headers.get('x-vercel-ip-city')
  )
  // "ninguna" también se guarda, para no volver a calcularlo en cada página.
  res.cookies.set(COOKIE_CIUDAD_IP, sugerida || 'ninguna', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
  return res
}

export const config = {
  // Solo páginas: nada de /api, archivos de Next, imágenes o íconos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
}
