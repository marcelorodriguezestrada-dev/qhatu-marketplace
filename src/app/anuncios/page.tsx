'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { TIPOS_ANUNCIO, labelTipoAnuncio } from '@/data/anuncios'
import { useCategorias } from '@/lib/useCategorias'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// "hace 2 h", "hace 3 días"... a partir del createdAt (ISO).
function haceCuanto(iso?: string) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(min) || min < 0) return ''
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return d === 1 ? 'hace 1 día' : `hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? 'hace 1 mes' : m < 12 ? `hace ${m} meses` : 'hace más de un año'
}

// Color y emoji por tipo de anuncio: la etiqueta sobre la foto y el
// fondo del marcador cuando el anuncio no tiene foto.
const ESTILO_TIPO: Record<string, { etiqueta: string; fondo: string; emoji: string }> = {
  venta: { etiqueta: 'bg-teal text-white', fondo: 'bg-tealsoft text-teal', emoji: '🏷️' },
  busqueda: { etiqueta: 'bg-ochre text-white', fondo: 'bg-ochresoft text-ochre', emoji: '🔎' },
  aviso: { etiqueta: 'bg-maroon text-white', fondo: 'bg-maroonsoft text-maroon', emoji: '📢' },
  otro: { etiqueta: 'bg-ink text-white', fondo: 'bg-panelalt text-inksoft', emoji: '📌' },
}

export default function AnunciosPage() {
  const { usuario } = useAuth()
  const { buscarRubro } = useCategorias()
  const [anuncios, setAnuncios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  // Fotos que no cargaron (link roto o borrado): mostramos el marcador de
  // color en vez del texto alternativo del navegador.
  const [fotosRotas, setFotosRotas] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/anuncios')
      .then((r) => r.json())
      .then((data) => setAnuncios(data.anuncios || []))
      .finally(() => setCargando(false))
  }, [])

  const filtrados = anuncios
    .filter((a) => tipoFiltro === 'Todos' || a.tipo === tipoFiltro)
    .filter((a) => {
      const q = busqueda.trim().toLowerCase()
      if (!q) return true
      return (a.titulo || '').toLowerCase().includes(q) || (a.descripcion || '').toLowerCase().includes(q)
    })

  return (
    <div>
      <div className="bg-ink px-4 sm:px-5 py-3">
        <div className="max-w-[960px] mx-auto flex items-center gap-2 flex-wrap">
          <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
          <span className="font-body text-sm text-white/70 hidden sm:inline sm:flex-1">Anuncios clasificados</span>
          {usuario && (
            <Link
              href="/mis-anuncios"
              className="border-none bg-transparent text-white/80 font-body text-xs sm:text-sm shrink-0 whitespace-nowrap"
            >
              Mis anuncios
            </Link>
          )}
          <Link
            href="/publicar-anuncio"
            className="ml-auto border-none bg-white/10 text-white px-3 py-2 rounded-lg font-body text-xs sm:text-sm shrink-0 whitespace-nowrap"
          >
            Publicar anuncio
          </Link>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 sm:px-5 py-6 sm:py-8">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en anuncios..."
          className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-panel font-body text-sm mb-4"
        />
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setTipoFiltro('Todos')}
            className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium ${
              tipoFiltro === 'Todos' ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
            }`}
          >
            Todos
          </button>
          {TIPOS_ANUNCIO.map((t) => (
            <button
              key={t.id}
              onClick={() => setTipoFiltro(t.id)}
              className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium ${
                tipoFiltro === t.id ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {cargando && <div className="font-body text-sm text-inksoft">Cargando anuncios...</div>}
        {!cargando && filtrados.length === 0 && (
          <div className="bg-panel border border-line rounded-xl p-6 text-center font-body text-sm text-inksoft">
            {busqueda.trim() ? `No encontramos nada para "${busqueda}".` : `No hay anuncios ${tipoFiltro !== 'Todos' ? 'de este tipo' : ''} todavía.`}
          </div>
        )}

        {filtrados.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtrados.map((a) => {
              const estilo = ESTILO_TIPO[a.tipo] || ESTILO_TIPO.otro
              const rubroLabel = a.rubro ? buscarRubro(a.rubro)?.label : ''
              const meta = [haceCuanto(a.createdAt), a.zona].filter(Boolean).join(' · ')
              const whatsapp = (a.whatsapp || '').replace(/\D/g, '')
              const conFoto = !!a.imagenUrl && !fotosRotas.has(a.id)
              return (
                // La tarjeta no es un <a> entero: el link al detalle y el
                // botón de WhatsApp son hermanos (un <a> dentro de otro es
                // HTML inválido y el toque a veces abría el anuncio).
                <div key={a.id} className="bg-panel border border-line rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  <Link href={`/anuncios/${a.id}`} className="flex flex-col flex-1">
                    <div className="relative aspect-square bg-panelalt">
                      {conFoto ? (
                        <img
                          src={a.thumbUrl || a.imagenUrl}
                          alt={a.titulo}
                          loading="lazy"
                          decoding="async"
                          onError={() => setFotosRotas((prev) => new Set(prev).add(a.id))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 px-3 text-center ${estilo.fondo}`}>
                          <span className="text-4xl" aria-hidden="true">{estilo.emoji}</span>
                          {rubroLabel && <span className="font-body text-[11px] font-semibold opacity-80 line-clamp-2">{rubroLabel}</span>}
                        </div>
                      )}
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-body text-[10px] font-semibold shadow-sm ${estilo.etiqueta}`}>
                        {labelTipoAnuncio(a.tipo)}
                      </span>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      {a.precio ? (
                        <div className="font-display text-lg font-bold text-ink leading-tight">{bs(a.precio)}</div>
                      ) : null}
                      <div className="font-body text-sm font-semibold text-ink line-clamp-2 mt-0.5">{a.titulo}</div>
                      {a.descripcion && <div className="font-body text-xs text-inksoft mt-1 line-clamp-2">{a.descripcion}</div>}
                      <div className="font-body text-[11px] text-inksoft mt-auto pt-2 truncate">
                        {meta}
                        {rubroLabel && conFoto && <>{meta ? ' · ' : ''}{rubroLabel}</>}
                      </div>
                    </div>
                  </Link>
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola! Te escribo por tu anuncio "${a.titulo}" en Clasi Click.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mx-3 mb-3 py-2 rounded-lg bg-teal text-white font-body text-xs font-semibold text-center"
                    >
                      💬 Contactar
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
