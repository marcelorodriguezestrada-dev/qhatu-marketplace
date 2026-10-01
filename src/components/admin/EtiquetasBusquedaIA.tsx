'use client'

import { useEffect, useRef, useState } from 'react'

// Admin → Productos: genera con IA las palabras de búsqueda ocultas de
// los productos que ya estaban publicados (los nuevos las reciben solos
// al publicarse). Va de a pocos y muestra el avance; se puede frenar.
export default function EtiquetasBusquedaIA({ password }: { password: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [estado, setEstado] = useState<{ total: number; conEtiquetas: number } | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  const [avance, setAvance] = useState({ hechos: 0, total: 0, fallidos: 0 })
  const [mensaje, setMensaje] = useState('')
  const frenar = useRef(false)

  async function cargarEstado() {
    const d = await fetch('/api/admin/productos/etiquetas', { headers }).then((r) => r.json()).catch(() => null)
    if (d && !d.error) setEstado(d)
  }
  useEffect(() => {
    cargarEstado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generar(todos: boolean) {
    if (todos && !confirm('Esto vuelve a generar las palabras de TODOS los productos. ¿Seguir?')) return
    frenar.current = false
    setCorriendo(true)
    setMensaje('')
    const hechos: string[] = []
    let fallidos = 0
    let total = todos ? estado?.total || 0 : (estado ? estado.total - estado.conEtiquetas : 0)
    setAvance({ hechos: 0, total, fallidos: 0 })
    try {
      while (!frenar.current) {
        const d = await fetch('/api/admin/productos/etiquetas', { method: 'POST', headers, body: JSON.stringify({ todos, hechos }) }).then((r) => r.json())
        if (d.error) throw new Error(d.error)
        hechos.push(...d.procesados)
        fallidos += d.fallidos
        total = Math.max(total, hechos.length + d.restantes)
        setAvance({ hechos: hechos.length, total, fallidos })
        if (!d.restantes || !d.procesados.length) break
      }
      setMensaje(frenar.current ? 'Frenado. Podés seguir cuando quieras: continúa con los que faltan.' : `✓ Listo${fallidos ? ` — ${fallidos} no se pudieron generar (se reintentan la próxima vez)` : ''}.`)
    } catch (err: any) {
      setMensaje(err?.message || 'Se cortó. Probá de nuevo: sigue con los que faltan.')
    } finally {
      setCorriendo(false)
      cargarEstado()
    }
  }

  const faltan = estado ? estado.total - estado.conEtiquetas : 0
  const pct = avance.total ? Math.round((avance.hechos / avance.total) * 100) : 0

  return (
    <div className="bg-panel border border-indigo-200 rounded-xl p-3.5 mb-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">🏷️ Palabras de búsqueda con IA</div>
      <div className="font-body text-[11px] text-inksoft mb-2">
        La IA le agrega a cada producto palabras ocultas con las que la gente lo buscaría (una sandalia también es “zapato” y “calzado”). Así aparecen en “También te puede interesar”. Los productos nuevos las reciben solos al publicarse.
      </div>
      {estado && (
        <div className="font-body text-xs text-ink mb-2">
          {estado.conEtiquetas} de {estado.total} productos ya tienen palabras de búsqueda{faltan > 0 ? ` · faltan ${faltan}` : ' ✓'}
        </div>
      )}
      {corriendo && (
        <div className="mb-2">
          <div className="h-2 rounded-full bg-panelalt overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="font-body text-[11px] text-inksoft mt-1">{avance.hechos} de {avance.total}…</div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!corriendo ? (
          <>
            <button type="button" onClick={() => generar(false)} disabled={!estado || faltan === 0} className="px-3.5 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-40">
              ✨ Generar para los que faltan{faltan ? ` (${faltan})` : ''}
            </button>
            <button type="button" onClick={() => generar(true)} disabled={!estado?.total} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink disabled:opacity-40">
              Regenerar todas
            </button>
          </>
        ) : (
          <button type="button" onClick={() => { frenar.current = true }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink">Frenar</button>
        )}
        {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
      </div>
    </div>
  )
}
