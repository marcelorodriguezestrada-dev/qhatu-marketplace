'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'

// Mapa para que el comprador marque su casa (checkout → "Marcar en el
// mapa"): tocá el mapa o arrastrá el pin. Solo navegador (ver
// ElegirUbicacion.tsx, que lo carga con ssr:false).

// Pin dibujado con HTML: los íconos de imagen por defecto de Leaflet no
// cargan bien empaquetados con Next.
const PIN = L.divIcon({
  className: '',
  html: '<div style="font-size:34px;line-height:34px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">📍</div>',
  iconSize: [0, 0],
})

function AlTocar({ onTocar }: { onTocar: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onTocar(e.latlng.lat, e.latlng.lng) })
  return null
}

function Centrar({ punto }: { punto: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(punto, Math.max(map.getZoom(), 16)) }, [map, punto])
  return null
}

export default function ElegirUbicacionCliente({
  inicial,
  onCambiar,
}: {
  inicial: { lat: number; lng: number }
  onCambiar: (lat: number, lng: number) => void
}) {
  const [punto, setPunto] = useState<[number, number]>([inicial.lat, inicial.lng])
  const [centro] = useState<[number, number]>([inicial.lat, inicial.lng])
  const mover = (lat: number, lng: number) => { setPunto([lat, lng]); onCambiar(lat, lng) }
  return (
    <div className="rounded-lg overflow-hidden border border-line">
      <MapContainer center={centro} zoom={16} scrollWheelZoom={false} style={{ height: 280, width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker
          position={punto}
          icon={PIN}
          draggable
          eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); mover(ll.lat, ll.lng) } }}
        />
        <AlTocar onTocar={mover} />
        <Centrar punto={centro} />
      </MapContainer>
    </div>
  )
}
