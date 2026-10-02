'use client'

import { useMemo, useState } from 'react'
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'
import SelectorRubro from '@/components/admin/SelectorRubro'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'
import ImportarCarpeta from '@/components/admin/ImportarCarpeta'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Admin → Productos → "⚡ Edición rápida": una planilla con todos los
// productos para cambiar muchos de una sin entrar a cada uno.
// - Cada celda se edita en el lugar (nombre, categoría, público, precio,
//   precio anterior, stock, talles, colores). Lo cambiado queda en
//   amarillo hasta que tocás "Guardar".
// - Tildás varios y aplicás en masa: categoría, público, precio (+/- %,
//   fijo o en oferta), talles y colores (reemplazar o agregar), stock.
// - ➕ Agregar productos: filas nuevas (en verde) para un vendedor, con
//   foto opcional; "Duplicar" copia un producto existente como base.
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
  claveImportacion?: string
}
type Campos = Partial<Pick<Prod, 'nombre' | 'rubro' | 'publico' | 'precio' | 'precioOriginal' | 'stock' | 'talles' | 'colores'>>
type Categoria = CategoriaProducto

const POR_PAGINA = 50

type Nuevo = {
  key: string
  nombre: string
  rubro: string
  publico: string
  precio: string
  precioOriginal: string
  stock: string
  talles: string
  colores: string
  imagenUrl?: string
  thumbUrl?: string
  fotosAdicionales?: string[]
  descripcionCorta?: string
  // Si viene de "Importar carpeta", cada fila trae su vendedor (tienda).
  vendedorId?: string
  // Nombre del archivo original (para reconocerla al revisar).
  archivo?: string
  // Para reconocer el producto al reimportar (tienda::código o nombre).
  claveImportacion?: string
  subiendo?: boolean
  error?: string
}
export type NuevoImportado = Omit<Nuevo, 'key'>
let contadorNuevos = 0
const nuevoVacio = (base?: Partial<Nuevo>): Nuevo => ({ key: `n${++contadorNuevos}`, nombre: '', rubro: '', publico: 'mujer', precio: '', precioOriginal: '', stock: '', talles: '', colores: '', ...base })

const aLista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean)
const aTexto = (l?: string[]) => (l || []).join(', ')
const redondear = (n: number) => Math.round(n)

