import type { MetadataRoute } from 'next'

// Para instalar Clasi Click como app (Android: Chrome → "Instalar app"; ver
// src/components/InstalarApp.tsx). El mismo manifiesto sirve para subirla a
// Google Play como TWA (ver src/app/.well-known/assetlinks.json/route.ts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Clasi Click',
    short_name: 'Clasi Click',
    description: 'Comprá en tiendas de tu ciudad, pagá con QR y recibí en tu casa. También servicios y anuncios.',
    start_url: '/?utm_source=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F1ECE0',
    theme_color: '#111A2E',
    lang: 'es',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Mantener apretado el ícono: accesos directos.
    shortcuts: [
      { name: 'Vender', short_name: 'Vender', url: '/vender?utm_source=app', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Mis pedidos', short_name: 'Pedidos', url: '/mis-pedidos?utm_source=app', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
