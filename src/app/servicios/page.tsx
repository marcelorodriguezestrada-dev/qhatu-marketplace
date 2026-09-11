'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { ServiceIcon } from '@/components/ServiceIcon'
import { useCategorias } from '@/lib/useCategorias'
import { esPremiumVigente } from '@/lib/planPremium'

const MapaProfesionales = dynamic(() => import('@/components/MapaProfesionales').then((m) => m.MapaProfesionales), {
  ssr: false,
  loading: () => <div className="w-full h-[380px] rounded-xl border border-line bg-panelalt flex items-center justify-center font-body text-sm text-inksoft">Cargando mapa...</div>,
})

type Profesional = {
  id: string
  nombre: string
  rubro: string
  especialidad?: string
  descripcion: string
  zona: string
  direccion?: string
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
  const { categorias, rubrosFlat, buscarRubro } = useCategorias()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [categoriaSel, setCategoriaSel] = useState('Todo')
  const [rubro, setRubro] = useState('Todo')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'calificacion' | 'cercania'>('calificacion')
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const router = useRouter()
  const pathname = usePathname()

  // Filtro geográfico por defecto: Potosí, Bolivia
  const [soloPotosi, setSoloPotosi] = useState(false)
  const POTOSI = { lat: -19.5886, lng: -65.7531 }
  const POTOSI_RADIUS_KM = 50

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q') || ''
    if (q) setBusqueda(q)
    const categoriaParam = params.get('categoria')
    if (categoriaParam) setCategoriaSel(categoriaParam)
    const rubroParam = params.get('rubro')
    if (rubroParam) setRubro(rubroParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/profesionales')
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
  }, [])

  function pedirUbicacion(luegoMostrarMapa: boolean) {
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
        if (luegoMostrarMapa) setVista('mapa')
        else setOrden('cercania')
        setBuscandoUbicacion(false)
      },
      () => {
        setErrorUbicacion('No pudimos acceder a tu ubicación. Revisá los permisos del navegador.')
        setBuscandoUbicacion(false)
      }
    )
  }

  // Rubros que pertenecen a la categoría elegida — así el filtro "por
  // categoría" incluye a cualquier profesional cuyo rubro esté en esa
  // categoría, sea un rubro de la base o uno agregado después.
  const rubroIdsDeCategoria = categorias.find((c) => c.id === categoriaSel)?.rubros.map((r) => r.id) || []

  let filtrados = profesionales.filter((p) => {
    if (soloPotosi) {
      const zonaRaw = (p.zona || '').toLowerCase()
          const zonaNormalized = zonaRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const zonaMatch = zonaNormalized.includes('potos')
      const hasCoords = p.lat != null && p.lng != null
      const withinRadius = hasCoords && distanciaKm(POTOSI.lat, POTOSI.lng, p.lat as number, p.lng as number) <= POTOSI_RADIUS_KM
      if (!zonaMatch && !withinRadius) return false
    }

    // Todo (sin categoría ni rubro elegido) siempre muestra a todos
    // los profesionales, incluso los que quedaron con un rubro que
    // todavía no está en ninguna categoría — así nadie desaparece del
    // directorio por un dato de taxonomía incompleto.
    let matchRubro = true
    if (rubro !== 'Todo') {
      matchRubro = p.rubro === rubro
    } else if (categoriaSel !== 'Todo') {
      matchRubro = rubroIdsDeCategoria.includes(p.rubro)
    }

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

  // Beneficio Premium: aparecer primero, sin importar el criterio de
  // orden elegido arriba. .sort es estable, así que esto no desordena
  // lo que ya se ordenó por cercanía/rating dentro de cada grupo
  // (premium entre sí, básicos entre sí) — solo antepone un grupo al otro.
  filtrados = [...filtrados].sort((a, b) => (esPremiumVigente(b) ? 1 : 0) - (esPremiumVigente(a) ? 1 : 0))

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-5 py-3.5">
        <div className="max-w-[960px] mx-auto flex items-center gap-2 flex-wrap">
          <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
          <span className="font-body text-sm text-white/70 hidden sm:inline sm:flex-1">Servicios profesionales</span>
          <div className="flex items-center gap-2 ml-auto">
            <Link
              href="/publicar-servicio"
              className="border-none bg-white/10 text-white px-3 py-2 rounded-lg font-body text-xs sm:text-sm shrink-0 whitespace-nowrap"
            >
              Publicá tu servicio
            </Link>
            <Link
              href="/mi-perfil"
              className="border border-white/20 text-white px-3 py-2 rounded-lg font-body text-xs sm:text-sm shrink-0 whitespace-nowrap"
            >
              Mi perfil
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-5 py-6 pb-12">
        <div className="flex items-center gap-2 mb-4">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const q = encodeURIComponent(busqueda || '')
                router.push(`${pathname}${q ? `?q=${q}` : ''}`)
              }
            }}
            placeholder="Buscar por nombre o zona"
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const q = encodeURIComponent(busqueda || '')
              router.push(`${pathname}${q ? `?q=${q}` : ''}`)
            }}
            className="px-3 py-2 rounded-lg bg-maroon text-white text-sm"
            aria-label="Buscar servicios"
          >
            🔍
          </button>
        </div>

        <div className="flex gap-3 mb-2 flex-wrap items-center">
          <select
            value={categoriaSel}
            onChange={(e) => {
              const nuevaCategoria = e.target.value
              setCategoriaSel(nuevaCategoria)
              setRubro('Todo')
              if (nuevaCategoria !== 'Todo') {
                fetch('/api/analitica/categoria', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tipo: 'servicio', valor: nuevaCategoria }),
                }).catch(() => {})
              }
            }}
            className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel flex-1 min-w-[160px]"
          >
            <option value="Todo">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          {categoriaSel !== 'Todo' && (
            <select
              value={rubro}
              onChange={(e) => {
                setRubro(e.target.value)
                if (e.target.value !== 'Todo') {
                  fetch('/api/analitica/categoria', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo: 'servicio', valor: e.target.value }),
                  }).catch(() => {})
                }
              }}
              className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel flex-1 min-w-[160px]"
            >
              <option value="Todo">Todos los rubros</option>
              {(categorias.find((c) => c.id === categoriaSel)?.rubros || []).map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          )}
        </div>

        {(categoriaSel !== 'Todo' || rubro !== 'Todo') && (
          <div className="font-body text-xs text-inksoft mb-4">
            {categorias.find((c) => c.id === categoriaSel)?.label || 'Todas las categorías'}
            {rubro !== 'Todo' && <> <span className="text-line">›</span> {buscarRubro(rubro)?.label || rubro}</>}
          </div>
        )}

        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <div className="flex gap-1 bg-panelalt border border-line rounded-lg p-1">
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold ${vista === 'lista' ? 'bg-panel text-ink shadow-sm' : 'text-inksoft'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setVista('mapa')}
              disabled={buscandoUbicacion}
              className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold ${vista === 'mapa' ? 'bg-panel text-ink shadow-sm' : 'text-inksoft'}`}
            >
              {buscandoUbicacion ? 'Ubicando...' : 'Mapa'}
            </button>
          </div>
        </div>

        {vista === 'lista' && (
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setOrden('calificacion')}
              className={`font-body text-xs font-semibold ${orden === 'calificacion' ? 'text-maroon' : 'text-inksoft'}`}
            >
              Mejor calificados
            </button>
            <span className="text-inksoft text-xs">·</span>
            <button
              onClick={() => pedirUbicacion(false)}
              disabled={buscandoUbicacion}
              className={`font-body text-xs font-semibold ${orden === 'cercania' ? 'text-maroon' : 'text-inksoft'}`}
            >
              {buscandoUbicacion ? 'Buscando tu ubicación...' : 'Más cercanos'}
            </button>
          </div>
        )}
        {errorUbicacion && <div className="font-body text-xs text-maroon mb-4">{errorUbicacion}</div>}

        {vista === 'mapa' ? (
          <MapaProfesionales
            profesionales={filtrados.map((p) => ({ ...p, rubroLabel: buscarRubro(p.rubro)?.label }))}
            centro={ubicacion ?? (soloPotosi ? POTOSI : null)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtrados.map((p) => (
              <Link
                key={p.id}
                href={`/servicios/${p.id}`}
                className="bg-panel border border-line rounded-lg overflow-hidden flex items-stretch gap-4 p-3 hover:shadow-md transition-shadow"
              >
                <div className="w-28 h-28 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden relative">
                  {p.imagenUrl ? (
                    <img src={p.imagenUrl} alt={p.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <ServiceIcon kind={p.icono} size={40} />
                  )}
                  {esPremiumVigente(p) && (
                    <span className="absolute top-1.5 left-1.5 bg-ochre text-white text-[10px] font-semibold px-2 py-0.5 rounded-full font-body">
                      Destacado
                    </span>
                  )}
                </div>
                <div className="flex-1 py-1 flex flex-col justify-center min-w-0">
                  <div className="font-body text-[11px] text-inksoft mb-0.5">
                    {p.especialidad || buscarRubro(p.rubro)?.label || p.rubro}
                  </div>
                  <div className="font-display text-base font-semibold text-ink mb-1 truncate">{p.nombre}</div>
                  {p.precio ? (
                    <div className="font-body text-sm font-bold text-ink mb-1">{bs(p.precio)}</div>
                  ) : null}
                  {p.zona && <div className="font-body text-xs text-inksoft mb-1">Zona: {p.zona}</div>}
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
        )}

        {vista === 'lista' && filtrados.length === 0 && (
          <div className="text-center py-14 text-inksoft font-body text-sm">
            No hay profesionales publicados en esta categoría todavía.
          </div>
        )}
      </div>
    </div>
  )
}