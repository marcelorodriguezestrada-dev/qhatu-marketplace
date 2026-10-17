'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { codigoTienda } from '@/lib/importarCarpeta'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'
import type { NuevoImportado } from '@/components/admin/EdicionRapidaProductos'

// Importar → "📲 Capturas de catálogo": para pasar a Clasi Click el
// catálogo de WhatsApp Business (o Instagram / Facebook) de una tienda,
// que no se puede exportar.
// 1. Elegís la tienda y subís capturas de pantalla del catálogo (de cada
//    producto abierto, o de la lista).
// 2. La IA lee cada captura: nombre, precio, precio tachado, descripción
//    y dónde está la foto (src/lib/fotoProductoIA.ts → leerCapturaCatalogo).
// 3. Revisás: corregís datos y, si hace falta, el recorte de la foto.
// 4. Se recorta cada foto acá en el navegador (de la captura original),
//    se sube, la IA elige la categoría y todo cae en la planilla en verde.

type Caja = { x: number; y: number; ancho: number; alto: number }
type Captura = { key: string; nombre: string; url: string; file: File; ancho: number; alto: number; leida?: boolean; error?: string }
type Item = {
  key: string
  captura: string // key de la captura
  nombre: string
  precio: string
  precioAntes: string
  descripcion: string
  caja: Caja
  cajaDudosa: boolean // la IA no la dio (o no es confiable): revisarla
  incluir: boolean
  existe?: string // nombre del producto que ya tiene la tienda
}
type Existente = { id: string; nombre: string; vendedorId?: string }

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
let contador = 0
const nuevaKey = (p: string) => `${p}${++contador}`

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = url
  })
}

// La captura achicada (para mandarla a la IA sin pasarse de tamaño).
async function capturaParaIA(c: Captura, max = 1600): Promise<string> {
  const img = await cargarImagen(c.url)
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = Math.round(img.naturalWidth * k)
  cv.height = Math.round(img.naturalHeight * k)
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', 0.85)
}

// Recorta la foto del producto de la captura ORIGINAL (mejor calidad).
async function recortar(c: Captura, caja: Caja, nombre: string): Promise<File> {
  const img = await cargarImagen(c.url)
  const sx = Math.round(caja.x * img.naturalWidth)
  const sy = Math.round(caja.y * img.naturalHeight)
  const sw = Math.max(1, Math.round(caja.ancho * img.naturalWidth))
  const sh = Math.max(1, Math.round(caja.alto * img.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = sw
  cv.height = sh
  cv.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.92))
  if (!blob) throw new Error('No se pudo recortar la foto.')
  return new File([blob], `${codigoTienda(nombre) || 'producto'}.jpg`, { type: 'image/jpeg' })
}

// Vista previa del recorte (sin canvas: la captura posicionada adentro de una caja).
function Recorte({ c, caja, size = 96 }: { c: Captura; caja: Caja; size?: number }) {
  const w = caja.ancho * c.ancho
  const h = caja.alto * c.alto
  const s = size / Math.max(w, h, 1)
  return (
    <div className="relative overflow-hidden rounded-md bg-panelalt shrink-0" style={{ width: Math.round(w * s), height: Math.round(h * s) }}>
      <img src={c.url} alt="" className="absolute max-w-none" style={{ width: c.ancho * s, height: c.alto * s, left: -caja.x * c.ancho * s, top: -caja.y * c.alto * s }} />
    </div>
  )
}

