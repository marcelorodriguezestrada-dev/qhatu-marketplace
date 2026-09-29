'use client'

import { useEffect, useRef, useState } from 'react'

// Navegación por secciones estilo Mercado Libre (la usa el panel /admin):
// en computadora, menú lateral fijo con la sección a la derecha; en el
// celular, primero la lista de opciones y al tocar una se abre con
// "‹ Volver". La sección va en el hash (#pedidos, #usuarios...) así el
// botón atrás del celular vuelve al menú.

export type ItemSeccion<T extends string> = { id: T; icono: string; label: string; ayuda?: string; grupo?: string }

export function useSeccionHash<T extends string>(ids: readonly T[]) {
  const [seccion, setSeccion] = useState<T | null>(null)
  const empujada = useRef(false)

  const leer = () => {
    const h = window.location.hash.replace('#', '')
    return (ids as readonly string[]).includes(h) ? (h as T) : null
  }

  useEffect(() => {
    setSeccion(leer())
    const alCambiar = () => setSeccion(leer())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function irA(s: T) {
    if (leer() === s) return
    empujada.current = true
    window.location.hash = s
    window.scrollTo({ top: 0 })
  }

  function volver() {
    if (empujada.current && window.history.length > 1) {
      empujada.current = false
      window.history.back()
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setSeccion(null)
    }
    window.scrollTo({ top: 0 })
  }

  return { seccion, irA, volver }
}

type Badges = Record<string, number | string | undefined>

function Badge({ v }: { v?: number | string }) {
  if (!v) return null
  return <span className="ml-auto whitespace-nowrap bg-maroon text-white font-body text-[11px] font-bold min-w-[20px] h-5 px-1.5 rounded-full inline-flex items-center justify-center">{v}</span>
}

function porGrupo<T extends string>(items: ItemSeccion<T>[]) {
  const grupos: { grupo: string; items: ItemSeccion<T>[] }[] = []
  for (const it of items) {
    const g = it.grupo || ''
    const actual = grupos.find((x) => x.grupo === g)
    if (actual) actual.items.push(it)
    else grupos.push({ grupo: g, items: [it] })
  }
  return grupos
}

export function SidebarSecciones<T extends string>({ items, activa, irA, badges }: { items: ItemSeccion<T>[]; activa: T; irA: (s: T) => void; badges: Badges }) {
  return (
    <nav className="hidden md:block w-60 shrink-0">
      <div className="sticky top-4 bg-panel border border-line rounded-xl py-2 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {porGrupo(items).map((g) => (
          <div key={g.grupo} className="mb-1">
            {g.grupo && <div className="px-4 pt-2.5 pb-1 font-body text-[10px] font-bold uppercase tracking-wider text-inksoft">{g.grupo}</div>}
            {g.items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => irA(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 font-body text-sm text-left border-l-[3px] ${
                  activa === s.id ? 'border-maroon bg-maroon/5 text-ink font-semibold' : 'border-transparent text-inksoft hover:bg-panelalt'
                }`}
              >
                <span className="w-5 text-center">{s.icono}</span>
                <span className="truncate">{s.label}</span>
                <Badge v={badges[s.id]} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}

export function MenuCelularSecciones<T extends string>({
  items,
  visible,
  irA,
  badges,
  encabezado,
}: {
  items: ItemSeccion<T>[]
  visible: boolean
  irA: (s: T) => void
  badges: Badges
  encabezado?: React.ReactNode
}) {
  if (!visible) return null
  return (
    <div className="md:hidden -mx-5">
      {encabezado}
      {porGrupo(items).map((g) => (
        <div key={g.grupo}>
          {g.grupo && <div className="px-5 pt-4 pb-1.5 font-body text-xs font-semibold text-inksoft">{g.grupo}</div>}
          <div className="bg-panel">
            {g.items.map((s) => (
              <button key={s.id} type="button" onClick={() => irA(s.id)} className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-line text-left active:bg-panelalt">
                <span className="text-2xl w-8 text-center">{s.icono}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-base text-ink">{s.label}</span>
                  {s.ayuda && <span className="block font-body text-xs text-inksoft truncate">{s.ayuda}</span>}
                </span>
                <Badge v={badges[s.id]} />
                <span className="text-inksoft text-lg">›</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function VolverCelularSecciones<T extends string>({ items, seccion, volver }: { items: ItemSeccion<T>[]; seccion: T | null; volver: () => void }) {
  if (!seccion) return null
  const s = items.find((x) => x.id === seccion)
  return (
    <div className="md:hidden flex items-center gap-2 mb-4">
      <button type="button" onClick={volver} className="font-body text-sm text-teal font-semibold py-2 pr-3">‹ Volver</button>
      <span className="font-display text-base font-bold text-ink">{s?.icono} {s?.label}</span>
    </div>
  )
}
