'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet'
import { Delaunay } from 'd3-delaunay'
import { ZONAS_ENVIO_POTOSI } from '@/data/zonasPotosi'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function colorPorPrecio(costo: number) {
  if (costo <= 5) return '#1a7f6e' // teal — barato/cerca
  if (costo <= 10) return '#c17f2b' // ocre — medio
  return '#7A2E2E' // maroon — caro/lejos
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
                color: esSeleccionada ? '#2B211D' : '#fff',
                weight: esSeleccionada ? 2.5 : 1,
                fillColor: colorPorPrecio(zona.costoEnvio),
                fillOpacity: esSeleccionada ? 0.75 : 0.55,
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
          <CircleMarker key={z.nombre} center={[z.lat, z.lng]} radius={2} pathOptions={{ color: '#2B211D', fillColor: '#2B211D', fillOpacity: 1, weight: 0 }} />
        ))}
      </MapContainer>
      <div className="flex items-center gap-4 justify-center py-2 font-body text-[10px] text-inksoft bg-panel">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1a7f6e' }} />{bs(5)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#c17f2b' }} />{bs(10)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#7A2E2E' }} />{bs(15)}</div>
      </div>
      <div className="font-body text-[9px] text-inksoft text-center pb-1.5 px-2 bg-panel">
        Las áreas son una aproximación calculada por cercanía, no los límites barriales oficiales.
      </div>
    </div>
  )
}
