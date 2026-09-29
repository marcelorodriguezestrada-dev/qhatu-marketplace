'use client'

import { useEffect, useRef, useState } from 'react'
import { useCiudad } from '@/lib/ciudad'
import { CIUDADES, buscarCiudad, esCiudadId, type CiudadId, type FiltroCiudadValor } from '@/data/ciudades'

// "📍 Potosí ▾" (como el "Enviar a…" de Mercado Libre): cambia la ciudad
// del comprador. No aparece mientras haya una sola ciudad abierta.
export function SelectorCiudad({ variante = 'oscura' }: { variante?: 'oscura' | 'clara' }) {
  const { ciudad, abiertas, multiciudad, elegir } = useCiudad()
  const [abierto, setAbierto] = useState(false)
  // Posición fija (la fila del menú se desplaza de costado y recortaría
  // un desplegable normal).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    const alScroll = () => setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    window.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', cerrar)
      window.removeEventListener('scroll', alScroll)
    }
  }, [abierto])

  if (!multiciudad) return null
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 200) })
          setAbierto((v) => !v)
        }}
        className={`font-body text-[13px] whitespace-nowrap ${variante === 'oscura' ? 'text-white' : 'text-ink'}`}
        aria-label="Cambiar ciudad"
      >
        📍 {ciudad.nombre} ▾
      </button>
      {abierto && pos && (
        <div style={{ top: pos.top, left: pos.left }} className="fixed z-50 w-48 bg-panel border border-line rounded-lg shadow-xl py-1">
          <div className="px-3 py-1.5 font-body text-[11px] text-inksoft">¿En qué ciudad estás?</div>
          {abiertas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { elegir(c.id); setAbierto(false) }}
              className={`w-full text-left px-3 py-2 font-body text-sm ${c.id === ciudad.id ? 'text-teal font-semibold bg-tealsoft' : 'text-ink hover:bg-panelalt'}`}
            >
              {c.id === ciudad.id ? '✓ ' : ''}{c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Cartel "📍 ¿Dónde estás?" la primera vez (solo con 2+ ciudades
// abiertas y si todavía no eligió). La ciudad sugerida por IP va primero
// y resaltada, pero siempre la confirma la persona.
export function BannerCiudad() {
  const { abiertas, elegida, sugerida, multiciudad, elegir } = useCiudad()
  if (!multiciudad || elegida) return null
  const orden = [...abiertas].sort((a, b) => Number(b.id === sugerida) - Number(a.id === sugerida))
  const nombreSugerida = abiertas.find((c) => c.id === sugerida)?.nombre
  return (
    <div className="bg-panel border-2 border-teal rounded-xl p-4 mb-5">
      <div className="font-display text-base font-bold text-ink mb-0.5">📍 ¿Dónde estás?</div>
      <div className="font-body text-[13px] text-inksoft mb-3">
        {nombreSugerida ? `Parece que estás en ${nombreSugerida}. ` : ''}Elegí tu ciudad para ver los productos y servicios de tu zona. Lo podés cambiar cuando quieras arriba.
      </div>
      <div className="flex flex-wrap gap-2">
        {orden.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => elegir(c.id)}
            className={`px-5 py-2 rounded-lg font-body text-sm font-semibold ${c.id === sugerida ? 'border-none bg-teal text-white' : 'border border-line bg-panel text-ink'}`}
          >
            {c.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}

// Campo "Ciudad" de formularios (tienda, profesional, anuncio). Muestra
// las ciudades abiertas; `todas` las muestra todas (lo usa el admin para
// preparar tiendas de una ciudad antes de abrirla). Con una sola ciudad
// abierta no se muestra (queda la que tenga, Potosí por defecto).
export function CampoCiudad({
  value,
  onChange,
  todas = false,
  className = '',
  etiqueta = '📍 Ciudad',
}: {
  value: CiudadId
  onChange: (c: CiudadId) => void
  todas?: boolean
  className?: string
  etiqueta?: string
}) {
  const { abiertas, multiciudad } = useCiudad()
  if (!todas && !multiciudad) return null
  const opciones = todas ? CIUDADES.map((c) => ({ id: c.id, nombre: c.nombre })) : abiertas
  const lista = opciones.some((c) => c.id === value) ? opciones : [...opciones, { id: value, nombre: buscarCiudad(value).nombre }]
  return (
    <label className={`block font-body text-xs text-ink ${className}`}>
      <span className="block font-semibold mb-1">{etiqueta}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as CiudadId)} className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel">
        {lista.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
    </label>
  )
}

// Chips "📍 Buscar en: Potosí · La Paz · Todas" para listados (servicios,
// anuncios). Es un filtro de ESA búsqueda: no cambia la ciudad del
// comprador. Arranca en ?ciudad= del link o en la ciudad del comprador.
export function useFiltroCiudad() {
  const { ciudadId, multiciudad } = useCiudad()
  const [manual, setManual] = useState<FiltroCiudadValor | null>(null)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('ciudad')
    if (v === 'todas' || esCiudadId(v)) setManual(v as FiltroCiudadValor)
  }, [])
  const valor: FiltroCiudadValor = manual || ciudadId
  function cambiar(v: FiltroCiudadValor) {
    setManual(v)
    const url = new URL(window.location.href)
    url.searchParams.set('ciudad', v)
    window.history.replaceState(null, '', url.toString())
  }
  return { valor, cambiar, multiciudad }
}

export function ChipsCiudad({ valor, onChange, className = '' }: { valor: FiltroCiudadValor; onChange: (v: FiltroCiudadValor) => void; className?: string }) {
  const { abiertas, multiciudad } = useCiudad()
  if (!multiciudad) return null
  const opciones: { id: FiltroCiudadValor; nombre: string }[] = [...abiertas.map((c) => ({ id: c.id as FiltroCiudadValor, nombre: c.nombre })), { id: 'todas', nombre: 'Todas' }]
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-body text-xs text-inksoft">📍 Buscar en:</span>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3.5 py-1 rounded-full border font-body text-[13px] ${valor === o.id ? 'border-teal bg-tealsoft text-teal font-semibold' : 'border-line bg-panel text-inksoft'}`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  )
}
