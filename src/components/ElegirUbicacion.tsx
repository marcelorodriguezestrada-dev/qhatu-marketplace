'use client'

import dynamic from 'next/dynamic'

// Leaflet necesita `window`: se carga solo en el navegador.
export const ElegirUbicacion = dynamic(() => import('./ElegirUbicacionCliente'), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] rounded-lg border border-line bg-panelalt flex items-center justify-center font-body text-xs text-inksoft">Cargando mapa...</div>
  ),
})
