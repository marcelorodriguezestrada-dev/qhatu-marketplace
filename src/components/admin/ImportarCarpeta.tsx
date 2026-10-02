'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CIUDADES, type CiudadId } from '@/data/ciudades'
import { claveImportacion, codigoTienda, leerFotos, pareceUnaTienda, type FotoArchivo, type ProductoLeido } from '@/lib/importarCarpeta'
import { leerSheet } from '@/lib/importarSheet'
import { buscarRubroPorTexto } from '@/lib/planillaProductos'
import type { CategoriaProducto } from '@/lib/arbolCategorias'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'
import type { NuevoImportado } from '@/components/admin/EdicionRapidaProductos'

// Admin → Productos → Edición rápida → "📁 Importar carpeta".
// 1. Elegís una carpeta (de la compu, o de Google Drive para escritorio)
//    con una subcarpeta por tienda y una foto por producto (ver
//    src/lib/importarCarpeta.ts para cómo nombrar los archivos).
// 2. Cada código de tienda se asocia a un vendedor (o se crea la tienda
//    ahí mismo). Queda guardado para la próxima.
// 3. Se suben las fotos y la IA mira cada una: categoría, nombre,
//    público, colores y descripción. Precio/talles/stock salen del
//    nombre del archivo.
// 4. Todo cae en la planilla como filas nuevas para revisar y guardar.

