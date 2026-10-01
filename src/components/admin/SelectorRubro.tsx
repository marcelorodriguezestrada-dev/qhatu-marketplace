'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Elegir un rubro entre los ~3.200 del árbol (Categoría › Subcategoría ›
// Rubro) escribiendo: un <select> con todos por fila de la planilla
// sería pesadísimo. Muestra el rubro actual; al tocarlo se abre un
// buscador que, sin escribir nada, propone lo relacionado:
//  1. los otros rubros de la misma subcategoría (Mocasines → Sandalias),
//  2. rubros que coinciden con el nombre del producto (`pista`),
//  3. el resto de la misma categoría.
// Escribiendo, busca en todo el árbol (primero en la misma categoría).

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MAX = 60
const RELLENO = new Set(['estilo', 'clasico', 'clasica', 'nuevo', 'nueva', 'color', 'colores', 'negro', 'negra', 'blanco', 'blanca', 'marron', 'cafe', 'rojo', 'roja', 'azul', 'verde', 'grande', 'pequeno', 'mediano', 'oferta', 'calidad', 'original', 'precio', 'unidad', 'unidades', 'modelo', 'diseno', 'moderno', 'moderna', 'elegante', 'tono', 'tonos', 'talla', 'talle', 'talles', 'cuero', 'sintetico', 'importado', 'nacional'])

export default function SelectorRubro({
  categorias,
  value,
  onChange,
  className = '',
  vacio = 'Elegí el rubro…',
  pista,
  cerca,
}: {
  categorias: CategoriaProducto[]
  value: string
  onChange: (id: string) => void
  className?: string
  vacio?: string
  // Nombre del producto, para sugerir rubros parecidos.
  pista?: string
  // Rubro de referencia cuando no hay valor (ej: el de los seleccionados).
  cerca?: string
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

  type Item = (typeof todos)[number]
  const referencia = actual || todos.find((r) => r.id === cerca)

  // Secciones cuando no se escribió nada: lo relacionado primero.
  const secciones = useMemo(() => {
    if (q.trim()) return []
    const out: { titulo: string; items: Item[] }[] = []
    const usados = new Set<string>()
    const agregar = (titulo: string, items: Item[]) => {
      const nuevos = items.filter((r) => !usados.has(r.id))
      nuevos.forEach((r) => usados.add(r.id))
      if (nuevos.length) out.push({ titulo, items: nuevos })
    }
    if (referencia) {
      const mismaCat = todos.filter((r) => r.categoria === referencia.categoria)
      if (referencia.grupoId) agregar(`En ${referencia.grupo}`, mismaCat.filter((r) => r.grupoId === referencia.grupoId))
      else agregar(`En ${referencia.categoria}`, mismaCat.filter((r) => !r.grupoId))
    }
    if (pista) {
      // Palabras del nombre que dicen qué es (no "tipo", "estilo", colores…).
      const raices = normalizar(pista)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5 && !RELLENO.has(w))
        .map((w) => (w.length > 6 ? w.slice(0, w.length - 2) : w.replace(/(es|s)$/, '')))
      const parecidos = todos
        .filter((r) => raices.some((w) => normalizar(r.label).split(/[^a-z0-9]+/).some((x) => x.length >= 4 && (x.startsWith(w) || w.startsWith(x)))))
        .sort((a, b) => Number(b.categoria === referencia?.categoria) - Number(a.categoria === referencia?.categoria))
      if (raices.length) agregar(`Parecidos a “${pista.slice(0, 30)}”`, parecidos.slice(0, 8))
    }
    if (referencia) agregar(`Más en ${referencia.categoria}`, todos.filter((r) => r.categoria === referencia.categoria))
    if (!out.length) agregar('Rubros', todos.slice(0, MAX))
    return out
  }, [q, todos, referencia, pista])

  const resultados = useMemo(() => {
    const palabras = normalizar(q).split(' ').filter(Boolean)
    if (!palabras.length) return []
    // Primero los que coinciden en el nombre del rubro (y de la misma categoría), después por la ruta.
    const enRuta = todos.filter((r) => palabras.every((w) => normalizar(r.ruta).includes(w)))
    const puntos = (r: Item) => (palabras.every((w) => normalizar(r.label).includes(w)) ? 2 : 0) + (referencia && r.categoria === referencia.categoria ? 1 : 0)
    return enRuta.sort((a, b) => puntos(b) - puntos(a)).slice(0, MAX)
  }, [q, todos, referencia])

  const Opcion = ({ r, conRuta = true }: { r: Item; conRuta?: boolean }) => (
    <button
      type="button"
      onClick={() => { onChange(r.id); setAbierto(false) }}
      className={`block w-full text-left px-3 py-1.5 font-body text-xs hover:bg-panelalt ${r.id === value ? 'bg-tealsoft font-semibold' : ''}`}
    >
      <span className="text-ink">{r.label}{r.id === value ? ' ✓' : ''}</span>
      {conRuta && <span className="block text-[10px] text-inksoft truncate">{[r.categoria, r.grupo].filter(Boolean).join(' › ')}</span>}
    </button>
  )

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
          <div className="max-h-72 overflow-y-auto">
            {q.trim() ? (
              <>
                {resultados.map((r) => <Opcion key={r.id} r={r} />)}
                {resultados.length === 0 && <div className="px-3 py-3 font-body text-xs text-inksoft">No hay rubros con ese nombre.</div>}
              </>
            ) : (
              secciones.map((sec) => (
                <div key={sec.titulo}>
                  <div className="sticky top-0 bg-panelalt px-3 py-1 font-body text-[10px] font-semibold text-inksoft uppercase tracking-wide">{sec.titulo}</div>
                  {sec.items.map((r) => <Opcion key={r.id} r={r} conRuta={!sec.titulo.startsWith('En ')} />)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