// Editor: la captura entera; arrastrás para marcar dónde está la foto.
function EditorRecorte({ c, caja, onListo, onCerrar }: { c: Captura; caja: Caja; onListo: (c: Caja) => void; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [actual, setActual] = useState<Caja>(caja)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const punto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) }
  }
  const mover = (e: React.PointerEvent) => {
    if (!inicio.current) return
    const p = punto(e)
    const a = inicio.current
    setActual({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), ancho: Math.abs(p.x - a.x), alto: Math.abs(p.y - a.y) })
  }
  // Cuadrado: muchas fotos de catálogo lo son (deja la misma altura en píxeles que el ancho).
  const cuadrar = () => setActual((a) => ({ ...a, alto: Math.min((a.ancho * c.ancho) / c.alto, 1 - a.y) }))
  const valido = actual.ancho > 0.03 && actual.alto > 0.02
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="bg-panel rounded-xl p-3 max-w-full max-h-full flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="font-body text-sm font-semibold text-ink">✂️ Arrastrá sobre la foto del producto</div>
        <div
          ref={ref}
          className="relative select-none touch-none cursor-crosshair self-center"
          style={{ height: 'min(70vh, 900px)', aspectRatio: `${c.ancho} / ${c.alto}` }}
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); inicio.current = punto(e); setActual({ ...punto(e), ancho: 0, alto: 0 }) }}
          onPointerMove={mover}
          onPointerUp={() => { inicio.current = null }}
        >
          <img src={c.url} alt="" draggable={false} className="w-full h-full pointer-events-none" />
          <div className="absolute border-2 border-teal bg-teal/15 pointer-events-none" style={{ left: `${actual.x * 100}%`, top: `${actual.y * 100}%`, width: `${actual.ancho * 100}%`, height: `${actual.alto * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' }} />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={cuadrar} disabled={!valido} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs disabled:opacity-40">⬛ Hacerlo cuadrado</button>
          <button type="button" onClick={() => setActual({ x: 0, y: 0, ancho: 1, alto: 1 })} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs">Toda la captura</button>
          <button type="button" onClick={onCerrar} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs">Cancelar</button>
          <button type="button" onClick={() => onListo(actual)} disabled={!valido} className="px-3 py-1.5 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-40">Usar este recorte</button>
        </div>
      </div>
    </div>
  )
}

export default function ImportarCapturas({
  password,
  vendedores,
  existentes,
  analizar,
  onListo,
}: {
  password: string
  vendedores: { id: string; nombre: string }[]
  existentes: Existente[]
  analizar: (imagenUrl: string, pista: string) => Promise<any | null>
  onListo: (filas: NuevoImportado[]) => void
}) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [vendedorId, setVendedorId] = useState('')
  const [capturas, setCapturas] = useState<Captura[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [estado, setEstado] = useState<'elegir' | 'leyendo' | 'revisar' | 'subiendo'>('elegir')
  const [avance, setAvance] = useState({ hechos: 0, total: 0, etapa: '' })
  const [usarIA, setUsarIA] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const frenar = useRef(false)

  // Las URLs de las capturas se liberan al cerrar.
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const porKey = useMemo(() => new Map(capturas.map((c) => [c.key, c])), [capturas])
  const elegidos = items.filter((i) => i.incluir)

  async function agregarArchivos(lista: FileList | null) {
    const nuevas: Captura[] = []
    for (const file of Array.from(lista || [])) {
      if (!file.type.startsWith('image/')) continue
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      try {
        const img = await cargarImagen(url)
        nuevas.push({ key: nuevaKey('c'), nombre: file.name, url, file, ancho: img.naturalWidth, alto: img.naturalHeight })
      } catch {
        setError(`No se pudo abrir “${file.name}” (¿es una foto HEIC? sacá la captura en JPG o PNG).`)
      }
    }
    setCapturas((prev) => [...prev, ...nuevas])
  }

  async function leerUna(c: Captura): Promise<{ vista: string; productos: any[] } | { error: string }> {
    const imagen = await capturaParaIA(c)
    for (let intento = 0; intento < 6; intento++) {
      const r = await fetch('/api/admin/productos/leer-captura', { method: 'POST', headers, body: JSON.stringify({ imagen }) })
      if (r.status === 429) {
        setAvance((a) => ({ ...a, etapa: '⏳ La IA gratis pide una pausa (límite por minuto), sigo en unos segundos…' }))
        await esperar(15000 + intento * 5000)
        continue
      }
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) return { error: d?.error || `error ${r.status}` }
      return d
    }
    return { error: 'la IA gratis siguió ocupada; probá de nuevo en un rato' }
  }

  async function leerTodas() {
    if (!vendedorId) return setError('Elegí la tienda.')
    setError('')
    frenar.current = false
    setEstado('leyendo')
    const pendientes = capturas.filter((c) => !c.leida)
    setAvance({ hechos: 0, total: pendientes.length, etapa: '' })
    const nuevos: Item[] = []
    let hechos = 0
    for (const c of pendientes) {
      if (frenar.current) break
      setAvance((a) => ({ ...a, etapa: `Leyendo “${c.nombre}”…` }))
      const r = await leerUna(c)
      if ('error' in r) {
        setCapturas((prev) => prev.map((x) => (x.key === c.key ? { ...x, error: r.error } : x)))
      } else {
        setCapturas((prev) => prev.map((x) => (x.key === c.key ? { ...x, leida: true, error: r.productos.length ? undefined : 'No encontramos productos' } : x)))
        for (const p of r.productos) {
          // Sin caja: en la vista de un producto la foto suele estar arriba, a todo el ancho.
          const caja: Caja = p.caja || (r.vista === 'detalle' ? { x: 0, y: 0.08, ancho: 1, alto: Math.min(0.6, c.ancho / c.alto) } : { x: 0, y: 0, ancho: 1, alto: 1 })
          nuevos.push({
            key: nuevaKey('i'),
            captura: c.key,
            nombre: p.nombre,
            precio: p.precio != null ? String(p.precio) : '',
            precioAntes: p.precioAntes != null ? String(p.precioAntes) : '',
            descripcion: p.descripcion || '',
            caja,
            cajaDudosa: !p.caja,
            incluir: true,
          })
        }
      }
      setAvance((a) => ({ ...a, hechos: ++hechos }))
    }
    setItems((prev) => unir([...prev, ...nuevos]))
    setEstado('revisar')
  }

  // El mismo producto en varias capturas (lista + detalle): queda el de la
  // foto más grande. Y se marcan los que la tienda ya tiene cargados.
  function unir(lista: Item[]): Item[] {
    const mejor = new Map<string, Item>()
    const px = (i: Item) => { const c = porKeyActual(i.captura); return c ? i.caja.ancho * c.ancho * i.caja.alto * c.alto : 0 }
    for (const i of lista) {
      const k = codigoTienda(i.nombre)
      const prev = mejor.get(k)
      if (!prev) { mejor.set(k, i); continue }
      const gana = px(i) > px(prev) ? i : prev
      const otro = gana === i ? prev : i
      mejor.set(k, { ...gana, precio: gana.precio || otro.precio, precioAntes: gana.precioAntes || otro.precioAntes, descripcion: gana.descripcion.length >= otro.descripcion.length ? gana.descripcion : otro.descripcion })
    }
    return Array.from(mejor.values()).map((i) => {
      const e = existentes.find((x) => x.vendedorId === vendedorId && codigoTienda(x.nombre) === codigoTienda(i.nombre))
      return e ? { ...i, existe: e.nombre, incluir: false } : i
    })
  }
  // (las capturas recién leídas todavía no están en el memo de este render)
  const capturasRef = useRef(capturas)
  capturasRef.current = capturas
  const porKeyActual = (k: string) => capturasRef.current.find((c) => c.key === k)

  const cambiar = (key: string, cambios: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...cambios } : i)))

  async function agregarALaPlanilla() {
    frenar.current = false
    setEstado('subiendo')
    setAvance({ hechos: 0, total: elegidos.length, etapa: '' })
    const filas: NuevoImportado[] = []
    let hechos = 0
    for (const i of elegidos) {
      if (frenar.current) break
      const c = porKey.get(i.captura)!
      const base: NuevoImportado = {
        vendedorId,
        archivo: `captura ${c.nombre}`,
        claveImportacion: `captura-${vendedorId.slice(0, 12)}::${codigoTienda(i.nombre)}`.slice(0, 120),
        nombre: i.nombre.trim(),
        rubro: '',
        publico: 'unisex',
        precio: i.precio,
        precioOriginal: Number(i.precioAntes) > Number(i.precio) ? i.precioAntes : '',
        stock: '',
        talles: '',
        colores: '',
        descripcionCorta: i.descripcion.slice(0, 300),
      }
      try {
        setAvance((a) => ({ ...a, etapa: `Subiendo la foto de “${i.nombre}”…` }))
        const foto = await subirFotoAdmin(password, await recortar(c, i.caja, i.nombre))
        let ia: any = null
        if (usarIA) {
          setAvance((a) => ({ ...a, etapa: `Eligiendo la categoría de “${i.nombre}”…` }))
          ia = await analizar(foto.url, i.nombre)
        }
        filas.push({
          ...base,
          imagenUrl: foto.url,
          thumbUrl: foto.thumbUrl,
          rubro: ia?.rubroId || '',
          publico: ia?.publico || 'unisex',
          colores: (ia?.colores || []).join(', '),
          descripcionCorta: base.descripcionCorta || ia?.descripcion || '',
          error: ia?.rubroId ? undefined : 'Elegí la categoría',
        })
      } catch (err: any) {
        filas.push({ ...base, error: `Foto: ${err?.message || 'no se pudo subir'}` })
      }
      setAvance((a) => ({ ...a, hechos: ++hechos }))
    }
    onListo(filas)
    // Lo que ya pasó a la planilla sale de la lista (por si se frenó a la mitad).
    const pasados = new Set(elegidos.slice(0, hechos).map((i) => i.key))
    setItems((prev) => prev.filter((i) => !pasados.has(i.key)))
    setEstado('revisar')
  }

  const editado = editando ? items.find((i) => i.key === editando) : null

  return (
    <div>
      <div className="font-body text-xs text-ink mb-2">
        Para pasar a Clasi Click el catálogo de <strong>WhatsApp Business</strong>, Instagram o Facebook de una tienda: sacá <strong>capturas de pantalla</strong> del catálogo y la IA lee nombre, precio, descripción y recorta la foto.
      </div>
      <div className="font-body text-[11px] text-inksoft bg-white rounded-md border border-indigo-100 p-2.5 mb-3 leading-relaxed">
        <strong>Cómo sacar las capturas:</strong> abrí el catálogo en tu celular (wa.me/c/número) y tocá cada producto: la captura del producto abierto da la <strong>mejor foto</strong> y la descripción completa. La captura de la lista sirve para muchos de una vez, pero la foto sale chica.
        <br />La tienda tiene que existir antes: creala en Usuarios → “➕ Crear usuario” con su ciudad (ej. Buenos Aires) y su WhatsApp.
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} disabled={estado === 'leyendo' || estado === 'subiendo' || items.length > 0} title={items.length ? 'Para otra tienda, agregá o descartá estos productos primero' : undefined} className="px-2.5 py-2 rounded-lg border border-line bg-white font-body text-sm max-w-[320px]">
          <option value="">— Elegí la tienda —</option>
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <label className={`inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white font-body text-sm font-semibold cursor-pointer ${estado === 'leyendo' || estado === 'subiendo' ? 'opacity-50 pointer-events-none' : ''}`}>
          📲 Elegir capturas
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { agregarArchivos(e.target.files); e.target.value = '' }} />
        </label>
        {capturas.length > 0 && <span className="font-body text-xs text-inksoft">{capturas.length} captura{capturas.length === 1 ? '' : 's'} · {capturas.filter((c) => c.leida).length} leída{capturas.filter((c) => c.leida).length === 1 ? '' : 's'}</span>}
      </div>

      {capturas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {capturas.map((c) => (
            <div key={c.key} className="relative shrink-0" title={c.error || c.nombre}>
              <img src={c.url} alt="" className={`h-24 rounded-md border ${c.error ? 'border-maroon' : c.leida ? 'border-teal' : 'border-line'}`} />
              <span className="absolute top-1 left-1 text-[11px]">{c.error ? '⚠️' : c.leida ? '✅' : ''}</span>
              {!c.leida && estado !== 'leyendo' && (
                <button type="button" onClick={() => setCapturas((prev) => prev.filter((x) => x.key !== c.key))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 border border-line text-[11px] leading-none" aria-label="Quitar">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {capturas.some((c) => !c.leida) && estado !== 'leyendo' && estado !== 'subiendo' && (
        <button type="button" onClick={leerTodas} disabled={!vendedorId} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-50 mb-3">
          🔍 Leer {capturas.filter((c) => !c.leida).length} captura{capturas.filter((c) => !c.leida).length === 1 ? '' : 's'} con IA
        </button>
      )}
      {error && <div className="font-body text-xs text-maroon mb-2">{error}</div>}

      {(estado === 'leyendo' || estado === 'subiendo') && (
        <div className="bg-white rounded-lg border border-indigo-100 p-3 mb-3">
          <div className="font-body text-xs text-ink mb-1.5">{estado === 'leyendo' ? 'Leyendo capturas' : 'Pasando a la planilla'}: {avance.hechos} de {avance.total}</div>
          <div className="h-2 rounded-full bg-indigo-100 overflow-hidden mb-1.5"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%` }} /></div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-body text-[11px] text-inksoft">{avance.etapa}</span>
            <button type="button" onClick={() => { frenar.current = true }} className="font-body text-[11px] text-maroon underline bg-transparent border-none">Frenar</button>
          </div>
        </div>
      )}

      {items.length > 0 && estado === 'revisar' && (
        <>
          <div className="font-body text-xs font-semibold text-ink mb-2">
            Revisá los {items.length} productos encontrados · {elegidos.length} para agregar
            {items.some((i) => i.cajaDudosa) && <span className="font-normal text-amber-700"> · los marcados con ⚠️ tienen el recorte adivinado: revisalo</span>}
          </div>
          <div className="grid gap-2 mb-3 max-h-[560px] overflow-y-auto pr-1">
            {items.map((i) => {
              const c = porKey.get(i.captura)
              if (!c) return null
              return (
                <div key={i.key} className={`flex gap-3 items-start bg-white rounded-lg border p-2.5 ${i.incluir ? 'border-indigo-200' : 'border-line opacity-60'}`}>
                  <input type="checkbox" checked={i.incluir} onChange={(e) => cambiar(i.key, { incluir: e.target.checked })} className="mt-1" aria-label="Incluir" />
                  <button type="button" onClick={() => setEditando(i.key)} className="relative bg-transparent border-none p-0" title="Ajustar el recorte">
                    <Recorte c={c} caja={i.caja} />
                    <span className="absolute bottom-0.5 right-0.5 bg-white/90 rounded px-1 text-[10px]">{i.cajaDudosa ? '⚠️ ✂️' : '✂️'}</span>
                  </button>
                  <div className="flex-1 min-w-0 grid gap-1.5">
                    <input value={i.nombre} onChange={(e) => cambiar(i.key, { nombre: e.target.value })} className="px-2 py-1.5 rounded-md border border-line font-body text-sm" aria-label="Nombre" />
                    <div className="flex flex-wrap gap-1.5">
                      <input value={i.precio} onChange={(e) => cambiar(i.key, { precio: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Precio" inputMode="decimal" className="w-28 px-2 py-1.5 rounded-md border border-line font-body text-sm" aria-label="Precio" />
                      <input value={i.precioAntes} onChange={(e) => cambiar(i.key, { precioAntes: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Precio antes" inputMode="decimal" className="w-28 px-2 py-1.5 rounded-md border border-line font-body text-sm" aria-label="Precio antes (tachado)" />
                      {!i.precio && <span className="font-body text-[11px] text-maroon self-center">Falta el precio</span>}
                      {i.existe && <span className="font-body text-[11px] text-amber-700 self-center">Ya está cargado como “{i.existe}”</span>}
                    </div>
                    <textarea value={i.descripcion} onChange={(e) => cambiar(i.key, { descripcion: e.target.value })} rows={2} placeholder="Descripción" className="px-2 py-1.5 rounded-md border border-line font-body text-xs" aria-label="Descripción" />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={agregarALaPlanilla} disabled={!elegidos.length || !vendedorId} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold disabled:opacity-50">
              ➕ Agregar {elegidos.length} a la planilla
            </button>
            <label className="flex items-center gap-1.5 font-body text-xs text-ink">
              <input type="checkbox" checked={usarIA} onChange={(e) => setUsarIA(e.target.checked)} /> Categoría, público y colores con IA
            </label>
          </div>
          <div className="font-body text-[11px] text-inksoft mt-2">Quedan en la planilla en verde, sin publicar: revisá la categoría y tocá “Guardar cambios”.</div>
        </>
      )}

      {editado && porKey.get(editado.captura) && (
        <EditorRecorte
          c={porKey.get(editado.captura)!}
          caja={editado.caja}
          onCerrar={() => setEditando(null)}
          onListo={(caja) => { cambiar(editado.key, { caja, cajaDudosa: false }); setEditando(null) }}
        />
      )}
    </div>
  )
}