type Vendedor = { id: string; nombre: string }
type Existente = { id: string; nombre: string; vendedorId?: string; claveImportacion?: string; precio?: number; rubro?: string }
// Cambios a un producto que ya estaba (reimportar actualiza precio/stock…).
export type Actualizacion = { id: string; cambios: { precio?: number; precioOriginal?: number | null; stock?: number | null; talles?: string[]; colores?: string[] } }
type Estado = 'elegir' | 'tiendas' | 'procesando' | 'listo'

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const capital = (t: string) => t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function ImportarCarpeta({
  password,
  vendedores,
  onVendedorCreado,
  onListo,
  onCerrar,
  categorias,
  existentes,
}: {
  password: string
  vendedores: Vendedor[]
  onVendedorCreado: () => void
  onListo: (filas: NuevoImportado[], actualizaciones: Actualizacion[]) => void
  onCerrar: () => void
  categorias: CategoriaProducto[]
  existentes: Existente[]
}) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [estado, setEstado] = useState<Estado>('elegir')
  const [modo, setModo] = useState<'carpeta' | 'sheet'>('carpeta')
  const [linkSheet, setLinkSheet] = useState('')
  const [filasSheet, setFilasSheet] = useState<string[][] | null>(null)
  const [leyendoSheet, setLeyendoSheet] = useState(false)
  const [errorSheet, setErrorSheet] = useState('')
  const [actualizar, setActualizar] = useState(true)
  const [fotos, setFotos] = useState<FotoArchivo[]>([])
  const [unaTienda, setUnaTienda] = useState(false)
  const [codigos, setCodigos] = useState<Record<string, string>>({})
  const [extras, setExtras] = useState<Vendedor[]>([]) // tiendas recién creadas (hasta que recargue la lista)
  const [incluir, setIncluir] = useState<Record<string, boolean>>({})
  const [usarIA, setUsarIA] = useState(true)
  const [nombreIA, setNombreIA] = useState(true)
  const [creando, setCreando] = useState<string | null>(null)
  const [formTienda, setFormTienda] = useState({ nombreNegocio: '', whatsapp: '', email: '', ciudad: 'potosi' as CiudadId })
  const [errorTienda, setErrorTienda] = useState('')
  const [avance, setAvance] = useState({ hechos: 0, total: 0, errores: 0, etapa: '' })
  const frenar = useRef(false)
  // Para elegir carpetas (no archivos sueltos): se pone al aparecer el input.
  const elegirCarpeta = (el: HTMLInputElement | null) => { if (el) el.setAttribute('webkitdirectory', '') }
  const [resumen, setResumen] = useState({ nuevos: 0, actualizados: 0 })

  useEffect(() => {
    fetch('/api/admin/codigos-tiendas', { headers }).then((r) => r.json()).then((d) => setCodigos(d.codigos || {})).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todosVendedores = useMemo(() => [...vendedores, ...extras.filter((e) => !vendedores.some((v) => v.id === e.id))], [vendedores, extras])
  const lectura = useMemo(() => {
    if (modo === 'sheet' && filasSheet) {
      const r = leerSheet(filasSheet, fotos)
      return { productos: r.productos, ignorados: r.avisos, error: r.error }
    }
    return { ...leerFotos(fotos, { unaTienda }), error: undefined as string | undefined }
  }, [modo, filasSheet, fotos, unaTienda])
  const { productos, ignorados } = lectura
  const rubrosFlat = useMemo(() => categorias.flatMap((c) => c.rubros.map((r) => ({ ...r, categoriaId: c.id, categoriaLabel: c.label }))), [categorias])
  const categoriaDeRubro = useMemo(() => new Map(rubrosFlat.map((r) => [r.id, r.categoriaId])), [rubrosFlat])
  const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  // Qué tan bien coincide un rubro con lo que dice la columna "categoría".
  const puntaje = (r: (typeof rubrosFlat)[number], t: string) => {
    const l = norm(r.label), g = norm(r.grupo || ''), ruta = norm([r.categoriaLabel, r.grupo, r.label].filter(Boolean).join(' '))
    if (ruta === t || norm(`${r.grupo} ${r.label}`) === t) return 8
    if (l === t) return 5
    if (l.startsWith(t + ' ') || (t.length >= 4 && l.split(' ')[0].startsWith(t.replace(/s$/, '')))) return 4
    if (g === t) return /^otros?$/.test(l) ? 4 : 2
    if (l.includes(t)) return 2
    return ruta.includes(t) ? 1 : 0
  }
  // Categoría desde el texto de la planilla: si la IA (mirando la foto) eligió
  // un rubro compatible con el texto, gana la IA; si no, el que mejor
  // coincide, prefiriendo las categorías que ya usa esa tienda.
  function rubroPorTexto(texto: string, vendedorId: string | undefined, iaRubro?: string | null): string | null {
    const t = norm(texto)
    if (!t) return null
    const id = buscarRubroPorTexto(texto, rubrosFlat)?.id
    const exacto = id ? rubrosFlat.find((r) => r.id === id) : undefined
    if (exacto && t.includes(' ') && puntaje(exacto, t) >= 8) return exacto.id
    const ia = iaRubro ? rubrosFlat.find((r) => r.id === iaRubro) : undefined
    if (ia && puntaje(ia, t) > 0) return ia.id
    const usadas = new Map<string, number>()
    for (const e of existentes) if (e.vendedorId === vendedorId && e.rubro) { const c = categoriaDeRubro.get(e.rubro); if (c) usadas.set(c, (usadas.get(c) || 0) + 1) }
    let mejor: { id: string; p: number } | null = null
    for (const r of rubrosFlat) {
      const p = puntaje(r, t)
      if (!p) continue
      const total = p + (usadas.has(r.categoriaId) ? 3 : 0) + (ia && ia.categoriaId === r.categoriaId ? 2 : 0)
      if (!mejor || total > mejor.p) mejor = { id: r.id, p: total }
    }
    return mejor?.id || null
  }
  // ¿Ya existe este producto en esa tienda? (misma clave de importación, o mismo nombre)
  const buscarExistente = (p: ProductoLeido): Existente | undefined => {
    const vendedorId = codigos[p.tienda]
    if (!vendedorId) return undefined
    const clave = claveImportacion(p)
    return existentes.find((e) => e.claveImportacion === clave) || existentes.find((e) => e.vendedorId === vendedorId && codigoTienda(e.nombre) === codigoTienda(p.nombre))
  }
  const tiendas = useMemo(() => {
    const m = new Map<string, ProductoLeido[]>()
    for (const p of productos) m.set(p.tienda, [...(m.get(p.tienda) || []), p])
    return [...m.entries()].map(([codigo, prods]) => ({ codigo, prods }))
  }, [productos])
  const activas = tiendas.filter((t) => incluir[t.codigo] !== false)
  const sinAsignar = activas.filter((t) => !todosVendedores.some((v) => v.id === codigos[t.codigo]))
  const aProcesar = activas.flatMap((t) => t.prods)
  const existentesEncontrados = aProcesar.filter((p) => buscarExistente(p)).length

  async function leerLinkSheet() {
    setErrorSheet('')
    setLeyendoSheet(true)
    try {
      const d = await fetch('/api/admin/importar-sheet', { method: 'POST', headers, body: JSON.stringify({ url: linkSheet.trim() }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      const r = leerSheet(d.filas, fotos)
      if (r.error) throw new Error(r.error)
      setFilasSheet(d.filas)
      setIncluir({})
      setEstado('tiendas')
    } catch (err: any) {
      setErrorSheet(err?.message || 'No se pudo leer la planilla.')
    } finally {
      setLeyendoSheet(false)
    }
  }

  function elegirArchivos(lista: FileList | null) {
    if (!lista?.length) return
    const fs: FotoArchivo[] = Array.from(lista).map((file) => ({ file, ruta: (file as any).webkitRelativePath || file.name }))
    setFotos(fs)
    setUnaTienda(pareceUnaTienda(fs))
    setIncluir({})
    setEstado('tiendas')
  }

  async function asociar(codigo: string, vendedorId: string) {
    setCodigos((c) => ({ ...c, [codigo]: vendedorId }))
    await fetch('/api/admin/codigos-tiendas', { method: 'POST', headers, body: JSON.stringify({ codigo, vendedorId }) }).catch(() => {})
  }

  async function crearTienda(codigo: string) {
    setErrorTienda('')
    const nombreNegocio = formTienda.nombreNegocio.trim()
    if (nombreNegocio.length < 2) { setErrorTienda('Poné el nombre de la tienda.'); return }
    // Sin email: uno provisorio (después se cambia en Usuarios → Editar).
    const email = formTienda.email.trim() || `tienda-${codigo}@sin-email.clasiclick.pro`
    const d = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, nombre: nombreNegocio, nombreNegocio, whatsapp: formTienda.whatsapp.trim(), ciudad: formTienda.ciudad }),
    }).then((r) => r.json()).catch(() => ({ error: 'No se pudo crear la tienda.' }))
    if (d.error) { setErrorTienda(d.error); return }
    setExtras((x) => [...x, { id: d.uid, nombre: `${nombreNegocio} (${email})` }])
    await asociar(codigo, d.uid)
    setCreando(null)
    onVendedorCreado()
  }

  async function analizar(imagenUrl: string, pista: string) {
    for (let intento = 0; intento < 6; intento++) {
      const r = await fetch('/api/admin/productos/analizar-foto', { method: 'POST', headers, body: JSON.stringify({ imagenUrl, pista }) })
      if (r.status === 429) {
        setAvance((a) => ({ ...a, etapa: '⏳ La IA gratis pide una pausa (límite por minuto), sigo en unos segundos…' }))
        await esperar(15000 + intento * 5000)
        continue
      }
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) return null
      return d
    }
    return null
  }

  async function subirDesdeLink(url: string) {
    const d = await fetch('/api/admin/foto-desde-link', { method: 'POST', headers, body: JSON.stringify({ url }) }).then((r) => r.json())
    if (!d.url) throw new Error(d.error || 'No se pudo bajar la foto.')
    return d as { url: string; thumbUrl: string }
  }

  async function procesar() {
    frenar.current = false
    setEstado('procesando')
    // Los que ya existen se actualizan (precio, stock…) sin subir fotos ni usar IA.
    const actualizaciones: Actualizacion[] = []
    const nuevosAProcesar: ProductoLeido[] = []
    for (const p of aProcesar) {
      const e = actualizar ? buscarExistente(p) : undefined
      if (!e) { nuevosAProcesar.push(p); continue }
      const cambios: Actualizacion['cambios'] = {}
      if (p.precio != null) cambios.precio = p.precio
      if (p.precioAntes != null) cambios.precioOriginal = p.precioAntes > (p.precio ?? e.precio ?? 0) ? p.precioAntes : null
      if (p.stock != null) cambios.stock = p.stock
      if (p.talles.length) cambios.talles = p.talles
      if (p.colores?.length) cambios.colores = p.colores
      if (Object.keys(cambios).length) actualizaciones.push({ id: e.id, cambios })
    }
    const total = nuevosAProcesar.length
    setAvance({ hechos: 0, total, errores: 0, etapa: '' })
    // Cada resultado en su lugar: quedan en el orden de la carpeta/planilla.
    const filas: (NuevoImportado | undefined)[] = new Array(total)
    let hechos = 0
    let errores = 0
    const cola = nuevosAProcesar.map((p, i) => [p, i] as const)
    const base = (p: ProductoLeido) => ({
      vendedorId: codigos[p.tienda],
      archivo: p.fila ? `fila ${p.fila}` : p.archivo,
      claveImportacion: claveImportacion(p),
      publico: p.publico || 'unisex',
      precio: p.precio != null ? String(p.precio) : '',
      precioOriginal: p.precioAntes != null && p.precio != null && p.precioAntes > p.precio ? String(p.precioAntes) : '',
      stock: p.stock != null ? String(p.stock) : '',
      talles: p.talles.join(', '),
    })
    // 2 a la vez: rápido pero sin pasarse del límite gratis de la IA.
    const trabajador = async () => {
      while (cola.length && !frenar.current) {
        const [p, i] = cola.shift()!
        try {
          // Fotos: archivos de la carpeta y/o links de la planilla.
          const subidas: { url: string; thumbUrl: string }[] = []
          let errorFoto = ''
          for (const f of p.fotos.slice(0, 5)) {
            try { subidas.push(await subirFotoAdmin(password, f, subidas.length === 0)) } catch (err: any) { errorFoto = err?.message || 'error' }
          }
          for (const u of (p.fotosLink || []).slice(0, 5 - subidas.length)) {
            setAvance((a) => ({ ...a, etapa: `Bajando la foto de “${p.nombre}”…` }))
            try { subidas.push(await subirDesdeLink(u)) } catch (err: any) { errorFoto = err?.message || 'error' }
          }
          const [foto, ...resto] = subidas
          // Categoría: la de la planilla si la reconocemos; si no, la IA mirando la foto.
          let ia: any = null
          if (usarIA && foto) {
            setAvance((a) => ({ ...a, etapa: `Analizando “${p.nombre}”…` }))
            ia = await analizar(foto.url, modo === 'sheet' ? `${p.nombre}${p.categoriaTexto ? ` (${p.categoriaTexto})` : ''}` : p.archivo)
          }
          const rubro = (p.categoriaTexto ? rubroPorTexto(p.categoriaTexto, codigos[p.tienda], ia?.rubroId) : null) || ia?.rubroId || ''
          filas[i] = {
            ...base(p),
            nombre: (nombreIA && ia?.nombre) || p.nombre,
            rubro,
            publico: p.publico || ia?.publico || 'unisex',
            colores: (p.colores?.length ? p.colores : ia?.colores || []).join(', '),
            imagenUrl: foto?.url,
            thumbUrl: foto?.thumbUrl,
            fotosAdicionales: resto.map((x) => x.url),
            descripcionCorta: p.descripcion || ia?.descripcion || '',
            error: !foto && errorFoto ? `Foto: ${errorFoto}` : !rubro ? (p.categoriaTexto ? `No reconocimos la categoría “${p.categoriaTexto}”: elegila` : 'Elegí la categoría') : undefined,
          }
        } catch (err: any) {
          errores++
          filas[i] = { ...base(p), nombre: p.nombre, rubro: '', colores: (p.colores || []).join(', '), error: err?.message || 'Error' }
        }
        hechos++
        setAvance((a) => ({ ...a, hechos, errores }))
      }
    }
    await Promise.all([trabajador(), trabajador()])
    setResumen({ nuevos: filas.filter(Boolean).length, actualizados: actualizaciones.length })
    setEstado('listo')
    onListo(filas.filter((f): f is NuevoImportado => !!f), actualizaciones)
  }

  const nombreDe = (id?: string) => todosVendedores.find((v) => v.id === id)?.nombre

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3.5 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-body text-sm font-semibold text-ink">{modo === 'sheet' ? '📊 Importar productos desde Google Sheets' : '📁 Importar productos desde una carpeta'}</div>
        {estado !== 'procesando' && <button type="button" onClick={onCerrar} className="font-body text-xs text-inksoft underline bg-transparent border-none">Cerrar</button>}
      </div>

      {estado === 'elegir' && (
        <>
          <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 w-fit border border-indigo-100">
            <button type="button" onClick={() => { setModo('carpeta'); setNombreIA(true) }} className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold border-none ${modo === 'carpeta' ? 'bg-indigo-600 text-white' : 'bg-transparent text-inksoft'}`}>📁 Carpeta de fotos</button>
            <button type="button" onClick={() => { setModo('sheet'); setNombreIA(false) }} className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold border-none ${modo === 'sheet' ? 'bg-indigo-600 text-white' : 'bg-transparent text-inksoft'}`}>📊 Google Sheet</button>
          </div>
          {modo === 'carpeta' ? (
            <>
          <div className="font-body text-xs text-ink mb-2">
            Elegí la carpeta con <strong>una subcarpeta por tienda</strong> y <strong>una foto por producto</strong>. Si usás <em>Google Drive para escritorio</em>, tus carpetas de Drive aparecen en la compu; si no, descargá la carpeta de Drive (ZIP) y descomprimila.
          </div>
          <div className="font-body text-[11px] text-inksoft bg-white rounded-md border border-indigo-100 p-2.5 mb-3 leading-relaxed">
            <strong>Cómo nombrar las fotos:</strong> <code>producto_público_precio_talles.jpg</code> — solo el producto es obligatorio.<br />
            Ej: <code>cachitos/blusa-flores_ninos_85_4-6-8.jpg</code> · <code>becca/sandalia-nizza_mujer_250_35-36-37_x4.jpg</code> (x4 = stock)<br />
            Más fotos del mismo producto: mismo nombre con <code>(2)</code>, <code>(3)</code>. También vale sin subcarpetas: <code>cachitos_blusa_ninos_85.jpg</code>.
          </div>
          <label className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white font-body text-sm font-semibold cursor-pointer">
            📁 Elegir carpeta
            <input ref={elegirCarpeta} type="file" multiple className="hidden" onChange={(e) => { elegirArchivos(e.target.files); e.target.value = '' }} />
          </label>
            </>
          ) : (
            <>
              <div className="font-body text-xs text-ink mb-2">
                Una fila por producto. Compartí la planilla como <strong>“Cualquier persona con el enlace: Lector”</strong> y pegá el link de la pestaña con los productos.
              </div>
              <div className="font-body text-[11px] text-inksoft bg-white rounded-md border border-indigo-100 p-2.5 mb-3 leading-relaxed">
                <strong>Columnas</strong> (en cualquier orden): <code>tienda</code>*, <code>producto</code>*, <code>precio</code>*, <code>público</code>, <code>talles</code>, <code>colores</code>, <code>stock</code>, <code>categoría</code>, <code>foto</code>, <code>precio antes</code>, <code>descripción</code>, <code>código</code>.<br />
                <strong>foto:</strong> el nombre del archivo (ej. <code>blusa-flores.jpg</code>) y abajo elegís la carpeta con las fotos, o un link (Drive compartido). Varias, separadas por coma.<br />
                <strong>categoría</strong> vacía = la elige la IA mirando la foto. <strong>código</strong> (opcional) = el código del producto en la tienda, para reconocerlo al reimportar.
              </div>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <input value={linkSheet} onChange={(e) => setLinkSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className="flex-1 min-w-[260px] px-3 py-2 rounded-lg border border-line font-body text-xs bg-white" />
                <label className="px-3 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-700 font-body text-xs font-semibold cursor-pointer">
                  {fotos.length ? `📁 ${fotos.filter((f) => /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.ruta)).length} fotos elegidas` : '📁 Carpeta de fotos (opcional)'}
                  <input ref={elegirCarpeta} type="file" multiple className="hidden" onChange={(e) => { const l = e.target.files; if (l?.length) setFotos(Array.from(l).map((file) => ({ file, ruta: (file as any).webkitRelativePath || file.name }))); e.target.value = '' }} />
                </label>
                <button type="button" onClick={leerLinkSheet} disabled={leyendoSheet || !linkSheet.trim()} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-40">
                  {leyendoSheet ? 'Leyendo…' : 'Leer planilla'}
                </button>
              </div>
              {errorSheet && <div className="font-body text-xs text-maroon">{errorSheet}</div>}
            </>
          )}
        </>
      )}

      {estado === 'tiendas' && (
        <>
          <div className="font-body text-xs text-ink mb-2">
            {modo === 'sheet' ? `${(filasSheet?.length || 1) - 1} filas` : `${fotos.length} archivos`} → <strong>{productos.length} productos</strong> en <strong>{tiendas.length} tienda{tiendas.length === 1 ? '' : 's'}</strong>
            {ignorados.length > 0 && (
              modo === 'sheet'
                ? <details className="mt-1 text-ochre"><summary className="cursor-pointer">⚠️ {ignorados.length} aviso{ignorados.length === 1 ? '' : 's'} de la planilla</summary><ul className="list-disc pl-5 text-[11px] text-inksoft">{ignorados.slice(0, 50).map((x) => <li key={x}>{x}</li>)}</ul></details>
                : <span className="text-inksoft" title={ignorados.join('\n')}> · {ignorados.length} archivos ignorados (no son fotos o no tienen nombre de producto)</span>
            )}
          </div>
          {modo === 'carpeta' && fotos.length > 0 && fotos.every((f) => f.ruta.split('/').filter(Boolean).length <= 2) && (
            <label className="flex items-center gap-2 font-body text-xs text-ink mb-2">
              <input type="checkbox" checked={unaTienda} onChange={(e) => setUnaTienda(e.target.checked)} className="accent-teal" />
              Todas las fotos son de una sola tienda: “{fotos[0]?.ruta.split('/')[0]}”
            </label>
          )}
          <div className="grid gap-2 mb-3">
            {tiendas.map((t) => {
              const asignado = nombreDe(codigos[t.codigo])
              return (
                <div key={t.codigo} className={`bg-white border rounded-lg p-2.5 ${incluir[t.codigo] === false ? 'opacity-50 border-line' : asignado ? 'border-teal' : 'border-ochre'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" checked={incluir[t.codigo] !== false} onChange={(e) => setIncluir((x) => ({ ...x, [t.codigo]: e.target.checked }))} className="accent-teal" aria-label={`Incluir ${t.codigo}`} />
                    <span className="font-body text-sm font-semibold text-ink">{t.codigo}</span>
                    <span className="font-body text-[11px] text-inksoft">{t.prods.length} producto{t.prods.length === 1 ? '' : 's'} · ej: {t.prods.slice(0, 2).map((p) => p.nombre).join(', ')}</span>
                    <span className="flex-1" />
                    <select
                      value={todosVendedores.some((v) => v.id === codigos[t.codigo]) ? codigos[t.codigo] : ''}
                      onChange={(e) => { if (e.target.value === '__nueva') { setCreando(t.codigo); setFormTienda({ nombreNegocio: capital(t.codigo), whatsapp: '', email: '', ciudad: 'potosi' }) } else asociar(t.codigo, e.target.value) }}
                      className="px-2 py-1.5 rounded-md border border-line font-body text-xs max-w-[260px]"
                      aria-label={`Vendedor de ${t.codigo}`}
                    >
                      <option value="">— ¿De qué tienda es? —</option>
                      <option value="__nueva">➕ Crear tienda nueva</option>
                      {todosVendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </div>
                  {creando === t.codigo && (
                    <div className="mt-2 grid sm:grid-cols-[1fr_130px_1fr_110px_auto] gap-2 items-center">
                      <input value={formTienda.nombreNegocio} onChange={(e) => setFormTienda((f) => ({ ...f, nombreNegocio: e.target.value }))} placeholder="Nombre de la tienda *" className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs" />
                      <input value={formTienda.whatsapp} onChange={(e) => setFormTienda((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="WhatsApp (opcional)" className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs" />
                      <input value={formTienda.email} onChange={(e) => setFormTienda((f) => ({ ...f, email: e.target.value }))} placeholder="Email (opcional)" className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs" />
                      <select value={formTienda.ciudad} onChange={(e) => setFormTienda((f) => ({ ...f, ciudad: e.target.value as CiudadId }))} className="px-2 py-1.5 rounded-md border border-line font-body text-xs">
                        {CIUDADES.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => crearTienda(t.codigo)} className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold">Crear</button>
                        <button type="button" onClick={() => setCreando(null)} className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">✕</button>
                      </div>
                      {errorTienda && <div className="sm:col-span-5 font-body text-[11px] text-maroon">{errorTienda}</div>}
                      <div className="sm:col-span-5 font-body text-[10px] text-inksoft">Sin email se le pone uno provisorio; cuando la tienda quiera entrar, se lo cambiás en Usuarios → Editar y le mandás el acceso.</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3 font-body text-xs text-ink">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={usarIA} onChange={(e) => setUsarIA(e.target.checked)} className="accent-teal" /> La IA mira cada foto (categoría, colores, descripción)</label>
            {usarIA && <label className="flex items-center gap-1.5"><input type="checkbox" checked={nombreIA} onChange={(e) => setNombreIA(e.target.checked)} className="accent-teal" /> Usar el nombre que propone la IA</label>}
            {existentesEncontrados > 0 && (
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} className="accent-teal" /> {existentesEncontrados} ya están publicados: actualizar su precio, stock y talles (no duplicarlos)</label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={procesar} disabled={!aProcesar.length || sinAsignar.length > 0} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-40">
              ✨ Procesar {aProcesar.length} producto{aProcesar.length === 1 ? '' : 's'}{actualizar && existentesEncontrados ? ` (${aProcesar.length - existentesEncontrados} nuevos + ${existentesEncontrados} a actualizar)` : ''}
            </button>
            <button type="button" onClick={() => { setFotos([]); setFilasSheet(null); setEstado('elegir') }} className="px-3 py-2 rounded-lg border border-line bg-white font-body text-xs text-ink">{modo === 'sheet' ? 'Otra planilla' : 'Elegir otra carpeta'}</button>
            {sinAsignar.length > 0 && <span className="font-body text-[11px] text-ochre">Falta decir de qué tienda es: {sinAsignar.map((t) => t.codigo).join(', ')} (o destildala).</span>}
            {usarIA && aProcesar.length > 20 && !sinAsignar.length && <span className="font-body text-[11px] text-inksoft">≈ {Math.ceil(aProcesar.length / 12)} min (límite gratis de la IA).</span>}
          </div>
        </>
      )}

      {(estado === 'procesando' || estado === 'listo') && (
        <div>
          <div className="h-2.5 rounded-full bg-white overflow-hidden mb-1.5"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%` }} /></div>
          <div className="flex flex-wrap items-center gap-2 font-body text-xs text-ink">
            <span>{avance.hechos} de {avance.total}{avance.errores ? ` · ${avance.errores} con error` : ''}</span>
            {estado === 'procesando' && <span className="text-inksoft truncate max-w-[50ch]">{avance.etapa}</span>}
            {estado === 'procesando' && <button type="button" onClick={() => { frenar.current = true }} className="px-3 py-1 rounded-md border border-line bg-white font-body text-xs">Frenar</button>}
            {estado === 'listo' && <span className="text-teal font-semibold">✓ Listo: {resumen.nuevos} nuevos (abajo, en verde){resumen.actualizados ? ` y ${resumen.actualizados} actualizaciones (en amarillo)` : ''}. Revisá y tocá “💾 Guardar cambios”.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
