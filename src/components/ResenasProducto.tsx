'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'

// Reseñas de un producto (ver /api/productos/[id]/resenas): promedio,
// lista y, si la persona compró y recibió el producto, el formulario
// para calificarlo. El admin (con la contraseña guardada en este
// navegador) puede borrar reseñas.

type Resena = { id: string; autorNombre: string; calificacion: number; comentario: string; detalle: string; createdAt: string }

export function Estrellas({ valor, tamano = 'text-sm' }: { valor: number; tamano?: string }) {
  return (
    <span className={`${tamano} leading-none tracking-tight`} aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(valor) ? 'text-ochre' : 'text-line'}>★</span>
      ))}
    </span>
  )
}

export default function ResenasProducto({ productoId }: { productoId: string }) {
  const { usuario, obtenerToken } = useAuth()
  const [resenas, setResenas] = useState<Resena[]>([])
  const [puedeResenar, setPuedeResenar] = useState(false)
  const [miResena, setMiResena] = useState<Resena | null>(null)
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [editando, setEditando] = useState(false)
  const [adminPw, setAdminPw] = useState('')

  async function cargar() {
    const token = usuario ? await obtenerToken().catch(() => null) : null
    const d = await fetch(`/api/productos/${productoId}/resenas`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .catch(() => null)
    if (!d) return
    setResenas(d.resenas || [])
    setPuedeResenar(!!d.puedeResenar)
    setMiResena(d.miResena || null)
    if (d.miResena) {
      setCalificacion(d.miResena.calificacion)
      setComentario(d.miResena.comentario || '')
    }
  }

  useEffect(() => {
    cargar()
    try { setAdminPw(localStorage.getItem('clasiclick_admin_pw') || '') } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, usuario?.uid])

  async function enviar() {
    if (calificacion < 1) { setMensaje('Elegí de 1 a 5 estrellas.'); return }
    setEnviando(true)
    setMensaje('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/productos/${productoId}/resenas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ calificacion, comentario }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMensaje('¡Gracias por tu opinión! ✓')
      setEditando(false)
      cargar()
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo guardar tu reseña.')
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta reseña?')) return
    await fetch(`/api/productos/${productoId}/resenas?resenaId=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-password': adminPw } })
    cargar()
  }

  const promedio = resenas.length ? resenas.reduce((s, r) => s + r.calificacion, 0) / resenas.length : 0
  const mostrarFormulario = puedeResenar && (!miResena || editando)

  return (
    <section id="resenas" className="mt-10 scroll-mt-4">
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <h2 className="font-display text-xl font-bold text-ink">Opiniones de compradores</h2>
        {resenas.length > 0 && (
          <span className="flex items-center gap-2 font-body text-sm text-ink">
            <Estrellas valor={promedio} tamano="text-lg" />
            <strong>{promedio.toFixed(1)}</strong>
            <span className="text-inksoft">({resenas.length} {resenas.length === 1 ? 'opinión' : 'opiniones'})</span>
          </span>
        )}
      </div>

      {mostrarFormulario && (
        <div className="bg-panel border border-teal rounded-xl p-4 mb-5">
          <div className="font-body text-sm font-semibold text-ink mb-1">{miResena ? 'Editar tu opinión' : '¿Qué te pareció este producto?'}</div>
          <div className="font-body text-xs text-inksoft mb-2.5">Lo compraste y ya lo recibiste — tu opinión ayuda a otros compradores.</div>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCalificacion(i)}
                aria-label={`${i} estrella${i === 1 ? '' : 's'}`}
                className={`text-3xl leading-none ${i <= calificacion ? 'text-ochre' : 'text-line'}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Contá cómo te quedó, la calidad, si llegó a tiempo... (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm mb-2.5"
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={enviar} disabled={enviando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60">
              {enviando ? 'Enviando...' : 'Publicar opinión'}
            </button>
            {miResena && (
              <button type="button" onClick={() => setEditando(false)} className="font-body text-xs text-inksoft underline">Cancelar</button>
            )}
          </div>
        </div>
      )}
      {mensaje && <div className="font-body text-xs text-ink mb-4">{mensaje}</div>}

      {resenas.length === 0 ? (
        <div className="font-body text-sm text-inksoft">
          Todavía no hay opiniones de este producto.{!puedeResenar && ' Las pueden dejar quienes lo compraron y recibieron.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {resenas.map((r) => (
            <div key={r.id} className="bg-panel border border-line rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Estrellas valor={r.calificacion} />
                <span className="font-body text-sm font-semibold text-ink">{r.autorNombre}</span>
                <span className="font-body text-[11px] text-teal font-semibold">✓ Compra verificada</span>
                <span className="font-body text-[11px] text-inksoft ml-auto">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-BO') : ''}</span>
              </div>
              {r.detalle && <div className="font-body text-[11px] text-inksoft mb-1">{r.detalle}</div>}
              {r.comentario && <p className="font-body text-sm text-ink whitespace-pre-line">{r.comentario}</p>}
              <div className="flex gap-3 mt-1.5">
                {usuario?.uid === r.id && puedeResenar && !editando && (
                  <button type="button" onClick={() => setEditando(true)} className="font-body text-[11px] text-teal underline">Editar mi opinión</button>
                )}
                {adminPw && (
                  <button type="button" onClick={() => borrar(r.id)} className="font-body text-[11px] text-maroon underline">Borrar (admin)</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
