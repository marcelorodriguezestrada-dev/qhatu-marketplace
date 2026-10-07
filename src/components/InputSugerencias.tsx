'use client'

import { useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

// Campo con sugerencias de lo que la persona ya escribió antes (como el
// autocompletar del navegador, pero con nuestros datos): aparecen recién
// cuando empieza a escribir y se elige con un toque.
export type Sugerencia<T = unknown> = { texto: string; detalle?: string; dato?: T }

export default function InputSugerencias<T>({
  value,
  onChange,
  opciones,
  onElegir,
  icono = '🕘',
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (v: string) => void
  // Ya filtradas para lo escrito.
  opciones: Sugerencia<T>[]
  onElegir?: (s: Sugerencia<T>) => void
  icono?: ReactNode
}) {
  const [foco, setFoco] = useState(false)
  const [activo, setActivo] = useState(-1)
  const mostrar = foco && opciones.length > 0
  const elegir = (s: Sugerencia<T>) => {
    if (onElegir) onElegir(s)
    else onChange(s.texto)
    setActivo(-1)
    setFoco(false)
  }
  return (
    <div className="relative">
      <input
        {...resto}
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setFoco(true); setActivo(-1) }}
        onFocus={(e) => { setFoco(true); resto.onFocus?.(e) }}
        onBlur={(e) => { setTimeout(() => setFoco(false), 120); resto.onBlur?.(e) }}
        onKeyDown={(e) => {
          if (mostrar && e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(i + 1, opciones.length - 1)) }
          else if (mostrar && e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, -1)) }
          else if (mostrar && e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(opciones[activo]) }
          else if (e.key === 'Escape') setFoco(false)
          resto.onKeyDown?.(e)
        }}
      />
      {mostrar && (
        <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-lg shadow-lg border border-line py-1 overflow-hidden">
          {opciones.map((s, i) => (
            <li key={s.texto + i} role="option" aria-selected={i === activo}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(s)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left border-none ${i === activo ? 'bg-panelalt' : 'bg-transparent hover:bg-panelalt'}`}
              >
                <span className="text-inksoft text-xs mt-0.5" aria-hidden>{icono}</span>
                <span className="min-w-0">
                  <span className="block font-body text-sm text-ink truncate">{s.texto}</span>
                  {s.detalle && <span className="block font-body text-[11px] text-inksoft truncate">{s.detalle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
