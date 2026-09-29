'use client'

import { useEffect, useRef, useState } from 'react'
import { useCiudad } from '@/lib/ciudad'

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
