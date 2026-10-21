import { NextResponse } from 'next/server'

// Para publicar la app en Google Play como TWA (hecha con PWABuilder o
// Bubblewrap): Android verifica que el sitio "autoriza" a la app. Se
// configura en Vercel, sin tocar código:
//   ANDROID_PACKAGE   ej. com.clasiclick.app
//   ANDROID_SHA256    huella(s) SHA-256 de la firma (separadas por coma)
export const dynamic = 'force-dynamic'

export function GET() {
  const huellas = (process.env.ANDROID_SHA256 || '').split(',').map((h) => h.trim()).filter(Boolean)
  const datos = huellas.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: process.env.ANDROID_PACKAGE || 'com.clasiclick.app', sha256_cert_fingerprints: huellas } }]
    : []
  return NextResponse.json(datos, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
