'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CategoriaProducto } from '@/lib/useCategoriasProductos'

// Menú "Categorías ▾" del catálogo, estilo Mercado Libre: en
// computadora, lista oscura de categorías y al pasar el mouse se ven sus
// rubros al costado; en el celular, lista a pantalla completa donde
// cada categoría se despliega. Al final, "Ver todas las categorías"
// (/categorias).

export default function MenuCategorias({
  categorias,
  abierto,
  onCerrar,
  onElegir,
  conteo,
}: {
  categorias: CategoriaProducto[]
  abierto: boolean
  onCerrar: () => void
  onElegir: (categoriaId: string, rubroId: string | null) => void
  conteo?: Record<string, number>
}) {
  const [activa, setActiva] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])

  if (!abierto) return null
  const cat = categorias.find((c) => c.id === activa) || null
  const n = (id: string) => (conteo?.[id] ? ` (${conteo[id]})` : '')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onCerrar} aria-hidden />

      {/* Computadora */}
      <div className="hidden md:flex absolute left-0 top-full mt-1 z-50 shadow-2xl rounded-lg overflow-hidden" onMouseLeave={() => setActiva(null)}>
        <div className="w-64 bg-[#333] py-2 max-h-[70vh] overflow-y-auto">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setActiva(c.id)}
              onClick={() => onElegir(c.id, null)}
              className={`w-full flex items-center justify-between px-5 py-2 font-body text-[13px] text-left ${activa === c.id ? 'bg-teal text-white' : 'text-white/90'}`}
            >
              <span className="truncate">{c.label}{n(c.id)}</span>
              <span className="text-white/60">›</span>
            </button>
          ))}
          <Link href="/categorias" onClick={onCerrar} className="block px-5 py-2.5 mt-1 border-t border-white/10 font-body text-[13px] text-white font-semibold">
            Ver todas las categorías
          </Link>
        </div>
        {cat && (
          <div className="w-[420px] bg-panel p-5 max-h-[70vh] overflow-y-auto">
            <button type="button" onClick={() => onElegir(cat.id, null)} className="font-display text-base font-bold text-ink mb-3 hover:text-teal text-left">
              {cat.label}
            </button>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
              {cat.rubros.map((r) => (
                <button key={r.id} type="button" onClick={() => onElegir(cat.id, r.id)} className="font-body text-[13px] text-inksoft hover:text-teal text-left">
                  {r.label}{n(r.id)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Celular */}
      <div className="md:hidden fixed inset-x-0 top-0 bottom-0 z-50 bg-panel overflow-y-auto">
        <div className="sticky top-0 bg-ink text-white flex items-center justify-between px-4 py-3.5">
          <span className="font-display text-base font-bold">Categorías</span>
          <button type="button" onClick={onCerrar} className="text-white text-xl px-2" aria-label="Cerrar">✕</button>
        </div>
        {categorias.map((c) => (
          <div key={c.id} className="border-b border-line">
            <button type="button" onClick={() => setActiva(activa === c.id ? null : c.id)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <span className="font-body text-[15px] text-ink">{c.label}{n(c.id)}</span>
              <span className="text-inksoft">{activa === c.id ? '▾' : '›'}</span>
            </button>
            {activa === c.id && (
              <div className="bg-panelalt px-4 pb-3">
                <button type="button" onClick={() => onElegir(c.id, null)} className="block w-full text-left py-2 font-body text-sm text-teal font-semibold">
                  Ver todo en {c.label}
                </button>
                {c.rubros.map((r) => (
                  <button key={r.id} type="button" onClick={() => onElegir(c.id, r.id)} className="block w-full text-left py-2 font-body text-sm text-ink border-t border-line/60">
                    {r.label}{n(r.id)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <Link href="/categorias" onClick={onCerrar} className="block px-4 py-4 font-body text-sm text-teal font-semibold">
          Ver todas las categorías ›
        </Link>
      </div>
    </>
  )
}
