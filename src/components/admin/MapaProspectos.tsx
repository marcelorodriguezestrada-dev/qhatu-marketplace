'use client'

import dynamic from 'next/dynamic'

// Leaflet necesita `window`: se carga solo en el navegador.
export const MapaProspectos = dynamic(() => import('./MapaProspectosCliente'), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] rounded-lg border border-line bg-panelalt flex items-center justify-center font-body text-xs text-inksoft">Cargando mapa...</div>
  ),
})
