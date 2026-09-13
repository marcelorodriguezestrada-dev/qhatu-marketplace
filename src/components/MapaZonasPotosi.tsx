'use client'

import dynamic from 'next/dynamic'

// Leaflet dibuja sobre el DOM del navegador (usa `window`), así que no
// puede pre-renderizarse en el servidor — ssr:false es justo lo que
// hace que Next.js espere a estar en el navegador para cargarlo, en vez
// de romper el build tratando de armarlo del lado del servidor.
export const MapaZonasPotosi = dynamic(() => import('./MapaZonasPotosiCliente'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg border border-line bg-panelalt flex items-center justify-center font-body text-xs text-inksoft">
      Cargando mapa...
    </div>
  ),
})
