'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'
import { useCiudad } from '@/lib/ciudad'
import { productoEnCiudad } from '@/data/ciudades'
import { gruposDe } from '@/lib/arbolCategorias'

// "Categorías para comprar y vender" (estilo Mercado Libre): todas las
// categorías con sus subcategorías en columnas, y en cada una sus
// rubros. Cada link abre el catálogo filtrado (/?categoria=…, /?grupo=…
// o /?rubro=…). Los que tienen productos muestran cuántos hay.

export default function CategoriasPage() {
  const { categorias, cargando } = useCategoriasProductos()
  const [productos, setProductos] = useState<any[]>([])
  const { ciudadId } = useCiudad()
  // Cantidades de la ciudad del comprador (igual que el catálogo).
  const conteo: Record<string, number> = {}
  for (const p of productos) if (p.rubro && productoEnCiudad(p, ciudadId)) conteo[p.rubro] = (conteo[p.rubro] || 0) + 1
  const [filtro, setFiltro] = useState('')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((d) => setProductos(d.productos || []))
      .catch(() => {})
  }, [])

  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(filtro.trim())
  const visibles = categorias
    .map((c) => ({ ...c, rubros: q && !norm(c.label).includes(q) ? c.rubros.filter((r) => norm(r.label).includes(q) || norm(r.grupo || '').includes(q)) : c.rubros }))
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
              <div className="columns-1 min-[420px]:columns-2 md:columns-4 gap-x-6">
                {gruposDe(c).map((g) => {
                  const total = g.rubros.reduce((s, r) => s + (conteo[r.id] || 0), 0)
                  const todos = !!q || abiertos.has(g.id) || g.rubros.length <= 6
                  return (
                    <div key={g.id} className="break-inside-avoid mb-4">
                      <Link href={`/?grupo=${g.id}`} className="block font-body text-sm font-semibold text-ink hover:text-teal mb-1">
                        {g.label}
                        {total > 0 && <span className="text-teal"> ({total})</span>}
                      </Link>
                      {(todos ? g.rubros : g.rubros.slice(0, 5)).map((r) => (
                        <Link key={r.id} href={`/?rubro=${r.id}`} className="block font-body text-[13px] text-inksoft hover:text-teal hover:underline py-0.5">
                          {r.label}
                          {conteo[r.id] ? <span className="text-teal font-semibold"> ({conteo[r.id]})</span> : null}
                        </Link>
                      ))}
                      {!todos && (
                        <button type="button" onClick={() => setAbiertos((x) => new Set(x).add(g.id))} className="font-body text-[13px] text-teal bg-transparent border-none p-0 py-0.5">
                          Ver {g.rubros.length - 5} más
                        </button>
                      )}
                    </div>
                  )
                })}
                {c.rubros.filter((r) => !r.grupoId).length > 0 && (
                  <div className="break-inside-avoid mb-4">
                    {gruposDe(c).length > 0 && <div className="font-body text-sm font-semibold text-ink mb-1">Más en {c.label}</div>}
                    {c.rubros.filter((r) => !r.grupoId).map((r) => (
                      <Link key={r.id} href={`/?rubro=${r.id}`} className="block font-body text-[13px] text-inksoft hover:text-teal hover:underline py-0.5">
                        {r.label}
                        {conteo[r.id] ? <span className="text-teal font-semibold"> ({conteo[r.id]})</span> : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
          {!cargando && visibles.length === 0 && <div className="py-10 font-body text-sm text-inksoft">No encontramos esa categoría.</div>}
        </div>
      </div>
    </div>
  )
}
