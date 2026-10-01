'use client'

import { useMemo, useState } from 'react'
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'
import SelectorRubro from '@/components/admin/SelectorRubro'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Admin → Productos → "⚡ Edición rápida": una planilla con todos los
// productos para cambiar muchos de una sin entrar a cada uno.
// - Cada celda se edita en el lugar (nombre, categoría, público, precio,
//   precio anterior, stock, talles, colores). Lo cambiado queda en
//   amarillo hasta que tocás "Guardar".
// - Tildás varios y aplicás en masa: categoría, público, precio (+/- %,
//   fijo o en oferta), talles y colores (reemplazar o agregar), stock.
// - Nada se guarda hasta "💾 Guardar cambios"; "Descartar" vuelve atrás.

type Prod = {
  id: string
  nombre: string
  vendedor?: string
  vendedorId?: string
  rubro?: string
  publico?: string
  precio: number
  precioOriginal?: number | null
  stock?: number | null
  talles?: string[]
  colores?: string[]
  estado?: string
  imagenUrl?: string
  thumbUrl?: string
}
type Campos = Partial<Pick<Prod, 'nombre' | 'rubro' | 'publico' | 'precio' | 'precioOriginal' | 'stock' | 'talles' | 'colores'>>
type Categoria = CategoriaProducto

const POR_PAGINA = 50
const aLista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean)
const aTexto = (l?: string[]) => (l || []).join(', ')
const redondear = (n: number) => Math.round(n)

