'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { ZONAS_ENVIO_POTOSI } from '@/data/zonasPotosi'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function colorPorPrecio(costo: number) {
  if (costo <= 5) return '#1a7f6e' // teal — barato/cerca
  if (costo <= 10) return '#c17f2b' // ocre — medio
  return '#7A2E2E' // maroon — caro/lejos
}

// Mapa real (calles, nombres de barrios) con OpenStreetMap — es de uso
// libre y gratuito, no necesita ninguna API key (a diferencia de Google
// Maps). Este archivo solo se carga en el navegador (ver
// MapaZonasPotosi.tsx, que lo importa con ssr:false) porque Leaflet
// necesita `window` para dibujar el mapa.
export default function MapaZonasPotosiCliente({ zonaSeleccionada }: { zonaSeleccionada?: string }) {
  const centro: [number, number] = [-19.5836, -65.758]

  return (
    <div className="rounded-lg overflow-hidden border border-line">
      <MapContainer center={centro} zoom={13} scrollWheelZoom={false} style={{ height: 260, width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {ZONAS_ENVIO_POTOSI.map((z) => {
          const esSeleccionada = z.nombre === zonaSeleccionada
          return (
            <CircleMarker
              key={z.nombre}
              center={[z.lat, z.lng]}
              radius={esSeleccionada ? 10 : 6}
              pathOptions={{
                color: esSeleccionada ? '#2B211D' : colorPorPrecio(z.costoEnvio),
                weight: esSeleccionada ? 2 : 1,
                fillColor: colorPorPrecio(z.costoEnvio),
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <strong>{z.nombre}</strong>
                <br />
                Envío: {bs(z.costoEnvio)}
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <div className="flex items-center gap-4 justify-center py-2 font-body text-[10px] text-inksoft bg-panel">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1a7f6e' }} />{bs(5)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#c17f2b' }} />{bs(10)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#7A2E2E' }} />{bs(15)}</div>
      </div>
    </div>
  )
}
