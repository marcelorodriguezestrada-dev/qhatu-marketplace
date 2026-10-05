'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { ReactNode } from 'react'

// Mapa de 🎯 Captar tiendas (solo navegador; ver MapaProspectos.tsx).
// Puntos chicos azules = tiendas de OpenStreetMap; grandes de color =
// tus prospectos (color según el estado).

export type PuntoMapa = { id: string; lat: number; lng: number; color: string; grande?: boolean; titulo: string; popup: ReactNode }
export type Caja = { sur: number; oeste: number; norte: number; este: number }

function Eventos({ onMover, onTocar }: { onMover: (c: Caja) => void; onTocar?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend: () => { const b = map.getBounds(); onMover({ sur: b.getSouth(), oeste: b.getWest(), norte: b.getNorth(), este: b.getEast() }) },
    click: (e) => onTocar?.(e.latlng.lat, e.latlng.lng),
  })
  useEffect(() => { const b = map.getBounds(); onMover({ sur: b.getSouth(), oeste: b.getWest(), norte: b.getNorth(), este: b.getEast() }) }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function IrA({ centro, zoom }: { centro: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.setView(centro, zoom) }, [map, centro[0], centro[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function MapaProspectosCliente({
  centro,
  zoom = 16,
  puntos,
  onMover,
  onTocar,
  marcando,
  alto = 460,
}: {
  centro: [number, number]
  zoom?: number
  puntos: PuntoMapa[]
  onMover: (c: Caja) => void
  onTocar?: (lat: number, lng: number) => void
  marcando?: boolean
  alto?: number
}) {
  return (
    <div className={`rounded-lg overflow-hidden border ${marcando ? 'border-teal ring-2 ring-teal/40' : 'border-line'}`} style={{ cursor: marcando ? 'crosshair' : undefined }}>
      <MapContainer center={centro} zoom={zoom} scrollWheelZoom style={{ height: alto, width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <IrA centro={centro} zoom={zoom} />
        <Eventos onMover={onMover} onTocar={onTocar} />
        {puntos.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.grande ? 10 : 6}
            pathOptions={{ color: '#fff', weight: p.grande ? 3 : 1.5, fillColor: p.color, fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{p.titulo}</Tooltip>
            <Popup minWidth={230}>{p.popup}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
