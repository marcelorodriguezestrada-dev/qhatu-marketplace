'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet'
import { Delaunay } from 'd3-delaunay'
import { ZONAS_ENVIO_POTOSI } from '@/data/zonasPotosi'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function colorPorPrecio(costo: number) {
  if (costo <= 5) return '#2F8F6F' // verde — barato/cerca
  if (costo <= 10) return '#D98E2B' // naranja — medio
  return '#B5473F' // rojo — caro/lejos
}

// Arma un "territorio" por zona que cubre todo el mapa sin huecos
// (diagrama de Voronoi): cada punto se queda con el área que le queda
// más cerca a él que a cualquier otro punto. No son los límites
// barriales reales (esos requerirían planos catastrales oficiales de
// la alcaldía que no tenemos) — es una aproximación calculada, pero da
// un resultado visual muy parecido al de un mapa de zonas de reparto.
function calcularCeldas() {
  const puntos: [number, number][] = ZONAS_ENVIO_POTOSI.map((z) => [z.lng, z.lat])
  const lats = ZONAS_ENVIO_POTOSI.map((z) => z.lat)
  const lngs = ZONAS_ENVIO_POTOSI.map((z) => z.lng)
  const pad = 0.025
  const bounds: [number, number, number, number] = [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ]
  const delaunay = Delaunay.from(puntos)
  const voronoi = delaunay.voronoi(bounds)

  return ZONAS_ENVIO_POTOSI.map((z, i) => {
    const celda = voronoi.cellPolygon(i)
    // cellPolygon devuelve [lng, lat] — Leaflet espera [lat, lng].
    const posiciones = (celda || []).map(([lng, lat]) => [lat, lng] as [number, number])
    return { zona: z, posiciones }
  })
}

// Mapa real (calles, nombres de barrios) con OpenStreetMap — es de uso
// libre y gratuito, no necesita ninguna API key (a diferencia de Google
// Maps). Este archivo solo se carga en el navegador (ver
// MapaZonasPotosi.tsx, que lo importa con ssr:false) porque Leaflet
// necesita `window` para dibujar el mapa.
export default function MapaZonasPotosiCliente({ zonaSeleccionada }: { zonaSeleccionada?: string }) {
  const centro: [number, number] = [-19.5836, -65.758]
  const celdas = calcularCeldas()

  return (
    <div className="rounded-lg overflow-hidden border border-line">
      <MapContainer center={centro} zoom={13} scrollWheelZoom={false} style={{ height: 300, width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {celdas.map(({ zona, posiciones }) => {
          const esSeleccionada = zona.nombre === zonaSeleccionada
          if (posiciones.length === 0) return null
          return (
            <Polygon
              key={zona.nombre}
              positions={posiciones}
              pathOptions={{
                color: esSeleccionada ? '#2B211D' : 'rgba(255,255,255,0.85)',
                weight: esSeleccionada ? 3 : 1.5,
                fillColor: colorPorPrecio(zona.costoEnvio),
                fillOpacity: esSeleccionada ? 0.8 : 0.62,
              }}
            >
              <Popup>
                <strong>{zona.nombre}</strong>
                <br />
                Envío: {bs(zona.costoEnvio)}
              </Popup>
            </Polygon>
          )
        })}

        {ZONAS_ENVIO_POTOSI.map((z) => (
          <CircleMarker key={z.nombre} center={[z.lat, z.lng]} radius={3} pathOptions={{ color: '#fff', fillColor: '#2B211D', fillOpacity: 1, weight: 1.5 }} />
        ))}
      </MapContainer>
      <div className="flex items-center gap-4 justify-center py-2.5 font-body text-[11px] text-inksoft bg-panel border-t border-line">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#2F8F6F' }} />{bs(5)}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#D98E2B' }} />{bs(10)}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#B5473F' }} />{bs(15)}</div>
      </div>
      <div className="font-body text-[10px] text-inksoft text-center pb-2 px-3 bg-panel">
        Las áreas son una aproximación por distancia real al centro, no los límites barriales oficiales.
      </div>
    </div>
  )
}
