'use client'

import { useMemo, useState } from 'react'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'
import SelectorRubro from '@/components/admin/SelectorRubro'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Admin → Productos → "🏪 Productos por tienda": primero se elige la
// tienda y se ven solo sus productos (con su foto, precio, stock y
// estado). Cada uno se edita ahí mismo (✏️) y el estado se cambia con un
// toque. La edición rápida y la moderación de abajo también quedan
// filtradas por esa tienda (ver src/app/admin/page.tsx).

type Tienda = { id: string; nombreNegocio?: string; email?: string; ciudad?: string; logoUrl?: string }
type Producto = Record<string, any>

const ESTADOS = [
  { id: 'activo', label: '🟢 Publicado' },
  { id: 'pendiente', label: '🟡 Pendiente' },
  { id: 'oculto', label: '⚫ Oculto' },
  { id: 'rechazado', label: '🔴 Rechazado' },
]
const PUBLICOS = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'ninos', label: 'Niños' },
  { id: 'unisex', label: 'Unisex' },
]
const estadoDe = (p: Producto) => p.estado || 'activo'
const aLista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean)

export default function ProductosDeTienda({
  password,
  productos,
  tiendas,
  categorias,
  rubroLabel,
  tiendaId,
  onTienda,
  onCambio,
  onEntrarComo,
}: {
  password: string
  productos: Producto[]
  tiendas: Tienda[]
  categorias: CategoriaProducto[]
  rubroLabel: (id: string) => string | undefined
  tiendaId: string
  onTienda: (id: string) => void
  onCambio: () => void
  onEntrarComo: (id: string) => void
}) {
  const [buscarTienda, setBuscarTienda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  // Cantidad de productos por tienda (para ordenar y mostrar en la lista).
  const porTienda = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of productos) if (p.vendedorId) m.set(p.vendedorId, (m.get(p.vendedorId) || 0) + 1)
    return m
  }, [productos])
  const nombreTienda = (t: Tienda) => t.nombreNegocio || t.email || t.id
  const lista = useMemo(() => {
    const q = buscarTienda.trim().toLowerCase()
    return tiendas
      .filter((t) => porTienda.get(t.id) || t.nombreNegocio)
      .filter((t) => !q || `${t.nombreNegocio || ''} ${t.email || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (porTienda.get(b.id) || 0) - (porTienda.get(a.id) || 0) || nombreTienda(a).localeCompare(nombreTienda(b), 'es'))
  }, [tiendas, porTienda, buscarTienda])

  const tienda = tiendas.find((t) => t.id === tiendaId)
  const deTienda = useMemo(() => productos.filter((p) => p.vendedorId === tiendaId), [productos, tiendaId])
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return deTienda
      .filter((p) => !filtroEstado || estadoDe(p) === filtroEstado)
      .filter((p) => !q || `${p.nombre} ${rubroLabel(p.rubro) || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [deTienda, buscar, filtroEstado, rubroLabel])
  const cuenta = (e: string) => deTienda.filter((p) => estadoDe(p) === e).length
  const plata = (n: number, p: Producto) => formatoMoneda(Number(n || 0), paisDeCiudad(ciudadDe(p)))

  async function patch(id: string, cambios: Record<string, unknown>) {
    const r = await fetch(`/api/productos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify(cambios) })
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'No se pudo guardar.')
  }

  async function cambiarEstado(p: Producto, estado: string) {
    setOcupado(p.id)
    try {
      await patch(p.id, { estado })
      onCambio()
    } catch (e: any) {
      alert(e?.message || 'No se pudo cambiar el estado.')
    } finally {
      setOcupado(null)
    }
  }

  async function borrar(p: Producto) {
    if (!confirm(`¿Borrar “${p.nombre}” definitivamente?`)) return
    setOcupado(p.id)
    await fetch(`/api/productos/${p.id}`, { method: 'DELETE', headers: { 'x-admin-password': password } }).catch(() => null)
    setOcupado(null)
    onCambio()
  }

  return (
    <div className="bg-panel border border-teal/40 rounded-xl p-4 mb-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">🏪 Productos por tienda</div>
      <div className="font-body text-[11px] text-inksoft mb-3">Elegí una tienda para ver y editar solo sus productos. La edición rápida y la moderación de abajo también se filtran por esa tienda.</div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input value={buscarTienda} onChange={(e) => setBuscarTienda(e.target.value)} placeholder="🔍 Buscar tienda…" className="w-48 px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs" />
        <select value={tiendaId} onChange={(e) => { onTienda(e.target.value); setBuscar(''); setFiltroEstado('') }} aria-label="Tienda" className="flex-1 min-w-[220px] px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-sm text-ink">
          <option value="">— Todas las tiendas ({productos.length} productos) —</option>
          {lista.map((t) => (
            <option key={t.id} value={t.id}>{nombreTienda(t)} · {buscarCiudad(t.ciudad).nombre} ({porTienda.get(t.id) || 0})</option>
          ))}
        </select>
        {tiendaId && <button type="button" onClick={() => onTienda('')} className="font-body text-xs text-inksoft underline bg-transparent border-none">Ver todas</button>}
      </div>

      {tienda && (
        <>
          <div className="flex flex-wrap items-center gap-3 bg-panelalt rounded-lg p-3 mb-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-panel border border-line flex items-center justify-center shrink-0">
              {tienda.logoUrl ? <img src={tienda.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">🏪</span>}
            </div>
            <div className="flex-1 min-w-[160px]">
              <div className="font-body text-sm font-semibold text-ink">{nombreTienda(tienda)}</div>
              <div className="font-body text-[11px] text-inksoft">📍 {buscarCiudad(tienda.ciudad).nombre}{tienda.email ? ` · ${tienda.email}` : ''} · {deTienda.length} producto{deTienda.length === 1 ? '' : 's'}</div>
            </div>
            <a href={`/tienda/${tienda.id}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink no-underline">Ver tienda ↗</a>
            <button type="button" onClick={() => onEntrarComo(tienda.id)} className="px-3 py-1.5 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold">🛍️ Cargar productos como esta tienda</button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {[{ id: '', label: `Todos (${deTienda.length})` }, ...ESTADOS.map((e) => ({ id: e.id, label: `${e.label} (${cuenta(e.id)})` }))].map((e) => (
              <button key={e.id || 'todos'} type="button" onClick={() => setFiltroEstado(e.id)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${filtroEstado === e.id ? 'border-teal bg-tealsoft text-teal font-semibold' : 'border-line bg-panel text-inksoft'}`}>
                {e.label}
              </button>
            ))}
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar en esta tienda…" className="ml-auto w-52 px-2.5 py-1.5 rounded-lg border border-line bg-panel font-body text-xs" />
          </div>

          {visibles.length === 0 ? (
            <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg px-3 py-4 text-center">{deTienda.length ? 'Ningún producto con ese filtro.' : 'Esta tienda todavía no tiene productos.'}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[720px] overflow-y-auto p-0.5">
              {visibles.map((p) => (
                <div key={p.id} className={`rounded-xl border bg-panel p-2 flex flex-col ${estadoDe(p) === 'activo' ? 'border-line' : 'border-amber-300'} ${ocupado === p.id ? 'opacity-50' : ''}`}>
                  <button type="button" onClick={() => setEditando(p)} className="relative w-full aspect-square rounded-lg bg-panelalt overflow-hidden mb-1.5 border-none p-0" title="Editar">
                    {p.thumbUrl || p.imagenUrl ? <img src={p.thumbUrl || p.imagenUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="text-2xl">🛍️</span>}
                    {estadoDe(p) !== 'activo' && <span className="absolute top-1 left-1 bg-white/90 rounded px-1.5 py-0.5 font-body text-[10px]">{ESTADOS.find((e) => e.id === estadoDe(p))?.label}</span>}
                  </button>
                  <div className="font-body text-xs text-ink leading-snug line-clamp-2 min-h-[2.4em]">{p.nombre}</div>
                  <div className="font-body text-sm font-bold text-maroon">
                    {plata(p.precio, p)}
                    {Number(p.precioOriginal) > Number(p.precio) && <span className="ml-1 text-[10px] text-inksoft line-through font-normal">{plata(p.precioOriginal, p)}</span>}
                  </div>
                  <div className="font-body text-[10px] text-inksoft truncate">{rubroLabel(p.rubro) || '⚠️ Sin categoría'}{typeof p.stock === 'number' ? ` · stock ${p.stock}` : ''}</div>
                  <div className="flex gap-1 mt-1.5">
                    <button type="button" onClick={() => setEditando(p)} className="flex-1 px-2 py-1 rounded-md border-none bg-ink text-white font-body text-[11px] font-semibold">✏️ Editar</button>
                    <select value={estadoDe(p)} onChange={(e) => cambiarEstado(p, e.target.value)} disabled={ocupado === p.id} aria-label="Estado" className="w-[44px] px-0.5 py-1 rounded-md border border-line bg-panel font-body text-[11px]">
                      {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                    <button type="button" onClick={() => borrar(p)} disabled={ocupado === p.id} className="px-1.5 py-1 rounded-md border border-line bg-panel font-body text-[11px]" title="Borrar">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editando && (
        <EditarProducto
          key={editando.id}
          p={editando}
          password={password}
          categorias={categorias}
          plata={(n) => plata(n, editando)}
          onCerrar={() => setEditando(null)}
          onGuardar={async (cambios) => {
            await patch(editando.id, cambios)
            setEditando(null)
            onCambio()
          }}
        />
      )}
    </div>
  )
}

function EditarProducto({ p, password, categorias, plata, onCerrar, onGuardar }: { p: Producto; password: string; categorias: CategoriaProducto[]; plata: (n: number) => string; onCerrar: () => void; onGuardar: (c: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({
    nombre: p.nombre || '',
    precio: String(p.precio ?? ''),
    precioOriginal: p.precioOriginal ? String(p.precioOriginal) : '',
    stock: typeof p.stock === 'number' ? String(p.stock) : '',
    rubro: p.rubro || '',
    publico: p.publico || 'unisex',
    talles: Array.isArray(p.talles) ? p.talles.join(', ') : '',
    colores: Array.isArray(p.colores) ? p.colores.join(', ') : '',
    descripcionCorta: p.descripcionCorta || '',
    descripcionLarga: p.descripcionLarga || '',
    estado: p.estado || 'activo',
  })
  const [foto, setFoto] = useState<{ imagenUrl: string; thumbUrl: string }>({ imagenUrl: p.imagenUrl || '', thumbUrl: p.thumbUrl || p.imagenUrl || '' })
  const [extras, setExtras] = useState<string[]>(Array.isArray(p.fotosAdicionales) ? p.fotosAdicionales : [])
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function subir(file: File | undefined, principal: boolean) {
    if (!file) return
    setSubiendo(true)
    setError('')
    try {
      const r = await subirFotoAdmin(password, file, principal)
      if (principal) setFoto({ imagenUrl: r.url, thumbUrl: r.thumbUrl })
      else setExtras((x) => [...x, r.url].slice(0, 6))
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  async function guardar() {
    const precio = Number(f.precio)
    if (!f.nombre.trim()) return setError('Poné el nombre.')
    if (!(precio > 0)) return setError('Poné un precio válido.')
    const antes = Number(f.precioOriginal)
    setGuardando(true)
    setError('')
    try {
      await onGuardar({
        nombre: f.nombre.trim(),
        precio,
        precioOriginal: antes > precio ? antes : null,
        stock: f.stock.trim() === '' ? null : Math.max(0, Math.round(Number(f.stock) || 0)),
        rubro: f.rubro,
        publico: f.publico,
        talles: aLista(f.talles),
        colores: aLista(f.colores),
        descripcionCorta: f.descripcionCorta.trim(),
        descripcionLarga: f.descripcionLarga.trim(),
        estado: f.estado,
        ...(foto.imagenUrl !== (p.imagenUrl || '') ? { imagenUrl: foto.imagenUrl, thumbUrl: foto.thumbUrl } : {}),
        ...(JSON.stringify(extras) !== JSON.stringify(p.fotosAdicionales || []) ? { fotosAdicionales: extras } : {}),
      })
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  const campo = 'w-full px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-sm'
  const etiqueta = 'font-body text-[11px] font-semibold text-inksoft mb-1 block'
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={onCerrar}>
      <div className="bg-panel rounded-xl w-full max-w-[720px] p-4 my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-body text-sm font-semibold text-ink">✏️ Editar producto</div>
          <div className="flex items-center gap-3">
            <a href={`/producto/${p.id}`} target="_blank" rel="noreferrer" className="font-body text-xs text-teal">Ver ↗</a>
            <button type="button" onClick={onCerrar} className="font-body text-lg text-inksoft bg-transparent border-none leading-none" aria-label="Cerrar">✕</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-[200px_1fr] gap-4">
          <div>
            <div className="w-full aspect-square rounded-lg bg-panelalt overflow-hidden mb-2 flex items-center justify-center">
              {foto.thumbUrl || foto.imagenUrl ? <img src={foto.imagenUrl || foto.thumbUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">🛍️</span>}
            </div>
            <label className={`block text-center px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs cursor-pointer mb-2 ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
              {subiendo ? 'Subiendo…' : '📷 Cambiar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { subir(e.target.files?.[0], true); e.target.value = '' }} />
            </label>
            <div className="font-body text-[11px] text-inksoft mb-1">Fotos extra ({extras.length}/6)</div>
            <div className="flex flex-wrap gap-1.5">
              {extras.map((u) => (
                <div key={u} className="relative w-12 h-12 rounded-md overflow-hidden bg-panelalt">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setExtras((x) => x.filter((y) => y !== u))} className="absolute top-0 right-0 w-4 h-4 bg-white/90 text-[10px] leading-none border-none" aria-label="Quitar">✕</button>
                </div>
              ))}
              {extras.length < 6 && (
                <label className={`w-12 h-12 rounded-md border border-dashed border-line flex items-center justify-center cursor-pointer text-inksoft ${subiendo ? 'opacity-50 pointer-events-none' : ''}`} title="Agregar foto">
                  +
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { subir(e.target.files?.[0], false); e.target.value = '' }} />
                </label>
              )}
            </div>
          </div>

          <div className="grid gap-2.5">
            <div>
              <label className={etiqueta}>Nombre</label>
              <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} className={campo} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={etiqueta}>Precio</label>
                <input value={f.precio} onChange={(e) => set('precio', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Precio antes</label>
                <input value={f.precioOriginal} onChange={(e) => set('precioOriginal', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Sin oferta" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Stock</label>
                <input value={f.stock} onChange={(e) => set('stock', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Sin control" className={campo} />
              </div>
            </div>
            {Number(f.precioOriginal) > Number(f.precio) && Number(f.precio) > 0 && (
              <div className="font-body text-[11px] text-teal -mt-1">Sale en oferta: {plata(Number(f.precio))} (antes {plata(Number(f.precioOriginal))}, -{Math.round((1 - Number(f.precio) / Number(f.precioOriginal)) * 100)}%)</div>
            )}
            <div className="grid sm:grid-cols-[1fr_130px_150px] gap-2">
              <div>
                <label className={etiqueta}>Categoría</label>
                <SelectorRubro categorias={categorias} value={f.rubro} onChange={(v) => set('rubro', v)} vacio="Elegí la categoría…" pista={f.nombre} className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Público</label>
                <select value={f.publico} onChange={(e) => set('publico', e.target.value)} className={campo}>
                  {PUBLICOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <label className={etiqueta}>Estado</label>
                <select value={f.estado} onChange={(e) => set('estado', e.target.value)} className={campo}>
                  {ESTADOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={etiqueta}>Talles (separados por coma)</label>
                <input value={f.talles} onChange={(e) => set('talles', e.target.value)} placeholder="S, M, L" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Colores (separados por coma)</label>
                <input value={f.colores} onChange={(e) => set('colores', e.target.value)} placeholder="Negro, Blanco" className={campo} />
              </div>
            </div>
            <div>
              <label className={etiqueta}>Descripción corta</label>
              <input value={f.descripcionCorta} onChange={(e) => set('descripcionCorta', e.target.value)} maxLength={200} className={campo} />
            </div>
            <div>
              <label className={etiqueta}>Descripción larga</label>
              <textarea value={f.descripcionLarga} onChange={(e) => set('descripcionLarga', e.target.value)} rows={4} className={campo} />
            </div>
          </div>
        </div>

        {error && <div className="font-body text-xs text-maroon mt-3">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg border border-line bg-panel font-body text-sm">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando || subiendo} className="px-5 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
