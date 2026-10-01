'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '@/components/ProductCard'
import { expandirTalles, type Producto } from '@/data/productos'
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'
import { normalizar } from '@/lib/busqueda'
import { nombreRubro } from '@/lib/arbolCategorias'

// Resultados de una búsqueda, como el listado de Mercado Libre:
// - Compu: a la izquierda el título ("Zapatos mujer", N resultados),
//   los filtros aplicados con ✕ y los filtros (Ofertas, Género,
//   Categoría, Talle, Precio); arriba "Búsquedas relacionadas" y la
//   ruta de la categoría (Ropa y Accesorios › Blusas).
// - Celular: una barra con "Filtros (n)" y atajos; los filtros se abren
//   en un panel desde abajo con "Limpiar filtros" / "Ver resultados".
// Todos los filtros salen de lo que hay en los resultados (con cantidad):
// nunca se ofrece un filtro que deja la lista vacía.

type Rubro = { label: string; categoriaId: string; categoriaLabel: string; grupoId?: string; grupo?: string }
type Filtros = { publico: string | null; rubro: string | null; talle: string | null; precio: string | null; ofertas: boolean }
const SIN_FILTROS: Filtros = { publico: null, rubro: null, talle: null, precio: null, ofertas: false }

type Rango = { id: string; label: string; min: number; max: number }

function redondear(n: number) {
  if (n < 50) return Math.ceil(n / 5) * 5
  if (n < 500) return Math.ceil(n / 10) * 10
  return Math.ceil(n / 50) * 50
}

