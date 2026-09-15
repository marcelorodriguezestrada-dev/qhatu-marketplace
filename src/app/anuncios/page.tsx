'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { TIPOS_ANUNCIO, labelTipoAnuncio } from '@/data/anuncios'
import { useCategorias } from '@/lib/useCategorias'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export default function AnunciosPage() {
  const { usuario } = useAuth()
  const { buscarRubro } = useCategorias()
  const [anuncios, setAnuncios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')

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

      <div className="max-w-[720px] mx-auto px-5 py-8">
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

        {filtrados.map((a) => (
          <Link key={a.id} href={`/anuncios/${a.id}`} className="bg-panel border border-line rounded-xl p-4 mb-3 flex gap-3">
            {a.imagenUrl && (
              <img src={a.imagenUrl} alt={a.titulo} className="w-16 h-16 rounded-lg object-cover border border-line shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-body text-[10px] font-semibold text-maroon uppercase tracking-wide mb-0.5">
                {labelTipoAnuncio(a.tipo)}
                {a.rubro && buscarRubro(a.rubro) && (
                  <span className="text-inksoft normal-case font-normal"> · {buscarRubro(a.rubro)?.label}</span>
                )}
              </div>
              <div className="font-body text-sm font-semibold text-ink">{a.titulo}</div>
              <div className="font-body text-xs text-inksoft mt-1 line-clamp-2">{a.descripcion}</div>
              {a.precio && <div className="font-body text-sm font-bold text-ink mt-1">{bs(a.precio)}</div>}
              <a
                href={`https://wa.me/${(a.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola! Te escribo por tu anuncio "${a.titulo}" en Clasi Click.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block mt-2 px-3 py-1.5 rounded-md bg-teal text-white font-body text-xs font-semibold"
              >
                💬 Contactar
              </a>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
