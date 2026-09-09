'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useCategorias } from '@/lib/useCategorias'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function Estrellas({ valor, size = 'text-sm' }: { valor: number; size?: string }) {
  return (
    <span className={`text-ochre font-body ${size}`}>
      {'★'.repeat(Math.round(valor))}
      {'☆'.repeat(5 - Math.round(valor))}
    </span>
  )
}

export default function PerfilProfesionalPage() {
  const params = useParams()
  const id = params?.id as string
  const { usuario, obtenerToken } = useAuth()
  const { buscarRubro } = useCategorias()
  const [perfil, setPerfil] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [calificacion, setCalificacion] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  function cargar() {
    fetch(`/api/profesionales/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPerfil(data)
        setCargando(false)
      })
  }

  useEffect(() => {
    if (id) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function enviarResena(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${id}/resenas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ calificacion, comentario }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setComentario('')
      cargar()
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  if (!perfil || perfil.error) return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">No encontramos este perfil.</div>

  const linkWhatsapp = `https://wa.me/${perfil.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${perfil.nombre}, te vi en Clasi Click y quería consultarte por tus servicios.`
  )}`

  const rubroInfo = buscarRubro(perfil.rubro)

  return (
    <div className="max-w-[880px] mx-auto px-5 py-8">
      <div className="flex items-center gap-1.5 flex-wrap font-body text-[13px] text-inksoft mb-5">
        <Link href="/servicios" className="hover:underline">Servicios</Link>
        {rubroInfo && (
          <>
            <span className="text-line">›</span>
            <Link href={`/servicios?categoria=${rubroInfo.categoriaId}`} className="hover:underline">
              {rubroInfo.categoriaLabel}
            </Link>
            <span className="text-line">›</span>
            <Link href={`/servicios?categoria=${rubroInfo.categoriaId}&rubro=${rubroInfo.id}`} className="hover:underline">
              {rubroInfo.label}
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        <div className="order-2 md:order-1 min-w-0">
          {perfil.descripcion && (
            <>
              <div className="font-display text-lg font-bold text-ink mb-2">Descripción</div>
              <p className="font-body text-sm text-ink mb-8 whitespace-pre-line">{perfil.descripcion}</p>
            </>
          )}

          <div className="font-body text-sm font-semibold text-ink mb-3">Reseñas</div>

          {usuario ? (
            <form onSubmit={enviarResena} className="bg-panel border border-line rounded-lg p-4 mb-5">
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCalificacion(n)}
                    className={`text-lg ${n <= calificacion ? 'text-ochre' : 'text-line'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Contá tu experiencia (opcional)"
                className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm mb-2"
                rows={2}
              />
              {error && <div className="font-body text-xs text-maroon mb-2">{error}</div>}
              <button
                type="submit"
                disabled={enviando}
                className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-xs font-semibold"
              >
                {enviando ? 'Enviando...' : 'Dejar reseña'}
              </button>
            </form>
          ) : (
            <div className="font-body text-xs text-inksoft mb-5">
              <Link href="/login" className="text-maroon underline">Iniciá sesión</Link> para dejar una reseña.
            </div>
          )}

          {(perfil.resenas || []).map((r: any) => (
            <div key={r.id} className="border-b border-line py-3">
              <div className="flex items-center gap-2 mb-1">
                <Estrellas valor={r.calificacion} size="text-xs" />
                <span className="font-body text-[11px] text-inksoft">{r.autorEmail?.split('@')[0]}</span>
              </div>
              {r.comentario && <div className="font-body text-sm text-ink">{r.comentario}</div>}
            </div>
          ))}
          {(!perfil.resenas || perfil.resenas.length === 0) && (
            <div className="font-body text-sm text-inksoft">Sé el primero en dejar una reseña.</div>
          )}
        </div>

        <div className="order-1 md:order-2">
          <div className="bg-panel border border-line rounded-xl p-5 mb-4">
            <div className="font-display text-lg font-bold text-ink mb-1 leading-snug">{perfil.nombre}</div>
            {(perfil.especialidad || rubroInfo?.label || perfil.rubro) && (
              <div className="font-body text-sm text-ink mb-2">
                {perfil.especialidad || rubroInfo?.label || perfil.rubro}
              </div>
            )}
            {(perfil.direccion || perfil.zona || perfil.experiencia) && (
              <div className="font-body text-xs text-inksoft mb-3 space-y-0.5">
                {perfil.direccion && <div>Dirección: {perfil.direccion}</div>}
                {perfil.zona && <div>Zona: {perfil.zona}</div>}
                {perfil.experiencia && <div>Experiencia: {perfil.experiencia}</div>}
              </div>
            )}
            {perfil.precio ? (
              <div className="font-display text-xl font-bold text-ink mb-3">{bs(perfil.precio)}</div>
            ) : null}

            {perfil.cantidadResenas > 0 ? (
              <div className="flex items-center gap-2 mb-3">
                <Estrellas valor={perfil.ratingPromedio} />
                <span className="font-body text-xs text-inksoft">
                  {perfil.ratingPromedio} ({perfil.cantidadResenas})
                </span>
              </div>
            ) : (
              <div className="font-body text-xs text-inksoft mb-3">Todavía sin reseñas</div>
            )}

            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => fetch(`/api/profesionales/${id}/click-whatsapp`, { method: 'POST' }).catch(() => {})}
              className="block text-center w-full py-3 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold"
            >
              Contactar por WhatsApp
            </a>

            {perfil.instagram && (
              <a
                href={perfil.instagram.startsWith('http') ? perfil.instagram : `https://instagram.com/${perfil.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full py-2.5 mt-2 rounded-lg border border-line font-body text-sm text-ink break-words"
              >
                📷 {perfil.instagram.replace('https://instagram.com/', '').replace('@', '')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}