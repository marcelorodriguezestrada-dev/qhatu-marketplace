'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ServiceIcon, RUBROS } from '@/components/ServiceIcon'

type Profesional = {
  id: string
  nombre: string
  rubro: string
  descripcion: string
  zona: string
  lat: number | null
  lng: number | null
  icono: string
  imagenUrl?: string
  precio?: number | null
  experiencia?: string
  plan: string
  ratingPromedio: number
  cantidadResenas: number
}

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// Fórmula de Haversine — distancia en km entre dos puntos geográficos.
// La usamos para "ordenar por cercanía" cuando el usuario comparte su
// ubicación del navegador.
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function Estrellas({ valor }: { valor: number }) {
  return (
    <span className="text-ochre font-body text-xs">
      {'★'.repeat(Math.round(valor))}
      {'☆'.repeat(5 - Math.round(valor))}
    </span>
  )
}

export default function ServiciosPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [rubro, setRubro] = useState('Todo')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'calificacion' | 'cercania'>('calificacion')
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')

  useEffect(() => {
    fetch('/api/profesionales')
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
  }, [])

  function ordenarPorCercania() {
    setErrorUbicacion('')
    setBuscandoUbicacion(true)
    if (!navigator.geolocation) {
      setErrorUbicacion('Tu navegador no soporta geolocalización.')
      setBuscandoUbicacion(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setOrden('cercania')
        setBuscandoUbicacion(false)
      },
      () => {
        setErrorUbicacion('No pudimos acceder a tu ubicación. Revisá los permisos del navegador.')
        setBuscandoUbicacion(false)
      }
    )
  }

  let filtrados = profesionales.filter((p) => {
    const matchRubro = rubro === 'Todo' || p.rubro === rubro
    const matchBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.zona || '').toLowerCase().includes(busqueda.toLowerCase())
    return matchRubro && matchBusqueda
  })

  if (orden === 'cercania' && ubicacion) {
    filtrados = [...filtrados].sort((a, b) => {
      const da = a.lat != null && a.lng != null ? distanciaKm(ubicacion.lat, ubicacion.lng, a.lat, a.lng) : Infinity
      const db = b.lat != null && b.lng != null ? distanciaKm(ubicacion.lat, ubicacion.lng, b.lat, b.lng) : Infinity
      return da - db
    })
  } else {
    filtrados = [...filtrados].sort((a, b) => (b.ratingPromedio || 0) - (a.ratingPromedio || 0))
  }

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-5 py-3.5">
        <div className="max-w-[960px] mx-auto flex items-center gap-3">
          <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
          <span className="font-body text-sm text-white/70 flex-1">Servicios profesionales</span>
          <Link
            href="/publicar-servicio"
            className="border-none bg-white/10 text-white px-3.5 py-2 rounded-lg font-body text-sm shrink-0 whitespace-nowrap"
          >
            Publicá tu servicio
          </Link>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-5 py-6 pb-12">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o zona"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-4"
        />

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setRubro('Todo')}
            className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium ${
              rubro === 'Todo' ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
            }`}
          >
            Todo
          </button>
          {RUBROS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRubro(r.id)}
              className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium ${
                rubro === r.id ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setOrden('calificacion')}
            className={`font-body text-xs font-semibold ${orden === 'calificacion' ? 'text-maroon' : 'text-inksoft'}`}
          >
            Mejor calificados
          </button>
          <span className="text-inksoft text-xs">·</span>
          <button
            onClick={ordenarPorCercania}
            disabled={buscandoUbicacion}
            className={`font-body text-xs font-semibold ${orden === 'cercania' ? 'text-maroon' : 'text-inksoft'}`}
          >
            {buscandoUbicacion ? 'Buscando tu ubicación...' : 'Más cercanos'}
          </button>
        </div>
        {errorUbicacion && <div className="font-body text-xs text-maroon mb-4">{errorUbicacion}</div>}

        <div className="flex flex-col gap-3">
          {filtrados.map((p) => (
            <Link
              key={p.id}
              href={`/servicios/${p.id}`}
              className="bg-panel border border-line rounded-lg overflow-hidden flex items-stretch gap-4 p-3 hover:shadow-md transition-shadow"
            >
              <div className="w-28 h-28 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden relative">
                {p.imagenUrl ? (
                  <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                ) : (
                  <ServiceIcon kind={p.icono} size={40} />
                )}
                {p.plan === 'premium' && (
                  <span className="absolute top-1.5 left-1.5 bg-ochre text-white text-[10px] font-semibold px-2 py-0.5 rounded-full font-body">
                    Destacado
                  </span>
                )}
              </div>
              <div className="flex-1 py-1 flex flex-col justify-center min-w-0">
                <div className="font-body text-[11px] text-inksoft mb-0.5">
                  {RUBROS.find((r) => r.id === p.rubro)?.label || p.rubro}
                </div>
                <div className="font-display text-base font-semibold text-ink mb-1 truncate">{p.nombre}</div>
                <div className="font-body text-sm font-bold text-ink mb-1">
                  {p.precio ? bs(p.precio) : 'Precio a convenir'}
                </div>
                <div className="font-body text-xs text-inksoft mb-1">{p.zona}</div>
                {p.cantidadResenas > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Estrellas valor={p.ratingPromedio} />
                    <span className="font-body text-[11px] text-inksoft">({p.cantidadResenas})</span>
                  </div>
                ) : (
                  <span className="font-body text-[11px] text-inksoft">Sin reseñas todavía</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="text-center py-14 text-inksoft font-body text-sm">
            No hay profesionales publicados en esta categoría todavía.
          </div>
        )}
      </div>
    </div>
  )
}
