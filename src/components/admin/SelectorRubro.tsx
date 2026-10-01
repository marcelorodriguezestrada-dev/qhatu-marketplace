'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Elegir un rubro entre los ~3.200 del árbol (Categoría › Subcategoría ›
// Rubro) escribiendo: un <select> con todos por fila de la planilla
// sería pesadísimo. Muestra el rubro actual; al tocarlo se abre un
// buscador con los primeros resultados.

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MAX = 60

export default function SelectorRubro({
  categorias,
  value,
  onChange,
  className = '',
  vacio = 'Elegí el rubro…',
}: {
  categorias: CategoriaProducto[]
  value: string
  onChange: (id: string) => void
  className?: string
  vacio?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  const todos = useMemo(
    () => categorias.flatMap((c) => c.rubros.map((r) => ({ ...r, categoria: c.label, ruta: [c.label, r.grupo, r.label].filter(Boolean).join(' › ') }))),
    [categorias]
  )
  const actual = todos.find((r) => r.id === value)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const resultados = useMemo(() => {
    const palabras = normalizar(q).split(' ').filter(Boolean)
    if (!palabras.length) return todos.slice(0, MAX)
    // Primero los que coinciden en el nombre del rubro, después por la ruta.
    const enRuta = todos.filter((r) => palabras.every((w) => normalizar(r.ruta).includes(w)))
    return [...enRuta.filter((r) => palabras.every((w) => normalizar(r.label).includes(w))), ...enRuta.filter((r) => !palabras.every((w) => normalizar(r.label).includes(w)))].slice(0, MAX)
  }, [q, todos])

  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => { setAbierto((v) => !v); setQ('') }} className={`text-left truncate ${className}`} title={actual?.ruta}>
        {actual ? (
          <>
            {actual.grupo && <span className="text-inksoft">{actual.grupo} › </span>}
            {actual.label}
          </>
        ) : (
          <span className="text-inksoft">{vacio}</span>
        )}
      </button>
      {abierto && (
        <div className="absolute z-30 left-0 top-full mt-1 w-80 bg-white border border-line rounded-lg shadow-lg">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rubro (ej: sandalias, celulares)" className="w-full px-3 py-2 border-b border-line font-body text-xs outline-none rounded-t-lg" />
          <div className="max-h-64 overflow-y-auto">
            {resultados.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange(r.id); setAbierto(false) }}
                className={`block w-full text-left px-3 py-1.5 font-body text-xs hover:bg-panelalt ${r.id === value ? 'bg-tealsoft' : ''}`}
              >
                <span className="text-ink">{r.label}</span>
                <span className="block text-[10px] text-inksoft truncate">{[r.categoria, r.grupo].filter(Boolean).join(' › ')}</span>
              </button>
            ))}
            {resultados.length === 0 && <div className="px-3 py-3 font-body text-xs text-inksoft">No hay rubros con ese nombre.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
