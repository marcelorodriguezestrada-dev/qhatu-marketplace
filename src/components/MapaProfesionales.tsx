'use client'

import { useEffect, useRef } from 'react'
import { RUBROS } from './ServiceIcon'
import 'leaflet/dist/leaflet.css'

type Profesional = {
  id: string
  nombre: string
  rubro: string
  lat: number | null
  lng: number | null
}

// Mapa gratuito con Leaflet + OpenStreetMap — a diferencia de Google
// Maps, esto no pide API key ni tarjeta de crédito. Se carga
// dinámicamente porque Leaflet necesita "window", que no existe del
// lado del servidor en Next.js.
export function MapaProfesionales({
  profesionales,
  centro,
}: {
  profesionales: Profesional[]
  centro: { lat: number; lng: number } | null
}) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<any>(null)

  useEffect(() => {
    let cancelado = false

    async function iniciarMapa() {
      const L = (await import('leaflet')).default
      if (cancelado || !contenedorRef.current) return

      // Arreglo necesario porque el bundler de Next.js no resuelve bien
      // las rutas de los íconos por defecto de Leaflet.
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const centroInicial = centro || { lat: -16.5, lng: -68.15 } // La Paz, Bolivia — centro por defecto si no hay ubicación
      const mapa = L.map(contenedorRef.current).setView([centroInicial.lat, centroInicial.lng], centro ? 13 : 6)
      mapaRef.current = mapa

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(mapa)

      if (centro) {
        L.circleMarker([centro.lat, centro.lng], { radius: 8, color: '#2F6E5C', fillColor: '#2F6E5C', fillOpacity: 0.6 })
          .addTo(mapa)
          .bindPopup('Vos estás acá')
      }

      profesionales
        .filter((p) => p.lat != null && p.lng != null)
        .forEach((p) => {
          const rubroLabel = RUBROS.find((r) => r.id === p.rubro)?.label || p.rubro
          L.marker([p.lat as number, p.lng as number])
            .addTo(mapa)
            .bindPopup(`<strong>${p.nombre}</strong><br/>${rubroLabel}<br/><a href="/servicios/${p.id}">Ver perfil</a>`)
        })
    }

    iniciarMapa()

    return () => {
      cancelado = true
      if (mapaRef.current) {
        mapaRef.current.remove()
        mapaRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionales, centro])

  return <div ref={contenedorRef} className="w-full h-[380px] rounded-xl border border-line" />
}