export default function EdicionRapidaProductos({
  password,
  productos,
  categorias,
  rubroLabel,
  onGuardado,
}: {
  password: string
  productos: Prod[]
  categorias: Categoria[]
  rubroLabel: (id?: string) => string | undefined
  onGuardado: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [ediciones, setEdiciones] = useState<Record<string, Campos>>({})
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [texto, setTexto] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // Acción masiva
  const [accion, setAccion] = useState('rubro')
  const [valorAccion, setValorAccion] = useState('')
  const [modoLista, setModoLista] = useState<'reemplazar' | 'agregar'>('agregar')

  const categoriaDeRubro = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of categorias) for (const r of c.rubros) m[r.id] = c.id
    return m
  }, [categorias])

  const vendedores = useMemo(() => Array.from(new Set(productos.map((p) => p.vendedor || 'Sin nombre'))).sort(), [productos])

  const valor = <K extends keyof Campos>(p: Prod, k: K): Prod[K] => (ediciones[p.id] && k in ediciones[p.id] ? (ediciones[p.id][k] as Prod[K]) : p[k])
  const editado = (p: Prod, k: keyof Campos) => !!ediciones[p.id] && k in ediciones[p.id]

  function editar(id: string, cambios: Campos) {
    const original = productos.find((p) => p.id === id)
    setEdiciones((prev) => {
      const actual = { ...(prev[id] || {}), ...cambios }
      // Si volvió al valor original, deja de contar como cambio.
      for (const k of Object.keys(actual) as (keyof Campos)[]) {
        if (original && JSON.stringify(actual[k] ?? null) === JSON.stringify(original[k] ?? null)) delete actual[k]
      }
      const sig = { ...prev }
      if (Object.keys(actual).length) sig[id] = actual
      else delete sig[id]
      return sig
    })
  }

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return productos.filter((p) => {
      if (q && !`${p.nombre} ${p.vendedor || ''} ${rubroLabel(p.rubro) || ''}`.toLowerCase().includes(q)) return false
      if (vendedor && (p.vendedor || 'Sin nombre') !== vendedor) return false
      if (categoriaFiltro === '__sin') return !p.rubro || !rubroLabel(p.rubro)
      if (categoriaFiltro && categoriaDeRubro[p.rubro || ''] !== categoriaFiltro) return false
      return true
    })
  }, [productos, texto, vendedor, categoriaFiltro, rubroLabel, categoriaDeRubro])

  const visibles = filtrados.slice(0, pagina * POR_PAGINA)
  const todosSel = filtrados.length > 0 && filtrados.every((p) => sel.has(p.id))
  const cantCambios = Object.keys(ediciones).length

  function alternarTodos() {
    setSel((prev) => {
      const n = new Set(prev)
      if (todosSel) filtrados.forEach((p) => n.delete(p.id))
      else filtrados.forEach((p) => n.add(p.id))
      return n
    })
  }

  function aplicarMasivo() {
    const elegidos = productos.filter((p) => sel.has(p.id))
    const v = valorAccion.trim()
    const num = Number(v.replace(',', '.'))
    setMensaje('')
    for (const p of elegidos) {
      const precio = Number(valor(p, 'precio')) || 0
      switch (accion) {
        case 'rubro': if (v) editar(p.id, { rubro: v }); break
        case 'publico': if (v) editar(p.id, { publico: v }); break
        case 'precioPct': if (num) editar(p.id, { precio: Math.max(1, redondear(precio * (1 + num / 100))) }); break
        case 'precioFijo': if (num > 0) editar(p.id, { precio: num }); break
        case 'precioSuma': if (num) editar(p.id, { precio: Math.max(1, precio + num) }); break
        case 'oferta': {
          if (!(num > 0 && num < 100)) break
          // El "antes" es el precio actual (o el anterior si ya estaba en oferta).
          const antes = Number(valor(p, 'precioOriginal')) > precio ? Number(valor(p, 'precioOriginal')) : precio
          editar(p.id, { precioOriginal: antes, precio: Math.max(1, redondear(antes * (1 - num / 100))) })
          break
        }
        case 'quitarOferta': {
          const antes = Number(valor(p, 'precioOriginal'))
          editar(p.id, antes > precio ? { precio: antes, precioOriginal: null } : { precioOriginal: null })
          break
        }
        case 'talles':
        case 'colores': {
          const nuevos = aLista(v)
          const actuales = (valor(p, accion) as string[] | undefined) || []
          const lista = modoLista === 'reemplazar' ? nuevos : Array.from(new Set([...actuales, ...nuevos]))
          editar(p.id, { [accion]: lista } as Campos)
          break
        }
        case 'stock': editar(p.id, { stock: v === '' ? null : Math.max(0, Math.floor(num) || 0) }); break
      }
    }
    setMensaje(`Aplicado a ${elegidos.length} producto${elegidos.length === 1 ? '' : 's'} — revisá y tocá “Guardar cambios”.`)
  }

  async function guardar() {
    setGuardando(true)
    setMensaje('')
    try {
      const cambios = Object.entries(ediciones).map(([id, c]) => ({ id, ...c, precioActual: productos.find((p) => p.id === id)?.precio }))
      const d = await fetch('/api/admin/productos/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ cambios }),
      }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      const conError = new Set((d.errores || []).map((e: any) => e.id))
      setEdiciones((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => conError.has(id))))
      setMensaje(`✓ ${d.guardados} producto${d.guardados === 1 ? '' : 's'} actualizado${d.guardados === 1 ? '' : 's'}${d.errores?.length ? ` · ${d.errores.length} con error (siguen en amarillo): ${d.errores.map((e: any) => e.error).join(', ')}` : ''}`)
      onGuardado()
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const celda = (cambiado: boolean) => `w-full px-1.5 py-1 rounded border font-body text-xs ${cambiado ? 'border-ochre bg-amber-50' : 'border-transparent hover:border-line bg-transparent'}`

  if (!abierto) {
    return (
      <div className="bg-panel border border-teal rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-body text-sm font-semibold text-ink">⚡ Edición rápida de productos</div>
          <div className="font-body text-[11px] text-inksoft">Una planilla para cambiar categoría, precios, ofertas, talles, colores y stock de muchos productos a la vez.</div>
        </div>
        <button type="button" onClick={() => setAbierto(true)} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold">Abrir planilla</button>
      </div>
    )
  }

  const placeholderAccion: Record<string, string> = {
    precioPct: 'Ej: 10 (sube 10%) o -15 (baja 15%)',
    precioFijo: 'Precio en Bs, ej: 120',
    precioSuma: 'Ej: 20 (suma Bs 20) o -10',
    oferta: '% de descuento, ej: 20',
    talles: 'Ej: 36, 37, 38 o S, M, L',
    colores: 'Ej: Negro, Marrón',
    stock: 'Unidades (vacío = sin control)',
  }

  return (
    <div className="bg-panel border border-teal rounded-xl p-3.5 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-body text-sm font-semibold text-ink">⚡ Edición rápida de productos</div>
        <button type="button" onClick={() => { if (!cantCambios || confirm('Hay cambios sin guardar. ¿Cerrar igual?')) { setAbierto(false); setEdiciones({}); setSel(new Set()) } }} className="font-body text-xs text-inksoft underline bg-transparent border-none">Cerrar</button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1) }} placeholder="Buscar por nombre, vendedor o rubro" className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-line font-body text-xs" />
        <select value={vendedor} onChange={(e) => { setVendedor(e.target.value); setPagina(1) }} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
          <option value="">Todos los vendedores</option>
          {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={categoriaFiltro} onChange={(e) => { setCategoriaFiltro(e.target.value); setPagina(1) }} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
          <option value="">Todas las categorías</option>
          <option value="__sin">⚠️ Sin categoría</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {/* Acción masiva */}
      <div className={`rounded-lg p-3 mb-3 ${sel.size ? 'bg-tealsoft border border-teal' : 'bg-panelalt border border-line'}`}>
        <div className="font-body text-xs font-semibold text-ink mb-2">
          {sel.size ? `Cambiar los ${sel.size} seleccionados:` : 'Tildá productos en la tabla para cambiarlos todos juntos.'}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={accion} onChange={(e) => { setAccion(e.target.value); setValorAccion('') }} disabled={!sel.size} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
            <option value="rubro">Categoría / rubro</option>
            <option value="publico">Público (Mujer, Hombre…)</option>
            <option value="precioPct">Precio: subir/bajar %</option>
            <option value="precioSuma">Precio: sumar/restar Bs</option>
            <option value="precioFijo">Precio: fijar</option>
            <option value="oferta">Poner en oferta (% off)</option>
            <option value="quitarOferta">Quitar oferta</option>
            <option value="talles">Talles</option>
            <option value="colores">Colores</option>
            <option value="stock">Stock</option>
          </select>
          {accion === 'rubro' ? (
            <SelectorRubro categorias={categorias} value={valorAccion} onChange={setValorAccion} vacio="Elegí el rubro…" className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs w-60" />
          ) : accion === 'publico' ? (
            <select value={valorAccion} onChange={(e) => setValorAccion(e.target.value)} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
              <option value="">Elegí…</option>
              {PUBLICOS_PRODUCTO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          ) : accion !== 'quitarOferta' ? (
            <input value={valorAccion} onChange={(e) => setValorAccion(e.target.value)} disabled={!sel.size} placeholder={placeholderAccion[accion]} className="px-3 py-2 rounded-lg border border-line font-body text-xs w-56" />
          ) : null}
          {(accion === 'talles' || accion === 'colores') && (
            <select value={modoLista} onChange={(e) => setModoLista(e.target.value as any)} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
              <option value="agregar">Agregar a los que tiene</option>
              <option value="reemplazar">Reemplazar todos</option>
            </select>
          )}
          <button type="button" onClick={aplicarMasivo} disabled={!sel.size || (accion !== 'quitarOferta' && accion !== 'stock' && !valorAccion.trim())} className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-40">
            Aplicar
          </button>
          {sel.size > 0 && <button type="button" onClick={() => setSel(new Set())} className="font-body text-xs text-inksoft underline bg-transparent border-none">Deseleccionar</button>}
        </div>
      </div>

      {/* Planilla */}
      <div className="overflow-x-auto border border-line rounded-lg">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="bg-panelalt">
            <tr className="font-body text-[11px] text-inksoft text-left">
              <th className="p-2 w-8"><input type="checkbox" checked={todosSel} onChange={alternarTodos} className="accent-teal" aria-label="Seleccionar todos" /></th>
              <th className="p-2 w-[24%]">Producto</th>
              <th className="p-2 w-[18%]">Categoría › Rubro</th>
              <th className="p-2 w-[9%]">Público</th>
              <th className="p-2 w-[8%]">Precio Bs</th>
              <th className="p-2 w-[8%]">Antes Bs</th>
              <th className="p-2 w-[6%]">Stock</th>
              <th className="p-2 w-[13%]">Talles</th>
              <th className="p-2 w-[13%]">Colores</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className={`border-t border-line align-top ${sel.has(p.id) ? 'bg-tealsoft/40' : ''}`}>
                <td className="p-2">
                  <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })} className="accent-teal mt-1.5" aria-label={`Seleccionar ${p.nombre}`} />
                </td>
                <td className="p-1.5">
                  <div className="flex gap-2 items-start">
                    <div className="w-9 h-9 rounded bg-panelalt overflow-hidden shrink-0">
                      {(p.thumbUrl || p.imagenUrl) && <img src={p.thumbUrl || p.imagenUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input value={valor(p, 'nombre') || ''} onChange={(e) => editar(p.id, { nombre: e.target.value })} className={celda(editado(p, 'nombre'))} aria-label="Nombre" />
                      <div className="font-body text-[10px] text-inksoft px-1.5 truncate">{p.vendedor || 'Sin vendedor'}{p.estado && p.estado !== 'activo' ? ` · ${p.estado}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td className="p-1.5">
                  <SelectorRubro categorias={categorias} value={valor(p, 'rubro') || ''} onChange={(v) => editar(p.id, { rubro: v })} vacio="⚠️ Sin rubro" className={celda(editado(p, 'rubro'))} />
                </td>
                <td className="p-1.5">
                  <select value={valor(p, 'publico') || 'unisex'} onChange={(e) => editar(p.id, { publico: e.target.value })} className={celda(editado(p, 'publico'))}>
                    {PUBLICOS_PRODUCTO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </td>
                <td className="p-1.5">
                  <input type="number" min={1} value={valor(p, 'precio') ?? ''} onChange={(e) => editar(p.id, { precio: Number(e.target.value) })} className={celda(editado(p, 'precio'))} aria-label="Precio" />
                </td>
                <td className="p-1.5">
                  <input type="number" min={0} value={valor(p, 'precioOriginal') ?? ''} onChange={(e) => editar(p.id, { precioOriginal: e.target.value === '' ? null : Number(e.target.value) })} placeholder="—" className={celda(editado(p, 'precioOriginal'))} aria-label="Precio anterior" />
                </td>
                <td className="p-1.5">
                  <input type="number" min={0} value={valor(p, 'stock') ?? ''} onChange={(e) => editar(p.id, { stock: e.target.value === '' ? null : Number(e.target.value) })} placeholder="∞" className={celda(editado(p, 'stock'))} aria-label="Stock" />
                </td>
                <td className="p-1.5">
                  <input defaultValue={aTexto(valor(p, 'talles'))} key={`t-${p.id}-${aTexto(valor(p, 'talles'))}`} onBlur={(e) => editar(p.id, { talles: aLista(e.target.value) })} placeholder="36, 37…" className={celda(editado(p, 'talles'))} aria-label="Talles" />
                </td>
                <td className="p-1.5">
                  <input defaultValue={aTexto(valor(p, 'colores'))} key={`c-${p.id}-${aTexto(valor(p, 'colores'))}`} onBlur={(e) => editar(p.id, { colores: aLista(e.target.value) })} placeholder="Negro, …" className={celda(editado(p, 'colores'))} aria-label="Colores" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 font-body text-[11px] text-inksoft">
        <span>{filtrados.length} producto{filtrados.length === 1 ? '' : 's'}{sel.size ? ` · ${sel.size} seleccionado${sel.size === 1 ? '' : 's'}` : ''}</span>
        {visibles.length < filtrados.length && (
          <button type="button" onClick={() => setPagina((n) => n + 1)} className="text-teal underline bg-transparent border-none">Ver {Math.min(POR_PAGINA, filtrados.length - visibles.length)} más</button>
        )}
      </div>

      {/* Guardar */}
      <div className={`sticky bottom-0 mt-3 -mx-3.5 -mb-3.5 px-3.5 py-3 rounded-b-xl border-t flex flex-wrap items-center gap-2 ${cantCambios ? 'bg-amber-50 border-ochre' : 'bg-panel border-line'}`}>
        <button type="button" onClick={guardar} disabled={!cantCambios || guardando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-40">
          {guardando ? 'Guardando...' : `💾 Guardar cambios${cantCambios ? ` (${cantCambios} producto${cantCambios === 1 ? '' : 's'})` : ''}`}
        </button>
        {cantCambios > 0 && <button type="button" onClick={() => { setEdiciones({}); setMensaje('') }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink">Descartar</button>}
        {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
      </div>
    </div>
  )
}
