'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet'
import { ZONAS_ENVIO_POTOSI } from '@/data/zonasPotosi'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function colorPorPrecio(costo: number) {
  if (costo <= 5) return '#2F8F6F' // verde — barato/cerca
  if (costo <= 10) return '#D98E2B' // naranja — medio
  return '#B5473F' // rojo — caro/lejos
}

const CENTRO: [number, number] = [-19.5893, -65.7535] // Plaza 10 de Noviembre
const KM_POR_GRADO_LAT = 111.32

// Devuelve los 5 vértices de un pentágono regular centrado en `centro`,
// con radio en km. A diferencia de un diagrama de Voronoi (donde la
// forma de cada celda depende de dónde caen los puntos vecinos, y no se
// puede pedir "que sea un pentágono"), esto dibuja la figura exacta que
// se pide, a propósito — el precio de cada anillo sigue viniendo de la
// distancia real, solo cambia CÓMO se dibuja.
function puntosPentagono(centro: [number, number], radioKm: number): [number, number][] {
  const kmPorGradoLng = KM_POR_GRADO_LAT * Math.cos((centro[0] * Math.PI) / 180)
  const puntos: [number, number][] = []
  for (let i = 0; i < 5; i++) {
    const anguloGrados = i * 72 - 90 // -90 para que el primer vértice apunte al norte
    const anguloRad = (anguloGrados * Math.PI) / 180
    const dNorteKm = radioKm * Math.sin(-anguloRad)
    const dEsteKm = radioKm * Math.cos(anguloRad)
    puntos.push([centro[0] + dNorteKm / KM_POR_GRADO_LAT, centro[1] + dEsteKm / kmPorGradoLng])
  }
  return puntos
}

// 3 anillos concéntricos — mismos cortes de distancia que ya usa
// zonasPotosi.ts para asignar el precio (≤1km, 1-2km, más de 2km), así
// el color de cada anillo coincide con el precio real de las zonas que
// caen ahí adentro.
const ANILLO_1_KM = 1
const ANILLO_2_KM = 2
const ANILLO_3_KM = 3.3

// Mapa real (calles, nombres de barrios) con OpenStreetMap — es de uso
// libre y gratuito, no necesita ninguna API key (a diferencia de Google
// Maps). Este archivo solo se carga en el navegador (ver
// MapaZonasPotosi.tsx, que lo importa con ssr:false) porque Leaflet
// necesita `window` para dibujar el mapa.
export default function MapaZonasPotosiCliente({ zonaSeleccionada }: { zonaSeleccionada?: string }) {
  const pentagono1 = puntosPentagono(CENTRO, ANILLO_1_KM)
  const pentagono2 = puntosPentagono(CENTRO, ANILLO_2_KM)
  const pentagono3 = puntosPentagono(CENTRO, ANILLO_3_KM)

  return (
    <div className="rounded-lg overflow-hidden border border-line">
      <MapContainer center={CENTRO} zoom={13} scrollWheelZoom={false} style={{ height: 300, width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Anillo 3 (el más grande) primero, para que los de adentro se
            dibujen encima y no lo tapen a él. Es un pentágono grande
            CON un agujero pentagonal adentro (el hueco del anillo 2) —
            así queda como una "dona" pentagonal, no un pentágono
            sólido tapando todo. */}
        <Polygon
          positions={[pentagono3, pentagono2]}
          pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 1.5, fillColor: colorPorPrecio(15), fillOpacity: 0.62 }}
        >
          <Popup><strong>Zona lejana</strong><br />Envío: {bs(15)}</Popup>
        </Polygon>

        <Polygon
          positions={[pentagono2, pentagono1]}
          pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 1.5, fillColor: colorPorPrecio(10), fillOpacity: 0.62 }}
        >
          <Popup><strong>Zona media</strong><br />Envío: {bs(10)}</Popup>
        </Polygon>

        <Polygon
          positions={[pentagono1]}
          pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 1.5, fillColor: colorPorPrecio(5), fillOpacity: 0.62 }}
        >
          <Popup><strong>Centro</strong><br />Envío: {bs(5)}</Popup>
        </Polygon>

        {ZONAS_ENVIO_POTOSI.map((z) => {
          const esSeleccionada = z.nombre === zonaSeleccionada
          return (
            <CircleMarker
              key={z.nombre}
              center={[z.lat, z.lng]}
              radius={esSeleccionada ? 8 : 3}
              pathOptions={{
                color: esSeleccionada ? '#2B211D' : '#fff',
                weight: esSeleccionada ? 2.5 : 1.5,
                fillColor: esSeleccionada ? colorPorPrecio(z.costoEnvio) : '#2B211D',
                fillOpacity: 1,
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
      <div className="flex items-center gap-4 justify-center py-2.5 font-body text-[11px] text-inksoft bg-panel border-t border-line">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#2F8F6F' }} />{bs(5)}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#D98E2B' }} />{bs(10)}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block shadow-sm" style={{ background: '#B5473F' }} />{bs(15)}</div>
      </div>
      <div className="font-body text-[10px] text-inksoft text-center pb-2 px-3 bg-panel">
        Los anillos son una aproximación por distancia real al centro, no los límites barriales oficiales.
      </div>
    </div>
  )
}
