'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { MAX_RESPUESTA } from '@/lib/preguntas'

// /vender → "💬 Preguntas de compradores": el vendedor responde (o borra)
// las preguntas que le hicieron en sus productos. Las sin responder van
// primero; al responder, al comprador le llega el aviso a la campanita.

type Pregunta = { id: string; productoId: string; productoNombre: string; autorNombre: string; texto: string; respuesta: string | null; createdAt: string }

export default function PreguntasVendedor({ onPendientes }: { onPendientes?: (n: number) => void } = {}) {
  const { usuario, obtenerToken } = useAuth()
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null)
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [verRespondidas, setVerRespondidas] = useState(false)

  async function cargar() {
    const token = await obtenerToken()
    const d = await fetch('/api/preguntas', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({}))
    setPreguntas(d.preguntas || [])
    onPendientes?.((d.preguntas || []).filter((q: any) => !q.respuesta).length)
  }

  useEffect(() => {
    if (usuario) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function responder(p: Pregunta) {
    const respuesta = (borradores[p.id] ?? '').trim()
    if (respuesta.length < 2) return
    setGuardando(p.id)
    setError('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/preguntas/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ respuesta }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo responder.')
      setEditando(null)
      await cargar()
    } catch (err: any) {
      setError(err?.message || 'No se pudo responder.')
    } finally {
      setGuardando(null)
    }
  }

  async function borrar(p: Pregunta) {
    if (!confirm('¿Borrar esta pregunta? (por ejemplo, si es spam)')) return
    const token = await obtenerToken()
    await fetch(`/api/preguntas/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    cargar()
  }

  // Llegó desde la campanita (/vender#preguntas): la sección aparece
  // recién cuando cargan las preguntas, así que bajamos a mano.
  useEffect(() => {
    if (preguntas && window.location.hash === '#preguntas') {
      setTimeout(() => document.getElementById('preguntas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    }
  }, [preguntas])

  if (!preguntas) return null
  const pendientes = preguntas.filter((p) => !p.respuesta)
  const respondidas = preguntas.filter((p) => p.respuesta)

  return (
    <div id="preguntas" className="bg-panel border border-line rounded-xl p-5 mb-8 scroll-mt-20">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="font-body text-sm font-semibold text-ink">💬 Preguntas de compradores</div>
        {pendientes.length > 0 && (
          <span className="bg-maroon text-white font-body text-[11px] font-bold px-2 py-0.5 rounded-full">{pendientes.length} sin responder</span>
        )}
      </div>
      <p className="font-body text-[12px] text-inksoft mb-4">
        Las respuestas se ven públicas en el producto (así otros compradores también las leen). Responder rápido ayuda a vender. No compartas teléfonos ni links.
      </p>

      {preguntas.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no te hicieron preguntas.</div>}
      {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}

      <div className="grid gap-3">
        {[...pendientes, ...(verRespondidas ? respondidas : [])].map((p) => {
          const abierta = !p.respuesta || editando === p.id
          return (
            <div key={p.id} className={`rounded-lg border p-3 ${p.respuesta ? 'border-line' : 'border-ochre bg-ochre/5'}`}>
              <div className="font-body text-[11px] text-inksoft mb-1">
                <Link href={`/producto/${p.productoId}#preguntas`} className="text-teal underline">{p.productoNombre || 'Producto'}</Link>
                {' · '}{p.autorNombre} · {new Date(p.createdAt).toLocaleDateString('es-BO')}
              </div>
              <div className="font-body text-sm text-ink mb-2">{p.texto}</div>
              {abierta ? (
                <>
                  <textarea
                    value={borradores[p.id] ?? p.respuesta ?? ''}
                    onChange={(e) => setBorradores({ ...borradores, [p.id]: e.target.value.slice(0, MAX_RESPUESTA) })}
                    placeholder="Escribí tu respuesta..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm mb-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => responder(p)}
                      disabled={guardando === p.id || (borradores[p.id] ?? '').trim().length < 2}
                      className="px-3.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-50"
                    >
                      {guardando === p.id ? 'Enviando...' : 'Responder'}
                    </button>
                    {editando === p.id && (
                      <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-md border border-line font-body text-xs">Cancelar</button>
                    )}
                    <button type="button" onClick={() => borrar(p)} className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-maroon">Borrar</button>
                  </div>
                </>
              ) : (
                <div className="font-body text-sm text-inksoft pl-3 border-l-2 border-teal">
                  {p.respuesta}
                  <button type="button" onClick={() => { setEditando(p.id); setBorradores({ ...borradores, [p.id]: p.respuesta || '' }) }} className="ml-2 text-[11px] text-teal underline">Editar</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {respondidas.length > 0 && (
        <button type="button" onClick={() => setVerRespondidas((v) => !v)} className="mt-3 font-body text-xs text-teal underline">
          {verRespondidas ? 'Ocultar respondidas' : `Ver ${respondidas.length} respondida${respondidas.length === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  )
}
