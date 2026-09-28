'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { MAX_PREGUNTA } from '@/lib/preguntas'

// "Preguntas y respuestas" del producto, estilo Mercado Libre:
// 1) la IA responde al instante con lo publicado (sin iniciar sesión);
// 2) "Mejor preguntar al vendedor" manda la pregunta al vendedor — para
//    eso hay que iniciar sesión (la pregunta se guarda y se envía al
//    volver del login). El vendedor responde desde /vender → Preguntas y
//    al comprador le llega el aviso a la campanita.

type Pregunta = { id: string; texto: string; respuesta: string | null; autorNombre: string; createdAt: string; respondidaEn: string | null; mia: boolean }

const CLAVE_PENDIENTE = 'clasiclick_pregunta_pendiente'

function hace(iso: string | null) {
  if (!iso) return ''
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400_000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-BO')
}

export default function PreguntasProducto({ productoId, vendedorId }: { productoId: string; vendedorId?: string | null }) {
  const { usuario, cargando, obtenerToken } = useAuth()
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [texto, setTexto] = useState('')
  const [preguntando, setPreguntando] = useState(false)
  const [ia, setIa] = useState<{ pregunta: string; respuesta: string | null; seguro: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [error, setError] = useState('')
  const [verTodas, setVerTodas] = useState(false)
  const seccionRef = useRef<HTMLDivElement | null>(null)
  const esVendedor = !!usuario && !!vendedorId && usuario.uid === vendedorId

  async function cargar() {
    const token = usuario ? await obtenerToken() : null
    const d = await fetch(`/api/productos/${productoId}/preguntas`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .catch(() => ({}))
    setPreguntas(d.preguntas || [])
    if (window.location.hash === '#preguntas') {
      setTimeout(() => seccionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }

  useEffect(() => {
    if (cargando) return
    cargar()
    // Volvió del login con una pregunta para el vendedor: la mandamos.
    if (usuario) {
      try {
        const p = JSON.parse(sessionStorage.getItem(CLAVE_PENDIENTE) || 'null')
        if (p?.productoId === productoId && p.texto) {
          sessionStorage.removeItem(CLAVE_PENDIENTE)
          setTexto(p.texto)
          enviarAlVendedor(p.texto)
          setTimeout(() => seccionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, usuario, cargando])

  async function preguntar(e: React.FormEvent) {
    e.preventDefault()
    const q = texto.trim()
    if (q.length < 3) return
    setPreguntando(true)
    setError('')
    setEnviada(false)
    try {
      const d = await fetch(`/api/productos/${productoId}/preguntas/ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q }),
      }).then((r) => r.json())
      setIa({ pregunta: q, respuesta: d.respuesta || null, seguro: d.seguro === true })
      if (!d.respuesta && d.error) setError(d.error)
    } catch {
      setIa({ pregunta: q, respuesta: null, seguro: false })
    } finally {
      setPreguntando(false)
    }
  }

  async function enviarAlVendedor(q = ia?.pregunta || texto.trim()) {
    if (!q) return
    if (!usuario) {
      try { sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ productoId, texto: q })) } catch {}
      window.location.href = `/login?volver=${encodeURIComponent(`/producto/${productoId}#preguntas`)}`
      return
    }
    setEnviando(true)
    setError('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/productos/${productoId}/preguntas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texto: q }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar la pregunta.')
      setEnviada(true)
      setIa(null)
      setTexto('')
      cargar()
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar la pregunta.')
    } finally {
      setEnviando(false)
    }
  }

  const visibles = verTodas ? preguntas : preguntas.slice(0, 5)

  return (
    <div id="preguntas" ref={seccionRef} className="mt-12 scroll-mt-20">
      <div className="font-display text-lg font-bold text-ink mb-3">Preguntas y respuestas</div>

      {esVendedor ? (
        <div className="font-body text-sm text-inksoft bg-panelalt rounded-lg px-4 py-3 mb-5">
          Es tu producto. Respondé las preguntas de los compradores en <Link href="/vender#preguntas" className="text-teal underline">Vender → Preguntas</Link>.
        </div>
      ) : (
        <form onSubmit={preguntar} className="mb-5">
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => { setTexto(e.target.value.slice(0, MAX_PREGUNTA)); setEnviada(false) }}
              placeholder="Escribí tu pregunta... (ej: ¿tienen talle 38?)"
              aria-label="Tu pregunta"
              className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-line bg-panel font-body text-sm"
            />
            <button type="submit" disabled={preguntando || texto.trim().length < 3} className="px-5 py-3 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-50 whitespace-nowrap">
              {preguntando ? 'Pensando...' : 'Preguntar'}
            </button>
          </div>
          <div className="font-body text-[11px] text-inksoft mt-1.5">Te responde al instante nuestro asistente. Si preferís, se la mandás al vendedor.</div>
        </form>
      )}

      {ia && (
        <div className="bg-panel border border-indigo-200 rounded-xl p-4 mb-5">
          <div className="font-body text-sm text-ink mb-2">
            <span className="text-inksoft">Tu pregunta:</span> {ia.pregunta}
          </div>
          {ia.respuesta ? (
            <div className="font-body text-sm text-ink bg-indigo-50 rounded-lg px-3 py-2.5 mb-3">
              <span className="font-semibold text-indigo-700">🤖 Asistente: </span>
              {ia.respuesta}
            </div>
          ) : (
            <div className="font-body text-sm text-inksoft mb-3">No tenemos una respuesta automática para esto. El vendedor te puede ayudar.</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => enviarAlVendedor()}
              disabled={enviando}
              className={`px-4 py-2 rounded-lg font-body text-sm font-semibold disabled:opacity-60 ${ia.seguro && ia.respuesta ? 'border border-teal text-teal bg-panel' : 'border-none bg-teal text-white'}`}
            >
              {enviando ? 'Enviando...' : 'Mejor preguntar al vendedor'}
            </button>
            {ia.respuesta && (
              <button type="button" onClick={() => { setIa(null); setTexto('') }} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink">
                👍 Me sirvió
              </button>
            )}
          </div>
          {!usuario && <div className="font-body text-[11px] text-inksoft mt-2">Para que te responda el vendedor tenés que iniciar sesión (tu pregunta queda guardada).</div>}
        </div>
      )}

      {enviada && (
        <div className="font-body text-sm text-teal bg-tealsoft border border-teal rounded-lg px-4 py-3 mb-5">
          ✓ Le enviamos tu pregunta al vendedor. Te avisamos en la 🔔 campanita cuando responda.
        </div>
      )}
      {error && <div className="font-body text-sm text-maroon mb-4">{error}</div>}

      {preguntas.length === 0 ? (
        <div className="font-body text-sm text-inksoft">Nadie preguntó todavía. ¡Hacé la primera pregunta!</div>
      ) : (
        <div className="grid gap-4">
          <div className="font-body text-xs font-semibold text-inksoft uppercase tracking-wide">Últimas preguntas</div>
          {visibles.map((p) => (
            <div key={p.id} className="font-body text-sm">
              <div className="text-ink">{p.texto}</div>
              {p.respuesta ? (
                <div className="text-inksoft mt-1 pl-3 border-l-2 border-line">
                  {p.respuesta} <span className="text-[11px]">· {hace(p.respondidaEn)}</span>
                </div>
              ) : (
                <div className="text-[12px] text-ochre mt-1 pl-3 border-l-2 border-line">⏳ Tu pregunta · esperando respuesta del vendedor</div>
              )}
            </div>
          ))}
          {preguntas.length > 5 && (
            <button type="button" onClick={() => setVerTodas((v) => !v)} className="font-body text-sm text-teal underline text-left">
              {verTodas ? 'Ver menos' : `Ver las ${preguntas.length} preguntas`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
