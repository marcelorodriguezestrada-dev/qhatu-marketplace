'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ServiceIcon, RUBROS } from '@/components/ServiceIcon'
import { useAuth } from '@/lib/auth'

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

  return (
    <div className="max-w-[880px] mx-auto px-5 py-8">
      <Link href="/servicios" className="font-body text-[13px] text-inksoft mb-5 inline-block">← Volver al directorio</Link>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
        <div>
          <div className="bg-panelalt rounded-xl overflow-hidden flex items-center justify-center h-[340px] mb-6">
            {perfil.imagenUrl ? (
              <img src={perfil.imagenUrl} alt={perfil.nombre} className="w-full h-full object-cover" />
            ) : (
              <ServiceIcon kind={perfil.icono} size={72} />
            )}
          </div>

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

        <div>
          <div className="bg-panel border border-line rounded-xl p-5 mb-4">
            <div className="font-body text-[11px] text-inksoft mb-1">
              {RUBROS.find((r: any) => r.id === perfil.rubro)?.label || perfil.rubro}
            </div>
            <div className="font-display text-lg font-bold text-ink mb-2 leading-snug">{perfil.nombre}</div>
            <div className="font-display text-xl font-bold text-ink mb-3">
              {perfil.precio ? bs(perfil.precio) : 'Precio a convenir'}
            </div>

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
                className="block text-center w-full py-2.5 mt-2 rounded-lg border border-line font-body text-sm text-ink"
              >
                📷 {perfil.instagram.replace('https://instagram.com/', '').replace('@', '')}
              </a>
            )}
          </div>

          <div className="bg-panel border border-line rounded-xl p-5">
            <div className="font-body text-sm font-semibold text-ink mb-3">Información del profesional</div>
            <div className="font-body text-sm text-ink mb-1">{perfil.nombre}</div>
            {perfil.experiencia && (
              <div className="font-body text-xs text-inksoft mb-1">Experiencia: {perfil.experiencia}</div>
            )}
            {perfil.zona && (
              <div className="font-body text-xs text-inksoft">{perfil.zona}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