// Tres rangos de precio con los tercios de los resultados (como ML).
function rangosDePrecio(precios: number[]): Rango[] {
  const ord = [...precios].sort((a, b) => a - b)
  if (ord.length < 3 || ord[0] === ord[ord.length - 1]) return []
  const a = redondear(ord[Math.floor(ord.length / 3)])
  const b = redondear(ord[Math.floor((ord.length * 2) / 3)])
  if (a >= b) return [
    { id: `0-${a}`, label: `Hasta Bs ${a}`, min: 0, max: a },
    { id: `${a}-`, label: `Más de Bs ${a}`, min: a + 0.01, max: Infinity },
  ]
  return [
    { id: `0-${a}`, label: `Hasta Bs ${a}`, min: 0, max: a },
    { id: `${a}-${b}`, label: `Bs ${a} a Bs ${b}`, min: a + 0.01, max: b },
    { id: `${b}-`, label: `Más de Bs ${b}`, min: b + 0.01, max: Infinity },
  ]
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function ListadoResultados({
  consulta,
  resultados,
  relacionados,
  rubroDe,
  ciudadId,
  onBuscar,
  onLimpiarBusqueda,
}: {
  consulta: string
  resultados: Producto[]
  // Ids que entraron por sinónimo / palabras de la IA (no por el texto exacto).
  relacionados?: Set<string>
  rubroDe: (id?: string) => Rubro | undefined
  ciudadId: string
  onBuscar: (q: string) => void
  onLimpiarBusqueda: () => void
}) {
  const [f, setF] = useState<Filtros>(SIN_FILTROS)
  const [panel, setPanel] = useState(false)
  const [pestana, setPestana] = useState<'ofertas' | 'genero' | 'categoria' | 'talle' | 'precio'>('genero')
  const [orden, setOrden] = useState<'relevantes' | 'menor' | 'mayor'>('relevantes')

  // Nueva búsqueda → filtros limpios.
  useEffect(() => { setF(SIN_FILTROS) }, [consulta])

  // Para "Volver al listado" desde la página del producto.
  useEffect(() => {
    try { sessionStorage.setItem('clasiclick_listado', window.location.pathname + window.location.search) } catch {}
  }, [consulta])

  const rangos = useMemo(() => rangosDePrecio(resultados.map((p) => p.precio)), [resultados])
  const tieneOferta = (p: Producto) => !!p.precioOriginal && p.precioOriginal > p.precio

  const pasa = (p: Producto, sin?: keyof Filtros) => {
    if (sin !== 'publico' && f.publico && (p.publico || 'unisex') !== f.publico) return false
    if (sin !== 'rubro' && f.rubro && p.rubro !== f.rubro) return false
    if (sin !== 'talle' && f.talle && !expandirTalles(p.talles || []).includes(f.talle)) return false
    if (sin !== 'ofertas' && f.ofertas && !tieneOferta(p)) return false
    if (sin !== 'precio' && f.precio) {
      const r = rangos.find((x) => x.id === f.precio)
      if (r && (p.precio < r.min || p.precio > r.max)) return false
    }
    return true
  }

  const filtrados = useMemo(() => {
    const lista = resultados.filter((p) => pasa(p))
    if (orden === 'menor') lista.sort((a, b) => a.precio - b.precio)
    if (orden === 'mayor') lista.sort((a, b) => b.precio - a.precio)
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultados, f, orden, rangos])
  const exactos = relacionados ? filtrados.filter((p) => !relacionados.has(String(p.id))) : filtrados
  const parecidos = relacionados ? filtrados.filter((p) => relacionados.has(String(p.id))) : []

  // Opciones de cada filtro, contadas sin ese mismo filtro (como ML).
  const contar = (sin: keyof Filtros, clave: (p: Producto) => string[]) => {
    const c: Record<string, number> = {}
    for (const p of resultados) if (pasa(p, sin)) for (const k of clave(p)) c[k] = (c[k] || 0) + 1
    return c
  }
  const cPublico = contar('publico', (p) => [p.publico || 'unisex'])
  const cRubro = contar('rubro', (p) => (p.rubro ? [p.rubro] : []))
  const cTalle = contar('talle', (p) => expandirTalles(p.talles || []))
  const cPrecio = contar('precio', (p) => rangos.filter((r) => p.precio >= r.min && p.precio <= r.max).map((r) => r.id))
  const cOfertas = resultados.filter((p) => pasa(p, 'ofertas') && tieneOferta(p)).length

  const opcionesPublico = PUBLICOS_PRODUCTO.filter((x) => cPublico[x.id]).map((x) => ({ id: x.id, label: x.label, n: cPublico[x.id] }))
  const opcionesRubro = Object.entries(cRubro).map(([id, n]) => ({ id, label: nombreRubro(rubroDe(id)) || id, n })).sort((a, b) => b.n - a.n)
  const opcionesTalle = Object.entries(cTalle).map(([id, n]) => ({ id, label: id, n })).sort((a, b) => (parseFloat(a.id) || 999) - (parseFloat(b.id) || 999) || a.id.localeCompare(b.id))
  const opcionesPrecio = rangos.filter((r) => cPrecio[r.id]).map((r) => ({ id: r.id, label: r.label, n: cPrecio[r.id] }))

  // Ruta de categoría: la del rubro elegido, o la que tiene la mayoría de los resultados.
  const ruta = useMemo(() => {
    const id = f.rubro || (() => {
      const c: Record<string, number> = {}
      for (const p of filtrados) if (p.rubro) c[p.rubro] = (c[p.rubro] || 0) + 1
      const [top] = Object.entries(c).sort((a, b) => b[1] - a[1])
      return top && top[1] / Math.max(1, filtrados.length) >= 0.5 ? top[0] : null
    })()
    const r = id ? rubroDe(id) : undefined
    if (r) return { categoriaId: r.categoriaId, categoria: r.categoriaLabel, grupoId: r.grupoId || null, grupo: r.grupo || null, rubroId: id!, rubro: r.label }
    // Si no hay un rubro dominante, probamos con la subcategoría (ej: Calzado).
    const grupos: Record<string, { n: number; r: Rubro }> = {}
    for (const p of filtrados) { const x = rubroDe(p.rubro); if (x?.grupoId) grupos[x.grupoId] = { n: (grupos[x.grupoId]?.n || 0) + 1, r: x } }
    const [topGrupo] = Object.entries(grupos).sort((a, b) => b[1].n - a[1].n)
    if (topGrupo && topGrupo[1].n / Math.max(1, filtrados.length) >= 0.5) {
      const x = topGrupo[1].r
      return { categoriaId: x.categoriaId, categoria: x.categoriaLabel, grupoId: topGrupo[0], grupo: x.grupo || null, rubroId: null, rubro: null }
    }
    const cats: Record<string, { n: number; label: string }> = {}
    for (const p of filtrados) { const x = rubroDe(p.rubro); if (x) cats[x.categoriaId] = { n: (cats[x.categoriaId]?.n || 0) + 1, label: x.categoriaLabel } }
    const [topCat] = Object.entries(cats).sort((a, b) => b[1].n - a[1].n)
    return topCat && topCat[1].n / Math.max(1, filtrados.length) >= 0.5 ? { categoriaId: topCat[0], categoria: topCat[1].label, grupoId: null, grupo: null, rubroId: null, rubro: null } : null
  }, [filtrados, f.rubro, rubroDe])

  // Búsquedas relacionadas: la consulta + género, y rubros de los resultados.
  const relacionadas = useMemo(() => {
    const q = consulta.trim()
    const out: string[] = []
    const yaTiene = /\b(mujer|hombre|nin[oa]s?)\b/.test(normalizar(q))
    if (!yaTiene) for (const x of PUBLICOS_PRODUCTO) if (x.id !== 'unisex' && resultados.some((p) => p.publico === x.id)) out.push(`${q} ${x.label.toLowerCase()}`)
    for (const o of opcionesRubro.filter((o) => !/otros/i.test(o.label)).slice(0, 5)) out.push(o.label.toLowerCase())
    return Array.from(new Set(out.map((x) => x.toLowerCase()))).filter((x) => x !== normalizar(q)).slice(0, 7)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, resultados])

  const aplicados: { k: keyof Filtros; label: string }[] = [
    ...(f.ofertas ? [{ k: 'ofertas' as const, label: 'Ofertas' }] : []),
    ...(f.publico ? [{ k: 'publico' as const, label: PUBLICOS_PRODUCTO.find((x) => x.id === f.publico)?.label || '' }] : []),
    ...(f.rubro ? [{ k: 'rubro' as const, label: nombreRubro(rubroDe(f.rubro)) || f.rubro }] : []),
    ...(f.talle ? [{ k: 'talle' as const, label: `Talle ${f.talle}` }] : []),
    ...(f.precio ? [{ k: 'precio' as const, label: rangos.find((r) => r.id === f.precio)?.label || '' }] : []),
  ]
  const quitar = (k: keyof Filtros) => setF((x) => ({ ...x, [k]: k === 'ofertas' ? false : null }))
  const alternar = (k: Exclude<keyof Filtros, 'ofertas'>, v: string) => setF((x) => ({ ...x, [k]: x[k] === v ? null : v }))

  const Opciones = ({ k, opciones, chips }: { k: Exclude<keyof Filtros, 'ofertas'>; opciones: { id: string; label: string; n: number }[]; chips?: boolean }) =>
    chips ? (
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button key={o.id} type="button" onClick={() => alternar(k, o.id)} className={`min-w-[44px] px-3 py-1.5 rounded-full border font-body text-sm ${f[k] === o.id ? 'border-teal bg-tealsoft text-teal font-semibold' : 'border-line bg-panel text-ink'}`}>
            {o.label}
          </button>
        ))}
      </div>
    ) : (
      <div className="grid gap-1.5">
        {opciones.map((o) => (
          <button key={o.id} type="button" onClick={() => alternar(k, o.id)} className={`text-left font-body text-sm bg-transparent border-none p-0 ${f[k] === o.id ? 'text-teal font-semibold' : 'text-ink hover:text-teal'}`}>
            {o.label} <span className="text-inksoft font-normal">({o.n})</span>
          </button>
        ))}
      </div>
    )

  const Ofertas = (
    <label className="flex items-center justify-between gap-3 bg-panel border border-line rounded-lg px-3 py-2.5 cursor-pointer">
      <span className="font-body text-sm text-ink">🔥 Solo ofertas <span className="text-inksoft">({cOfertas})</span></span>
      <input type="checkbox" checked={f.ofertas} onChange={(e) => setF((x) => ({ ...x, ofertas: e.target.checked }))} className="accent-teal w-4 h-4" />
    </label>
  )

  const secciones = [
    { id: 'ofertas' as const, label: 'Ofertas', hay: cOfertas > 0, activo: f.ofertas, cuerpo: Ofertas },
    { id: 'genero' as const, label: 'Género', hay: opcionesPublico.length > 0, activo: !!f.publico, cuerpo: <Opciones k="publico" opciones={opcionesPublico} /> },
    { id: 'categoria' as const, label: 'Categoría', hay: opcionesRubro.length > 0, activo: !!f.rubro, cuerpo: <Opciones k="rubro" opciones={opcionesRubro} /> },
    { id: 'talle' as const, label: 'Talle', hay: opcionesTalle.length > 0, activo: !!f.talle, cuerpo: <Opciones k="talle" opciones={opcionesTalle} chips /> },
    { id: 'precio' as const, label: 'Precio', hay: opcionesPrecio.length > 1 || !!f.precio, activo: !!f.precio, cuerpo: <Opciones k="precio" opciones={opcionesPrecio} /> },
  ].filter((s) => s.hay)
  const pestanaActual = secciones.find((s) => s.id === pestana) || secciones[0]

  const Ruta = ruta && (
    <div className="font-body text-[13px] text-inksoft flex flex-wrap items-center gap-1.5">
      <a href={`/?categoria=${ruta.categoriaId}`} className="hover:text-teal">{ruta.categoria}</a>
      {ruta.grupo && (<><span>›</span><a href={`/?grupo=${ruta.grupoId}`} className="hover:text-teal">{ruta.grupo}</a></>)}
      {ruta.rubro && ruta.rubroId !== ruta.grupoId && (<><span>›</span><a href={`/?rubro=${ruta.rubroId}`} className="hover:text-teal">{ruta.rubro}</a></>)}
    </div>
  )

  return (
    <div>
      {/* Compu: búsquedas relacionadas */}
      {relacionadas.length > 0 && (
        <div className="hidden md:block font-body text-[13px] text-inksoft mb-3">
          <span className="font-semibold text-ink">Búsquedas relacionadas: </span>
          {relacionadas.map((r, i) => (
            <span key={r}>
              {i > 0 && ' - '}
              <button type="button" onClick={() => onBuscar(r)} className="bg-transparent border-none p-0 text-inksoft hover:text-teal">{r}</button>
            </span>
          ))}
        </div>
      )}

      {/* Celular: barra de filtros */}
      <div className="md:hidden -mx-4 px-4 mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => { setPestana(secciones[0]?.id || 'genero'); setPanel(true) }} className={`shrink-0 px-3.5 py-1.5 rounded-full border font-body text-sm font-semibold ${aplicados.length ? 'border-teal bg-tealsoft text-teal' : 'border-line bg-panel text-ink'}`}>
          ⚙️ Filtros{aplicados.length ? ` (${aplicados.length})` : ''}
        </button>
        {secciones.filter((s) => s.id !== 'ofertas').map((s) => (
          <button key={s.id} type="button" onClick={() => { setPestana(s.id); setPanel(true) }} className={`shrink-0 px-3.5 py-1.5 rounded-full border font-body text-sm ${s.activo ? 'border-teal bg-tealsoft text-teal' : 'border-line bg-panel text-ink'}`}>
            {s.label} ▾
          </button>
        ))}
        {cOfertas > 0 && (
          <button type="button" onClick={() => setF((x) => ({ ...x, ofertas: !x.ofertas }))} className={`shrink-0 px-3.5 py-1.5 rounded-full border font-body text-sm ${f.ofertas ? 'border-teal bg-tealsoft text-teal' : 'border-line bg-panel text-ink'}`}>
            🔥 Ofertas
          </button>
        )}
      </div>
      <div className="md:hidden flex items-baseline justify-between gap-2 mb-3">
        <div className="font-body text-xs text-inksoft">{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'} para “{consulta}”</div>
        <button type="button" onClick={onLimpiarBusqueda} className="font-body text-xs text-teal bg-transparent border-none p-0 shrink-0">✕ Borrar búsqueda</button>
      </div>

      <div className="md:grid md:grid-cols-[230px_1fr] md:gap-6">
        {/* Compu: columna de filtros */}
        <aside className="hidden md:block">
          <h1 className="font-display text-xl font-bold text-ink leading-tight">{capital(consulta.trim())}</h1>
          <div className="font-body text-xs text-inksoft mb-3">{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</div>
          {aplicados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {aplicados.map((a) => (
                <button key={a.k} type="button" onClick={() => quitar(a.k)} className="px-2 py-1 rounded bg-panel border border-line font-body text-xs text-ink">{a.label} ✕</button>
              ))}
            </div>
          )}
          <button type="button" onClick={onLimpiarBusqueda} className="font-body text-xs text-teal bg-transparent border-none p-0 mb-4">✕ Borrar búsqueda</button>
          <div className="grid gap-5">
            {secciones.map((s) =>
              s.id === 'ofertas' ? <div key={s.id}>{s.cuerpo}</div> : (
                <div key={s.id}>
                  <div className="font-body text-sm font-semibold text-ink mb-2">{s.label}</div>
                  {s.cuerpo}
                </div>
              )
            )}
          </div>
        </aside>

        <div>
          <div className="hidden md:flex items-center justify-between gap-3 mb-3">
            {Ruta || <span />}
            <label className="font-body text-[13px] text-ink flex items-center gap-1.5">
              Ordenar por
              <select value={orden} onChange={(e) => setOrden(e.target.value as any)} className="bg-transparent border-none font-semibold text-ink text-[13px]">
                <option value="relevantes">Más relevantes</option>
                <option value="menor">Menor precio</option>
                <option value="mayor">Mayor precio</option>
              </select>
            </label>
          </div>
          <div id="grilla-productos" className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 scroll-mt-4">
            {exactos.map((p) => <ProductCard key={p.id} p={p} ciudadComprador={ciudadId as any} />)}
          </div>
          {parecidos.length > 0 && (
            <>
              <div className={`font-display text-base font-bold text-ink mb-3 ${exactos.length ? 'mt-8 pt-5 border-t border-line' : ''}`}>
                {exactos.length ? 'También te puede interesar' : `No hay productos que digan “${consulta}”, pero estos se parecen`}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {parecidos.map((p) => <ProductCard key={p.id} p={p} ciudadComprador={ciudadId as any} />)}
              </div>
            </>
          )}
          {filtrados.length === 0 && (
            <div className="text-center py-14 text-inksoft font-body text-sm">
              No encontramos productos para “{consulta}”{aplicados.length ? ' con esos filtros' : ''}.
              {aplicados.length > 0 && <> <button type="button" onClick={() => setF(SIN_FILTROS)} className="text-teal underline bg-transparent border-none p-0">Limpiar filtros</button></>}
            </div>
          )}
        </div>
      </div>

      {/* Celular: panel de filtros (como la app de ML) */}
      {panel && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={() => setPanel(false)}>
          <div className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="font-body text-base font-semibold text-ink">Filtros</div>
              <button type="button" onClick={() => setPanel(false)} className="text-xl text-inksoft bg-transparent border-none" aria-label="Cerrar">✕</button>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="w-[38%] bg-panelalt overflow-y-auto">
                {secciones.map((s) => (
                  <button key={s.id} type="button" onClick={() => setPestana(s.id)} className={`w-full text-left px-4 py-4 font-body text-sm border-none border-b border-line flex items-center justify-between ${pestanaActual?.id === s.id ? 'bg-white text-teal font-semibold border-l-4 border-l-teal' : 'bg-transparent text-ink'}`}>
                    {s.label}
                    {s.activo && <span className="text-teal">✓</span>}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {pestanaActual && (
                  <>
                    <div className="font-body text-base font-semibold text-ink mb-3">{pestanaActual.label}</div>
                    {pestanaActual.id === 'talle' || pestanaActual.id === 'ofertas' ? pestanaActual.cuerpo : (
                      <Opciones k={pestanaActual.id === 'genero' ? 'publico' : pestanaActual.id === 'categoria' ? 'rubro' : 'precio'} opciones={pestanaActual.id === 'genero' ? opcionesPublico : pestanaActual.id === 'categoria' ? opcionesRubro : opcionesPrecio} chips />
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-line">
              <button type="button" onClick={() => setF(SIN_FILTROS)} className="flex-1 py-3 font-body text-sm font-semibold text-teal bg-transparent border-none">Limpiar filtros</button>
              <button type="button" onClick={() => setPanel(false)} className="flex-1 py-3 rounded-lg bg-teal text-white font-body text-sm font-semibold border-none">Ver {filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
