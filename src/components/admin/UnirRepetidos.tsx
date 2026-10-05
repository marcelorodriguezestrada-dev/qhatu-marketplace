'use client'

import { useMemo, useState } from 'react'
import { codigoTienda, separarMarcaFoto } from '@/lib/importarCarpeta'

// Edición rápida → aviso "productos repetidos": el mismo producto cargado
// varias veces con distinta foto ("Banquito a", "Banquito c", "Banquito v"
// de la misma tienda, y a veces también un "Banquito" de una importación
// nueva). Por cada uno se elige: sumar sus fotos, borrarlo (si sus fotos ya
// están en otro) o dejarlo aparte. Ver /api/admin/productos/unir.

type P = { id: string; nombre: string; vendedor?: string; vendedorId?: string; imagenUrl?: string; thumbUrl?: string; fotosAdicionales?: string[] }
type Accion = 'unir' | 'borrar' | 'aparte'

const cantFotos = (p: P) => (p.imagenUrl ? 1 : 0) + (p.fotosAdicionales?.length || 0)

export default function UnirRepetidos({ password, productos, onUnidos }: { password: string; productos: P[]; onUnidos: (msg: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [acciones, setAcciones] = useState<Record<string, Accion>>({})
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [uniendo, setUniendo] = useState<string | null>(null)
  const [error, setError] = useState('')

  const grupos = useMemo(() => {
    const m = new Map<string, P[]>()
    for (const p of productos) {
      const k = `${p.vendedorId || ''}::${codigoTienda(separarMarcaFoto(p.nombre).base)}`
      m.set(k, [...(m.get(k) || []), p])
    }
    return [...m.entries()]
      .filter(([, g]) => g.length >= 2 && g.some((p) => separarMarcaFoto(p.nombre).marca))
      .map(([clave, g]) => {
        // Primero el que no tiene letra al final ("Banquito"), si hay.
        const ordenados = [...g].sort((a, b) => Number(!!separarMarcaFoto(a.nombre).marca) - Number(!!separarMarcaFoto(b.nombre).marca) || cantFotos(b) - cantFotos(a))
        const sinMarca = ordenados.find((p) => !separarMarcaFoto(p.nombre).marca)
        const conMarca = ordenados.filter((p) => separarMarcaFoto(p.nombre).marca)
        // Si ya hay un "Banquito" con tantas fotos como cargas sueltas, lo más
        // probable es que sea la importación nueva: se queda ese y se borran los sueltos.
        const yaUnido = !!sinMarca && cantFotos(sinMarca) >= conMarca.length
        const defecto: Record<string, Accion> = Object.fromEntries(ordenados.map((p) => [p.id, yaUnido && p !== sinMarca ? 'borrar' : 'unir']))
        return { clave, base: separarMarcaFoto(sinMarca?.nombre || ordenados[0].nombre).base, tienda: ordenados[0].vendedor || '', prods: ordenados, defecto }
      })
  }, [productos])

  if (!grupos.length) return null
  const accionDe = (g: (typeof grupos)[number], id: string) => acciones[id] || g.defecto[id]

  async function unir(g: (typeof grupos)[number]) {
    setError('')
    const ids = g.prods.filter((p) => accionDe(g, p.id) === 'unir').map((p) => p.id)
    const borrar = g.prods.filter((p) => accionDe(g, p.id) === 'borrar').map((p) => p.id)
    if (!ids.length) { setError('Dejá al menos un producto en “Sumar fotos” (es el que queda).'); return }
    if (ids.length + borrar.length < 2) { setError('No hay nada para unir: elegí al menos dos.'); return }
    const nombre = (nombres[g.clave] ?? g.base).trim()
    if (!confirm(`Queda un solo producto “${nombre}”${borrar.length ? ` y se borran ${borrar.length}` : ''}. ¿Seguimos?`)) return
    setUniendo(g.clave)
    const d = await fetch('/api/admin/productos/unir', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ ids, borrar, nombre }) })
      .then((r) => r.json())
      .catch(() => ({ error: 'No se pudieron unir.' }))
    setUniendo(null)
    if (d.error) { setError(d.error); return }
    onUnidos(`✓ “${nombre}” quedó como un solo producto con ${d.fotos} foto${d.fotos === 1 ? '' : 's'}${d.sobraron ? ` (${d.sobraron} no entraron: máximo 5)` : ''}.`)
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-body text-xs font-semibold text-ink">🔗 {grupos.length} producto{grupos.length === 1 ? '' : 's'} cargado{grupos.length === 1 ? '' : 's'} varias veces con distinta foto (ej. {grupos[0].prods.slice(0, 3).map((p) => p.nombre).join(', ')})</span>
        <button type="button" onClick={() => setAbierto((v) => !v)} className="px-3 py-1.5 rounded-lg border border-amber-400 bg-white font-body text-xs font-semibold text-ink">{abierto ? 'Ocultar' : 'Revisar y unir'}</button>
      </div>
      {abierto && (
        <div className="grid gap-3 mt-3">
          {error && <div className="font-body text-xs text-maroon">{error}</div>}
          {grupos.map((g) => (
            <div key={g.clave} className="bg-white border border-amber-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-body text-[11px] text-inksoft">{g.tienda} · queda como:</span>
                <input value={nombres[g.clave] ?? g.base} onChange={(e) => setNombres((n) => ({ ...n, [g.clave]: e.target.value }))} className="px-2.5 py-1.5 rounded-md border border-line font-body text-sm font-semibold" aria-label="Nombre del producto unido" />
                <span className="flex-1" />
                <button type="button" onClick={() => unir(g)} disabled={uniendo === g.clave} className="px-3 py-1.5 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-50">
                  {uniendo === g.clave ? 'Uniendo...' : '🔗 Unir en uno'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.prods.map((p) => (
                  <div key={p.id} className={`flex items-center gap-2 border rounded-lg p-1.5 pr-2 ${accionDe(g, p.id) === 'borrar' ? 'border-maroon/40 opacity-70' : accionDe(g, p.id) === 'aparte' ? 'border-line opacity-50' : 'border-teal'}`}>
                    <div className="w-11 h-11 rounded bg-panelalt overflow-hidden shrink-0">{(p.thumbUrl || p.imagenUrl) && <img src={p.thumbUrl || p.imagenUrl} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="font-body text-[11px]">
                      <div className="text-ink font-semibold">{p.nombre}</div>
                      <div className="text-inksoft">{cantFotos(p)} foto{cantFotos(p) === 1 ? '' : 's'}</div>
                    </div>
                    <select value={accionDe(g, p.id)} onChange={(e) => setAcciones((a) => ({ ...a, [p.id]: e.target.value as Accion }))} className="px-1.5 py-1 rounded border border-line font-body text-[11px]" aria-label={`Qué hacer con ${p.nombre}`}>
                      <option value="unir">Sumar fotos</option>
                      <option value="borrar">Borrar (fotos repetidas)</option>
                      <option value="aparte">Dejar aparte</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="font-body text-[11px] text-inksoft">Queda el primero que diga “Sumar fotos” (con sus datos, preguntas y reseñas); los demás se borran. Máximo 5 fotos por producto.</div>
        </div>
      )}
    </div>
  )
}
