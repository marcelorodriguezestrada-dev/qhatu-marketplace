'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { labelPublico, normalizar, relevancia } from '@/lib/busqueda'

// Buscador de la portada con sugerencias como Mercado Libre: al escribir
// "zapatos" abajo aparecen tus búsquedas recientes (🕘) y opciones
// armadas con lo que HAY publicado (🔍 "Zapatos mujer", "Zapatos
// hombre", el rubro, nombres de productos) — nunca sugiere algo que no
// devuelve resultados.

const CLAVE = 'clasiclick_busquedas'
type Sug = { texto: string; tipo: 'reciente' | 'sugerencia' }

function leerRecientes(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch { return [] }
}
export function guardarReciente(q: string) {
  const t = q.trim()
  if (t.length < 2) return
  try {
    const lista = [t, ...leerRecientes().filter((x) => normalizar(x) !== normalizar(t))].slice(0, 8)
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {}
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function BuscadorProductos({
  valor,
  onCambiar,
  onBuscar,
  productos,
  rubroDe,
}: {
  valor: string
  onCambiar: (v: string) => void
  onBuscar: (q: string) => void
  productos: { nombre: string; vendedor: string; publico?: string; rubro?: string; etiquetasBusqueda?: string[] }[]
  rubroDe: (id?: string) => { label: string; categoriaLabel: string } | undefined
}) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)
  const [recientes, setRecientes] = useState<string[]>([])
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const indexados = useMemo(() => productos.map((p) => ({ p, rubro: rubroDe(p.rubro) })), [productos, rubroDe])

  const sugerencias = useMemo<Sug[]>(() => {
    const q = normalizar(valor)
    const vistos = new Set<string>()
    const out: Sug[] = []
    const agregar = (texto: string, tipo: Sug['tipo']) => {
      const k = normalizar(texto)
      if (!k || vistos.has(k) || out.length >= 8) return
      vistos.add(k)
      out.push({ texto, tipo })
    }
    for (const r of recientes) if (!q || normalizar(r).includes(q)) { if (out.filter((s) => s.tipo === 'reciente').length < 3) agregar(r, 'reciente') }
    if (q.length < 2) return out

    const conRelevancia = indexados.map((x) => ({ ...x, r: relevancia(x.p, x.rubro, q) })).filter((x) => x.r)
    // Nombres sugeridos: solo los exactos (no sugerir "Sandalia" al escribir "zap").
    const encontrados = conRelevancia
    const exactos = conRelevancia.filter((x) => x.r === 'exacto')
    if (encontrados.length) {
      agregar(capital(valor.trim()), 'sugerencia')
      // "Zapatos mujer / hombre / niños": solo los públicos que tienen resultados.
      const yaTienePublico = /\b(mujer|hombre|nin[oa]s?|dama|caballero)\b/.test(q)
      if (!yaTienePublico) {
        const conteo: Record<string, number> = {}
        for (const x of encontrados) if (x.p.publico && x.p.publico !== 'unisex') conteo[x.p.publico] = (conteo[x.p.publico] || 0) + 1
        for (const pub of Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])) agregar(`${capital(valor.trim())} ${labelPublico(pub).toLowerCase()}`, 'sugerencia')
      }
    }
    // Rubros y nombres de productos que empiezan o contienen lo escrito.
    for (const x of indexados) if (x.rubro && normalizar(x.rubro.label).includes(q)) agregar(x.rubro.label, 'sugerencia')
    for (const x of exactos) agregar(x.p.nombre, 'sugerencia')
    return out
  }, [valor, recientes, indexados])

  function elegir(texto: string) {
    onCambiar(texto)
    guardarReciente(texto)
    setAbierto(false)
    setActivo(-1)
    onBuscar(texto)
  }

  function borrarReciente(texto: string) {
    const lista = leerRecientes().filter((x) => x !== texto)
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)) } catch {}
    setRecientes(lista)
  }

  // Resalta en negrita lo que falta después de lo escrito (como ML).
  function conResaltado(texto: string) {
    const n = normalizar(texto)
    const q = normalizar(valor)
    if (q && n.startsWith(q)) return <><span>{texto.slice(0, valor.trim().length)}</span><strong className="font-semibold">{texto.slice(valor.trim().length)}</strong></>
    return <strong className="font-semibold">{texto}</strong>
  }

  const mostrar = abierto && sugerencias.length > 0

  return (
    <div ref={caja} className="relative flex-1 min-w-0">
      <input
        value={valor}
        onChange={(e) => { onCambiar(e.target.value); setAbierto(true); setActivo(-1) }}
        onFocus={() => { setRecientes(leerRecientes()); setAbierto(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && mostrar) { e.preventDefault(); setActivo((i) => Math.min(i + 1, sugerencias.length - 1)) }
          else if (e.key === 'ArrowUp' && mostrar) { e.preventDefault(); setActivo((i) => Math.max(i - 1, -1)) }
          else if (e.key === 'Escape') setAbierto(false)
          else if (e.key === 'Enter') {
            e.preventDefault()
            elegir(mostrar && activo >= 0 ? sugerencias[activo].texto : valor)
          }
        }}
        placeholder="Buscar productos, marcas y más…"
        role="combobox"
        aria-expanded={mostrar}
        aria-autocomplete="list"
        className="w-full px-3.5 py-2 rounded-lg border-none bg-white/10 text-white font-body text-sm outline-none placeholder:text-white/50"
      />
      {mostrar && (
        <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-lg shadow-lg border border-line py-1 overflow-hidden">
          {sugerencias.map((s, i) => (
            <li key={s.tipo + s.texto} role="option" aria-selected={i === activo}>
              <div className={`flex items-center gap-3 px-3.5 py-2 cursor-pointer ${i === activo ? 'bg-panelalt' : 'hover:bg-panelalt'}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(s.texto)} className="flex items-center gap-3 flex-1 min-w-0 text-left bg-transparent border-none p-0">
                  <span className="text-inksoft text-sm w-4 text-center shrink-0" aria-hidden="true">{s.tipo === 'reciente' ? '🕘' : '🔍'}</span>
                  <span className="font-body text-sm text-ink truncate">{conResaltado(s.texto)}</span>
                </button>
                {s.tipo === 'reciente' && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => borrarReciente(s.texto)} className="text-inksoft text-xs bg-transparent border-none px-1" aria-label={`Borrar ${s.texto} del historial`}>✕</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