export default function EdicionRapidaProductos({
  password,
  productos,
  categorias,
  rubroLabel,
  onGuardado,
  vendedoresCuentas = [],
  onVendedorCreado,
}: {
  password: string
  productos: Prod[]
  categorias: Categoria[]
  rubroLabel: (id?: string) => string | undefined
  onGuardado: () => void
  // Vendedores para los productos nuevos.
  vendedoresCuentas?: { id: string; nombre: string }[]
  onVendedorCreado?: () => void
}) {
  const [importando, setImportando] = useState(false)
  const [nuevos, setNuevos] = useState<Nuevo[]>([])
  const [vendedorNuevos, setVendedorNuevos] = useState('')
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
  const cantEditados = Object.keys(ediciones).length
  const nuevosConDatos = nuevos.filter((n) => n.nombre.trim() || n.precio || n.imagenUrl)
  const cantCambios = cantEditados + nuevosConDatos.length

  const nombreVendedor = (id: string) => vendedoresCuentas.find((v) => v.id === id)?.nombre.replace(/\s*\(.*\)$/, '')
  const setNuevo = (key: string, c: Partial<Nuevo>) => setNuevos((prev) => prev.map((n) => (n.key === key ? { ...n, ...c, error: undefined } : n)))
  // Las filas nuevas heredan categoría, público y talles de la anterior (cargás varios parecidos seguidos).
  function agregarFilas(cantidad = 1) {
    setAbierto(true)
    setNuevos((prev) => {
      const ultimo = prev[prev.length - 1]
      const base = ultimo ? { rubro: ultimo.rubro, publico: ultimo.publico, talles: ultimo.talles } : {}
      return [...prev, ...Array.from({ length: cantidad }, () => nuevoVacio(base))]
    })
  }
  function duplicar(p: Prod) {
    setNuevos((prev) => [...prev, nuevoVacio({
      nombre: valor(p, 'nombre') || '',
      rubro: valor(p, 'rubro') || '',
      publico: valor(p, 'publico') || 'unisex',
      precio: String(valor(p, 'precio') ?? ''),
      precioOriginal: valor(p, 'precioOriginal') ? String(valor(p, 'precioOriginal')) : '',
      talles: aTexto(valor(p, 'talles')),
      colores: aTexto(valor(p, 'colores')),
    })])
    if (!vendedorNuevos && p.vendedorId) setVendedorNuevos(p.vendedorId)
    setMensaje('Copiado como producto nuevo arriba (en verde): cambiá lo que haga falta y guardá.')
  }
  async function subirFoto(key: string, file: File | null) {
    if (!file) return
    setNuevo(key, { subiendo: true })
    try {
      const d = await subirFotoAdmin(password, file)
      setNuevo(key, { imagenUrl: d.url, thumbUrl: d.thumbUrl, subiendo: false })
    } catch (err: any) {
      setNuevos((prev) => prev.map((n) => (n.key === key ? { ...n, subiendo: false, error: err?.message || 'No se pudo subir la foto.' } : n)))
    }
  }

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
    const partes: string[] = []
    try {
      // 1) Productos nuevos
      if (nuevosConDatos.length) {
        const faltan = nuevosConDatos.map((n) => ({ n, error: !n.nombre.trim() ? 'Falta el nombre' : !n.rubro ? 'Falta la categoría' : !(Number(n.precio) > 0) ? 'Falta el precio' : n.subiendo ? 'Todavía se sube la foto' : '' })).filter((x) => x.error)
        if (nuevosConDatos.some((n) => !n.vendedorId) && !vendedorNuevos) throw new Error('Elegí de qué vendedor son los productos nuevos.')
        if (faltan.length) {
          setNuevos((prev) => prev.map((n) => ({ ...n, error: faltan.find((f) => f.n.key === n.key)?.error })))
          throw new Error(`Revisá los productos nuevos marcados en rojo (${faltan.length}).`)
        }
        // Una llamada por vendedor (las filas importadas traen el suyo).
        const porVendedor = new Map<string, Nuevo[]>()
        for (const n of nuevosConDatos) {
          const v = n.vendedorId || vendedorNuevos
          porVendedor.set(v, [...(porVendedor.get(v) || []), n])
        }
        const keysError = new Map<string, string>()
        let creados = 0
        for (const [vendedorId, filas] of porVendedor) {
          const d = await fetch('/api/admin/productos/nuevos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({
              vendedorId,
              productos: filas.map((n) => ({
                nombre: n.nombre, rubro: n.rubro, publico: n.publico, precio: Number(n.precio),
                precioOriginal: n.precioOriginal ? Number(n.precioOriginal) : null,
                stock: n.stock === '' ? null : Number(n.stock),
                talles: aLista(n.talles), colores: aLista(n.colores),
                imagenUrl: n.imagenUrl, thumbUrl: n.thumbUrl,
                fotosAdicionales: n.fotosAdicionales || [], descripcionCorta: n.descripcionCorta || '', claveImportacion: n.claveImportacion,
              })),
            }),
          }).then((r) => r.json())
          if (d.error) {
            filas.forEach((n) => keysError.set(n.key, d.error))
            continue
          }
          creados += d.creados.length
          for (const e of d.errores || []) keysError.set(filas[e.indice].key, e.error)
        }
        // Quedan solo las que dieron error (las guardadas y las vacías se van).
        setNuevos((prev) => prev.filter((n) => keysError.has(n.key)).map((n) => ({ ...n, error: keysError.get(n.key) })))
        if (keysError.size && !creados) throw new Error(`No se pudieron guardar ${keysError.size} productos nuevos (ver en rojo).`)
        partes.push(`✓ ${creados} producto${creados === 1 ? '' : 's'} nuevo${creados === 1 ? '' : 's'}${keysError.size ? ` · ${keysError.size} con error (en rojo)` : ''}`)
      }
      // 2) Cambios a productos existentes
      if (cantEditados) {
        const cambios = Object.entries(ediciones).map(([id, c]) => ({ id, ...c, precioActual: productos.find((p) => p.id === id)?.precio }))
        const d = await fetch('/api/admin/productos/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify({ cambios }),
        }).then((r) => r.json())
        if (d.error) throw new Error(d.error)
        const conError = new Set((d.errores || []).map((e: any) => e.id))
        setEdiciones((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => conError.has(id))))
        partes.push(`✓ ${d.guardados} actualizado${d.guardados === 1 ? '' : 's'}${d.errores?.length ? ` · ${d.errores.length} con error (siguen en amarillo): ${d.errores.map((e: any) => e.error).join(', ')}` : ''}`)
      }
      setMensaje(partes.join(' · '))
      onGuardado()
    } catch (err: any) {
      setMensaje([...partes, err?.message || 'No se pudo guardar.'].join(' · '))
      if (partes.length) onGuardado()
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
          <div className="font-body text-[11px] text-inksoft">Una planilla para cargar productos nuevos (a mano o desde una carpeta de fotos) y cambiar categoría, precios, ofertas, talles, colores y stock de muchos a la vez.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setImportando(true); setAbierto(true) }} className="px-3.5 py-2 rounded-lg border border-indigo-300 bg-panel text-indigo-700 font-body text-sm font-semibold">📁 Importar carpeta</button>
          <button type="button" onClick={() => agregarFilas(3)} className="px-3.5 py-2 rounded-lg border border-teal bg-panel text-teal font-body text-sm font-semibold">➕ Agregar productos</button>
          <button type="button" onClick={() => setAbierto(true)} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold">Abrir planilla</button>
        </div>
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
        <button type="button" onClick={() => { if (!cantCambios || confirm('Hay cambios sin guardar. ¿Cerrar igual?')) { setAbierto(false); setEdiciones({}); setNuevos([]); setSel(new Set()) } }} className="font-body text-xs text-inksoft underline bg-transparent border-none">Cerrar</button>
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
            <SelectorRubro categorias={categorias} value={valorAccion} onChange={setValorAccion} vacio="Elegí el rubro…" className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs w-60" cerca={productos.find((p) => sel.has(p.id))?.rubro} pista={productos.find((p) => sel.has(p.id))?.nombre} />
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

      {importando && (
        <ImportarCarpeta
          password={password}
          vendedores={vendedoresCuentas}
          onVendedorCreado={() => onVendedorCreado?.()}
          onCerrar={() => setImportando(false)}
          categorias={categorias}
          existentes={productos.map((p) => ({ id: p.id, nombre: p.nombre, vendedorId: p.vendedorId, claveImportacion: p.claveImportacion, precio: p.precio, rubro: p.rubro }))}
          onListo={(filas, actualizaciones) => {
            setNuevos((prev) => [...prev.filter((n) => n.nombre.trim() || n.precio || n.imagenUrl), ...filas.map((f) => nuevoVacio(f))])
            // Los que ya existían: quedan en amarillo como cambios (precio, stock…).
            for (const a of actualizaciones) editar(a.id, a.cambios)
            if (actualizaciones.length) setTexto('')
            setMensaje(`${filas.length} productos nuevos (en verde)${actualizaciones.length ? ` y ${actualizaciones.length} actualizados (en amarillo)` : ''}. Revisá y tocá “Guardar cambios”.`)
          }}
        />
      )}

      {/* Productos nuevos */}
      <div className={`rounded-lg p-3 mb-3 flex flex-wrap items-center gap-2 ${nuevos.length ? 'bg-emerald-50 border border-emerald-300' : 'bg-panelalt border border-line'}`}>
        <span className="font-body text-xs font-semibold text-ink">{nuevos.length ? `➕ ${nuevos.length} producto${nuevos.length === 1 ? '' : 's'} nuevo${nuevos.length === 1 ? '' : 's'} (arriba, en verde)${nuevos.every((n) => n.vendedorId) ? ' — cada uno con su tienda · para filas a mano:' : ' de:'}` : '➕ Cargar productos nuevos:'}</span>
        <select value={vendedorNuevos} onChange={(e) => setVendedorNuevos(e.target.value)} className={`px-2.5 py-2 rounded-lg border bg-panel font-body text-xs max-w-[260px] ${nuevos.some((n) => !n.vendedorId) && !vendedorNuevos ? 'border-maroon' : 'border-line'}`} aria-label="Vendedor de los productos nuevos">
          <option value="">Elegí el vendedor…</option>
          {vendedoresCuentas.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <button type="button" onClick={() => agregarFilas(1)} className="px-3 py-2 rounded-lg border border-teal bg-panel text-teal font-body text-xs font-semibold">+ 1 fila</button>
        {!importando && <button type="button" onClick={() => setImportando(true)} className="px-3 py-2 rounded-lg border border-indigo-300 bg-panel text-indigo-700 font-body text-xs font-semibold">📁 Importar carpeta</button>}
        <button type="button" onClick={() => agregarFilas(5)} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink">+ 5 filas</button>
        {nuevos.length > 0 && <button type="button" onClick={() => setNuevos([])} className="font-body text-xs text-inksoft underline bg-transparent border-none">Quitar filas nuevas</button>}
        <span className="font-body text-[11px] text-inksoft">Cada fila nueva copia la categoría y los talles de la anterior. También podés tocar ⧉ en un producto para duplicarlo.</span>
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
            {nuevos.map((n, i) => {
              const cn = (vacio: boolean) => `w-full px-1.5 py-1 rounded border font-body text-xs bg-white ${vacio && n.error ? 'border-maroon' : 'border-emerald-300'}`
              return (
                <tr key={n.key} className="border-t border-emerald-200 align-top bg-emerald-50/70">
                  <td className="p-2">
                    <button type="button" onClick={() => setNuevos((prev) => prev.filter((x) => x.key !== n.key))} className="text-inksoft hover:text-maroon bg-transparent border-none text-sm mt-1" aria-label="Quitar fila" title="Quitar fila">✕</button>
                  </td>
                  <td className="p-1.5">
                    <div className="flex gap-2 items-start">
                      <label className="w-9 h-9 rounded bg-white border border-dashed border-emerald-400 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer text-sm" title="Subir foto">
                        {n.subiendo ? '⏳' : n.thumbUrl || n.imagenUrl ? <img src={n.thumbUrl || n.imagenUrl} alt="" className="w-full h-full object-cover" /> : '📷'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { subirFoto(n.key, e.target.files?.[0] || null); e.target.value = '' }} />
                      </label>
                      <div className="flex-1 min-w-0">
                        <input autoFocus={i === nuevos.length - 1 && !n.nombre} value={n.nombre} onChange={(e) => setNuevo(n.key, { nombre: e.target.value })} placeholder="Nombre del producto *" className={cn(!n.nombre.trim())} aria-label="Nombre nuevo" />
                        <div className={`font-body text-[10px] px-1.5 truncate ${n.error ? 'text-maroon font-semibold' : 'text-emerald-700'}`} title={n.archivo}>
                          {n.error || ['NUEVO', n.vendedorId && (nombreVendedor(n.vendedorId) || 'tienda'), n.archivo && `📁 ${n.archivo}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-1.5">
                    <SelectorRubro categorias={categorias} value={n.rubro} onChange={(v) => setNuevo(n.key, { rubro: v })} vacio="Elegí categoría *" className={cn(!n.rubro)} pista={n.nombre} cerca={nuevos[i - 1]?.rubro} />
                  </td>
                  <td className="p-1.5">
                    <select value={n.publico} onChange={(e) => setNuevo(n.key, { publico: e.target.value })} className={cn(false)}>
                      {PUBLICOS_PRODUCTO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5"><input type="number" min={1} value={n.precio} onChange={(e) => setNuevo(n.key, { precio: e.target.value })} placeholder="*" className={cn(!(Number(n.precio) > 0))} aria-label="Precio nuevo" /></td>
                  <td className="p-1.5"><input type="number" min={0} value={n.precioOriginal} onChange={(e) => setNuevo(n.key, { precioOriginal: e.target.value })} placeholder="—" className={cn(false)} aria-label="Precio anterior nuevo" /></td>
                  <td className="p-1.5"><input type="number" min={0} value={n.stock} onChange={(e) => setNuevo(n.key, { stock: e.target.value })} placeholder="∞" className={cn(false)} aria-label="Stock nuevo" /></td>
                  <td className="p-1.5"><input value={n.talles} onChange={(e) => setNuevo(n.key, { talles: e.target.value })} placeholder="36, 37…" className={cn(false)} aria-label="Talles nuevo" /></td>
                  <td className="p-1.5"><input value={n.colores} onChange={(e) => setNuevo(n.key, { colores: e.target.value })} placeholder="Negro, …" className={cn(false)} aria-label="Colores nuevo" /></td>
                </tr>
              )
            })}
            {visibles.map((p) => (
              <tr key={p.id} className={`border-t border-line align-top ${sel.has(p.id) ? 'bg-tealsoft/40' : ''}`}>
                <td className="p-2">
                  <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })} className="accent-teal mt-1.5" aria-label={`Seleccionar ${p.nombre}`} />
                  <button type="button" onClick={() => duplicar(p)} className="block text-inksoft hover:text-teal bg-transparent border-none text-sm mt-1.5 p-0" title="Duplicar como producto nuevo" aria-label={`Duplicar ${p.nombre}`}>⧉</button>
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
                  <SelectorRubro categorias={categorias} value={valor(p, 'rubro') || ''} onChange={(v) => editar(p.id, { rubro: v })} vacio="⚠️ Sin rubro" className={celda(editado(p, 'rubro'))} pista={valor(p, 'nombre')} />
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
          {guardando ? 'Guardando...' : `💾 Guardar cambios${cantCambios ? ` (${[nuevosConDatos.length && `${nuevosConDatos.length} nuevo${nuevosConDatos.length === 1 ? '' : 's'}`, cantEditados && `${cantEditados} editado${cantEditados === 1 ? '' : 's'}`].filter(Boolean).join(' + ')})` : ''}`}
        </button>
        {cantCambios > 0 && <button type="button" onClick={() => { setEdiciones({}); setNuevos([]); setMensaje('') }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink">Descartar</button>}
        {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
      </div>
    </div>
  )
}
