'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Celda para elegir talles o colores de una tabla (se tildan) y, si el que
// buscás no está, escribirlo en "Otro…". Se usa en ⚡ Edición rápida.
// El panel va en un portal con position: fixed para que la planilla (con
// scroll) no lo corte.

export const GRUPOS_TALLES: { titulo: string; opciones: string[] }[] = [
  { titulo: 'Ropa', opciones: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { titulo: 'Calzado', opciones: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'] },
  { titulo: 'Niños', opciones: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  { titulo: 'Otros', opciones: ['Único', 'Estándar'] },
]

export const COLORES_TABLA: { nombre: string; css: string }[] = [
  { nombre: 'Negro', css: '#111' }, { nombre: 'Blanco', css: '#fff' }, { nombre: 'Gris', css: '#9ca3af' },
  { nombre: 'Rojo', css: '#dc2626' }, { nombre: 'Bordo', css: '#7f1d1d' }, { nombre: 'Rosa', css: '#f9a8d4' },
  { nombre: 'Fucsia', css: '#d946ef' }, { nombre: 'Coral', css: '#fb7185' }, { nombre: 'Naranja', css: '#f97316' },
  { nombre: 'Amarillo', css: '#facc15' }, { nombre: 'Mostaza', css: '#ca8a04' }, { nombre: 'Verde', css: '#16a34a' },
  { nombre: 'Turquesa', css: '#14b8a6' }, { nombre: 'Celeste', css: '#7dd3fc' }, { nombre: 'Azul', css: '#1d4ed8' },
  { nombre: 'Violeta', css: '#7c3aed' }, { nombre: 'Lila', css: '#c4b5fd' }, { nombre: 'Marrón', css: '#78350f' },
  { nombre: 'Camel', css: '#c19a6b' }, { nombre: 'Beige', css: '#e7d8b8' }, { nombre: 'Crema', css: '#fdf6e3' },
  { nombre: 'Nude', css: '#e3bc9a' }, { nombre: 'Dorado', css: '#d4af37' }, { nombre: 'Plateado', css: '#c0c0c0' },
  { nombre: 'Multicolor', css: 'conic-gradient(#dc2626,#facc15,#16a34a,#1d4ed8,#7c3aed,#dc2626)' },
]

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const colorCss = (nombre: string) => COLORES_TABLA.find((c) => norm(c.nombre) === norm(nombre))?.css

export default function SelectorLista({
  tipo,
  value,
  onChange,
  extras = [],
  placeholder,
  className = '',
}: {
  tipo: 'talles' | 'colores'
  value: string[]
  onChange: (v: string[]) => void
  // Valores que ya usan otros productos (aparecen como "Usados en la tienda").
  extras?: string[]
  placeholder?: string
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [otro, setOtro] = useState('')
  const botonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !botonRef.current?.contains(t)) setAbierto(false)
    }
    // Si la página o la planilla se mueven, el panel sigue a la celda.
    const alScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) ubicar() }
    document.addEventListener('mousedown', cerrar)
    window.addEventListener('scroll', alScroll, true)
    window.addEventListener('resize', ubicar)
    return () => { document.removeEventListener('mousedown', cerrar); window.removeEventListener('scroll', alScroll, true); window.removeEventListener('resize', ubicar) }
  }, [abierto])

  function ubicar() {
    const r = botonRef.current?.getBoundingClientRect()
    if (!r) return
    const ancho = 320
    const alto = 380
    // Abajo de la celda; si no entra, arriba.
    const top = r.bottom + 4 + alto > window.innerHeight && r.top - alto - 4 > 0 ? r.top - alto - 4 : r.bottom + 4
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) })
  }

  function abrir() {
    ubicar()
    setAbierto((a) => !a)
  }

  const tiene = (x: string) => value.some((v) => norm(v) === norm(x))
  const alternar = (x: string) => onChange(tiene(x) ? value.filter((v) => norm(v) !== norm(x)) : [...value, x])
  function agregarOtro() {
    const nuevos = otro.split(',').map((x) => x.trim()).filter(Boolean).filter((x) => !tiene(x))
    if (nuevos.length) onChange([...value, ...nuevos])
    setOtro('')
  }

  const base = tipo === 'talles' ? GRUPOS_TALLES.flatMap((g) => g.opciones) : COLORES_TABLA.map((c) => c.nombre)
  // Usados en otros productos o escritos a mano que no están en la tabla.
  const sueltos = Array.from(new Set([...extras, ...value].map((x) => x.trim()).filter(Boolean)))
    .filter((x) => !base.some((b) => norm(b) === norm(x)))
    .filter((x, i, arr) => arr.findIndex((y) => norm(y) === norm(x)) === i)
    .slice(0, 40)

  const chip = (x: string, conMuestra = false) => (
    <button
      key={x}
      type="button"
      onClick={() => alternar(x)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-body text-[11px] ${tiene(x) ? 'bg-teal text-white border-teal' : 'bg-panel text-ink border-line hover:border-teal'}`}
    >
      {conMuestra && <span className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ background: colorCss(x) || '#eee' }} />}
      {x}
    </button>
  )

  return (
    <>
      <button ref={botonRef} type="button" onClick={abrir} className={`${className} text-left min-h-[26px] flex flex-wrap gap-1 items-center`} aria-label={tipo === 'talles' ? 'Elegir talles' : 'Elegir colores'}>
        {value.length ? (
          value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-panelalt border border-line text-[11px] text-ink">
              {tipo === 'colores' && <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: colorCss(v) || '#eee' }} />}
              {v}
            </span>
          ))
        ) : (
          <span className="text-inksoft text-[11px]">{placeholder || 'Elegir…'}</span>
        )}
      </button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: pos.left }} className="fixed z-50 w-[320px] max-h-[370px] overflow-y-auto bg-panel border border-line rounded-xl shadow-xl p-3">
          {tipo === 'talles' ? (
            GRUPOS_TALLES.map((g) => (
              <div key={g.titulo} className="mb-2.5">
                <div className="font-body text-[10px] font-semibold uppercase tracking-wide text-inksoft mb-1">{g.titulo}</div>
                <div className="flex flex-wrap gap-1">{g.opciones.map((x) => chip(x))}</div>
              </div>
            ))
          ) : (
            <div className="flex flex-wrap gap-1 mb-2.5">{COLORES_TABLA.map((c) => chip(c.nombre, true))}</div>
          )}
          {sueltos.length > 0 && (
            <div className="mb-2.5">
              <div className="font-body text-[10px] font-semibold uppercase tracking-wide text-inksoft mb-1">Usados en otros productos</div>
              <div className="flex flex-wrap gap-1">{sueltos.map((x) => chip(x, tipo === 'colores'))}</div>
            </div>
          )}
          <div className="flex gap-1.5 pt-2 border-t border-line">
            <input
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarOtro() } }}
              placeholder={tipo === 'talles' ? 'Otro talle (ej. 38.5, 90x190)' : 'Otro color (ej. Verde oliva)'}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-line bg-panel font-body text-xs"
              aria-label="Escribir otro"
            />
            <button type="button" onClick={agregarOtro} disabled={!otro.trim()} className="px-2.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-40">Agregar</button>
          </div>
          <div className="flex justify-between items-center mt-2">
            {value.length > 0 ? <button type="button" onClick={() => onChange([])} className="font-body text-[11px] text-inksoft underline bg-transparent border-none">Quitar todos</button> : <span />}
            <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1 rounded-md border border-line bg-panel font-body text-xs text-ink">Listo</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
