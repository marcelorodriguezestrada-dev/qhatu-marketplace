'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'

// "Categorías para comprar y vender" (estilo Mercado Libre): todas las
// categorías con sus rubros en columnas. Cada link abre el catálogo
// filtrado (/?categoria=… o /?rubro=…). Los que tienen productos
// muestran cuántos hay.

export default function CategoriasPage() {
  const { categorias, cargando } = useCategoriasProductos()
  const [conteo, setConteo] = useState<Record<string, number>>({})
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((d) => {
        const c: Record<string, number> = {}
        for (const p of d.productos || []) if (p.rubro) c[p.rubro] = (c[p.rubro] || 0) + 1
        setConteo(c)
      })
      .catch(() => {})
  }, [])

  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(filtro.trim())
  const visibles = categorias
    .map((c) => ({ ...c, rubros: q && !norm(c.label).includes(q) ? c.rubros.filter((r) => norm(r.label).includes(q)) : c.rubros }))
    .filter((c) => !q || norm(c.label).includes(q) || c.rubros.length > 0)
  const totalCat = (c: { rubros: { id: string }[] }) => c.rubros.reduce((s, r) => s + (conteo[r.id] || 0), 0)

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-4 sm:px-5 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3">
          <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
          <div className="flex-1" />
          <Link href="/vender" className="bg-white/10 text-white px-3 py-1.5 rounded-lg font-body text-[13px]">Vender</Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <h1 className="font-display text-2xl font-bold text-ink">Categorías para comprar y vender</h1>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="🔍 Buscar categoría (ej: celulares)"
            className="w-full sm:w-72 px-3.5 py-2 rounded-lg border border-line bg-panel font-body text-sm"
          />
        </div>

        {cargando && <div className="font-body text-sm text-inksoft">Cargando...</div>}

        <div className="bg-panel border border-line rounded-xl px-5 sm:px-8">
          {visibles.map((c, i) => (
            <section key={c.id} className={`py-6 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Link href={`/?categoria=${c.id}`} className="inline-block font-display text-lg font-bold text-ink hover:text-teal mb-3">
                {c.label}
                {totalCat(c) > 0 && <span className="font-body text-sm font-normal text-inksoft"> ({totalCat(c)})</span>}
              </Link>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                {c.rubros.map((r) => (
                  <Link key={r.id} href={`/?rubro=${r.id}`} className="font-body text-sm text-inksoft hover:text-teal hover:underline">
                    {r.label}
                    {conteo[r.id] ? <span className="text-teal font-semibold"> ({conteo[r.id]})</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {!cargando && visibles.length === 0 && <div className="py-10 font-body text-sm text-inksoft">No encontramos esa categoría.</div>}
        </div>
      </div>
    </div>
  )
}
