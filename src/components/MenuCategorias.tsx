'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CategoriaProducto } from '@/lib/useCategoriasProductos'
import { gruposDe } from '@/lib/arbolCategorias'

// Menú "Categorías ▾" del catálogo, estilo Mercado Libre (3 niveles:
// Categoría › Subcategoría › Rubro):
// - Computadora: lista oscura de categorías; al pasar el mouse se ven al
//   costado sus subcategorías en columnas, cada una con sus rubros.
// - Celular: lista a pantalla completa; la categoría se despliega en sus
//   subcategorías, y cada subcategoría en sus rubros.
// Al final, "Ver todas las categorías" (/categorias).

const MAX_RUBROS = 6

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
  onElegir: (categoriaId: string, rubroId: string | null, grupoId?: string | null) => void
  // Cantidades por categoría, rubro y subcategoría (esta con prefijo "g:").
  conteo?: Record<string, number>
}) {
  const [activa, setActiva] = useState<string | null>(null)
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])

  if (!abierto) return null
  const cat = categorias.find((c) => c.id === activa) || null
  const n = (id: string) => (conteo?.[id] ? ` (${conteo[id]})` : '')
  const sueltos = (c: CategoriaProducto) => c.rubros.filter((r) => !r.grupoId)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onCerrar} aria-hidden />

      {/* Computadora */}
      <div className="hidden md:flex absolute left-0 top-full mt-1 z-50 shadow-2xl rounded-lg overflow-hidden" onMouseLeave={() => setActiva(null)}>
        <div className="w-64 bg-[#333] py-2 max-h-[75vh] overflow-y-auto">
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
          <div className="w-[640px] bg-panel p-5 max-h-[75vh] overflow-y-auto">
            <button type="button" onClick={() => onElegir(cat.id, null)} className="font-display text-base font-bold text-ink mb-4 hover:text-teal text-left">
              {cat.label}
            </button>
            <div className="columns-3 gap-6">
              {gruposDe(cat).map((g) => (
                <div key={g.id} className="break-inside-avoid mb-4">
                  <button type="button" onClick={() => onElegir(cat.id, null, g.id)} className="block font-body text-[13px] font-semibold text-ink hover:text-teal text-left mb-1">
                    {g.label}{n(`g:${g.id}`)}
                  </button>
                  {g.rubros.slice(0, MAX_RUBROS).map((r) => (
                    <button key={r.id} type="button" onClick={() => onElegir(cat.id, r.id)} className="block font-body text-[12px] text-inksoft hover:text-teal text-left py-0.5">
                      {r.label}{n(r.id)}
                    </button>
                  ))}
                  {g.rubros.length > MAX_RUBROS && (
                    <button type="button" onClick={() => onElegir(cat.id, null, g.id)} className="block font-body text-[12px] text-teal text-left py-0.5">Ver todo ›</button>
                  )}
                </div>
              ))}
              {sueltos(cat).length > 0 && (
                <div className="break-inside-avoid mb-4">
                  {gruposDe(cat).length > 0 && <div className="font-body text-[13px] font-semibold text-ink mb-1">Más en {cat.label}</div>}
                  {sueltos(cat).map((r) => (
                    <button key={r.id} type="button" onClick={() => onElegir(cat.id, r.id)} className="block font-body text-[12px] text-inksoft hover:text-teal text-left py-0.5">
                      {r.label}{n(r.id)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Celular */}
      <div className="md:hidden fixed inset-x-0 top-0 bottom-0 z-50 bg-panel overflow-y-auto">
        <div className="sticky top-0 bg-ink text-white flex items-center justify-between px-4 py-3.5 z-10">
          <span className="font-display text-base font-bold">Categorías</span>
          <button type="button" onClick={onCerrar} className="text-white text-xl px-2" aria-label="Cerrar">✕</button>
        </div>
        {categorias.map((c) => (
          <div key={c.id} className="border-b border-line">
            <button type="button" onClick={() => { setActiva(activa === c.id ? null : c.id); setGrupoAbierto(null) }} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <span className="font-body text-[15px] text-ink">{c.label}{n(c.id)}</span>
              <span className="text-inksoft">{activa === c.id ? '▾' : '›'}</span>
            </button>
            {activa === c.id && (
              <div className="bg-panelalt pb-2">
                <button type="button" onClick={() => onElegir(c.id, null)} className="block w-full text-left px-4 py-2.5 font-body text-sm text-teal font-semibold">
                  Ver todo en {c.label}
                </button>
                {gruposDe(c).map((g) => (
                  <div key={g.id} className="border-t border-line/60">
                    <button type="button" onClick={() => setGrupoAbierto(grupoAbierto === g.id ? null : g.id)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                      <span className="font-body text-sm text-ink">{g.label}{n(`g:${g.id}`)}</span>
                      <span className="text-inksoft text-sm">{grupoAbierto === g.id ? '▾' : '›'}</span>
                    </button>
                    {grupoAbierto === g.id && (
                      <div className="pl-7 pr-4 pb-2">
                        <button type="button" onClick={() => onElegir(c.id, null, g.id)} className="block w-full text-left py-2 font-body text-[13px] text-teal font-semibold">
                          Ver todo en {g.label}
                        </button>
                        {g.rubros.map((r) => (
                          <button key={r.id} type="button" onClick={() => onElegir(c.id, r.id)} className="block w-full text-left py-2 font-body text-[13px] text-ink border-t border-line/40">
                            {r.label}{n(r.id)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {sueltos(c).map((r) => (
                  <button key={r.id} type="button" onClick={() => onElegir(c.id, r.id)} className="block w-full text-left px-4 py-2.5 font-body text-sm text-ink border-t border-line/60">
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
