'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizar } from '@/lib/busqueda'
import { coincideServicio, type ProfesionalBuscable } from '@/lib/busquedaServicios'
import type { RubroFlat } from '@/lib/useCategorias'

// Buscador de /servicios con sugerencias mientras escribís (como el de
// productos): búsquedas recientes (🕘), especialidades que tienen
// profesionales (🔍 "Abogado/a · Legal y finanzas (3)") y perfiles por
// nombre (👤). Nunca sugiere algo que no devuelve resultados.

const CLAVE = 'clasiclick_busquedas_servicios'
type Sug = { tipo: 'reciente' | 'rubro' | 'texto' | 'perfil'; texto: string; detalle?: string; id?: string }

const leerRecientes = (): string[] => { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch { return [] } }
function guardarReciente(q: string) {
  const t = q.trim()
  if (t.length < 2) return
  try { localStorage.setItem(CLAVE, JSON.stringify([t, ...leerRecientes().filter((x) => normalizar(x) !== normalizar(t))].slice(0, 8))) } catch {}
}

export default function BuscadorServicios({
  valor,
  onCambiar,
  onBuscar,
  onElegirRubro,
  profesionales,
  rubrosFlat,
  placeholder,
}: {
  valor: string
  onCambiar: (v: string) => void
  onBuscar: (q: string) => void
  onElegirRubro: (rubro: RubroFlat) => void
  // Ya filtrados por la ciudad elegida.
  profesionales: (ProfesionalBuscable & { id: string })[]
  rubrosFlat: RubroFlat[]
  placeholder: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)
  const [recientes, setRecientes] = useState<string[]>([])
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const porRubro = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of profesionales) if (p.rubro) m[p.rubro] = (m[p.rubro] || 0) + 1
    return m
  }, [profesionales])
  const infoRubro = useMemo(() => new Map(rubrosFlat.map((r) => [r.id, r])), [rubrosFlat])

  const sugerencias = useMemo<Sug[]>(() => {
    const q = normalizar(valor)
    const out: Sug[] = []
    const vistos = new Set<string>()
    const agregar = (s: Sug) => {
      const k = `${s.tipo === 'reciente' ? 'texto' : s.tipo}:${s.id || normalizar(s.texto)}`
      if (vistos.has(k) || out.length >= 9) return
      vistos.add(k)
      out.push(s)
    }
    for (const r of recientes) if ((!q || normalizar(r).includes(q)) && out.length < 3) agregar({ tipo: 'reciente', texto: r })
    if (q.length < 2) return out
    const parcial = !/\s$/.test(valor)

    // Especialidades con profesionales que coinciden con lo escrito.
    const rubros = rubrosFlat
      .filter((r) => porRubro[r.id] && coincideServicio({}, { label: r.label, grupoLabel: r.grupoLabel, categoriaLabel: r.categoriaLabel }, valor, { parcial }))
      .sort((a, b) => porRubro[b.id] - porRubro[a.id])
      .slice(0, 4)
    for (const r of rubros) agregar({ tipo: 'rubro', texto: r.label, detalle: `${r.grupoLabel || r.categoriaLabel} · ${porRubro[r.id]}`, id: r.id })

    // Lo escrito tal cual, si trae resultados (ej. "ecografía doppler").
    const coinciden = profesionales.filter((p) => {
      const r = p.rubro ? infoRubro.get(p.rubro) : undefined
      return coincideServicio(p, r ? { label: r.label, grupoLabel: r.grupoLabel, categoriaLabel: r.categoriaLabel } : undefined, valor, { parcial })
    })
    const yaContados = rubros.reduce((n, r) => n + porRubro[r.id], 0)
    if (coinciden.length > yaContados) agregar({ tipo: 'texto', texto: valor.trim(), detalle: `${coinciden.length} resultado${coinciden.length === 1 ? '' : 's'}` })

    // Perfiles por nombre.
    const palabrasQ = q.split(' ').filter(Boolean)
    const porNombre = profesionales.filter((p) => {
      const nombre = normalizar(p.nombre || '').split(' ')
      return palabrasQ.every((w) => nombre.some((n) => n.startsWith(w)))
    })
    for (const p of porNombre.slice(0, 3)) {
      agregar({ tipo: 'perfil', texto: p.nombre || '', detalle: (p.rubro && infoRubro.get(p.rubro)?.label) || p.especialidad || '', id: p.id })
    }
    return out
  }, [valor, recientes, rubrosFlat, porRubro, profesionales, infoRubro])

  function elegir(s: Sug) {
    setAbierto(false)
    setActivo(-1)
    if (s.tipo === 'rubro') {
      const r = infoRubro.get(s.id!)
      if (r) { guardarReciente(r.label); onCambiar(''); onElegirRubro(r) }
      return
    }
    if (s.tipo === 'perfil') { router.push(`/servicios/${s.id}`); return }
    onCambiar(s.texto)
    guardarReciente(s.texto)
    onBuscar(s.texto)
  }

  function borrarReciente(texto: string) {
    const lista = leerRecientes().filter((x) => x !== texto)
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)) } catch {}
    setRecientes(lista)
  }

  const mostrar = abierto && sugerencias.length > 0
  const icono = (t: Sug['tipo']) => (t === 'reciente' ? '🕘' : t === 'perfil' ? '👤' : '🔍')

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
            if (mostrar && activo >= 0) elegir(sugerencias[activo])
            else { guardarReciente(valor); setAbierto(false); onBuscar(valor) }
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={mostrar}
        aria-autocomplete="list"
        className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
      />
      {mostrar && (
        <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-lg shadow-lg border border-line py-1 overflow-hidden">
          {sugerencias.map((s, i) => (
            <li key={`${s.tipo}-${s.id || s.texto}`} role="option" aria-selected={i === activo}>
              <div className={`flex items-center gap-3 px-3.5 py-2 cursor-pointer ${i === activo ? 'bg-panelalt' : 'hover:bg-panelalt'}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(s)} className="flex items-center gap-3 flex-1 min-w-0 text-left bg-transparent border-none p-0">
                  <span className="text-inksoft text-sm w-4 text-center shrink-0" aria-hidden="true">{icono(s.tipo)}</span>
                  <span className="font-body text-sm text-ink truncate"><strong className="font-semibold">{s.texto}</strong>{s.detalle && <span className="text-inksoft text-xs"> · {s.detalle}</span>}</span>
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
