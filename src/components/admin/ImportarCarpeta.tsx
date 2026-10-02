'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CIUDADES, type CiudadId } from '@/data/ciudades'
import { leerFotos, pareceUnaTienda, type FotoArchivo, type ProductoLeido } from '@/lib/importarCarpeta'
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
type Estado = 'elegir' | 'tiendas' | 'procesando' | 'listo'

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const capital = (t: string) => t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function ImportarCarpeta({
  password,
  vendedores,
  onVendedorCreado,
  onListo,
  onCerrar,
}: {
  password: string
  vendedores: Vendedor[]
  onVendedorCreado: () => void
  onListo: (filas: NuevoImportado[]) => void
  onCerrar: () => void
}) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [estado, setEstado] = useState<Estado>('elegir')
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
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (input.current) input.current.setAttribute('webkitdirectory', '')
    fetch('/api/admin/codigos-tiendas', { headers }).then((r) => r.json()).then((d) => setCodigos(d.codigos || {})).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todosVendedores = useMemo(() => [...vendedores, ...extras.filter((e) => !vendedores.some((v) => v.id === e.id))], [vendedores, extras])
  const { productos, ignorados } = useMemo(() => leerFotos(fotos, { unaTienda }), [fotos, unaTienda])
  const tiendas = useMemo(() => {
    const m = new Map<string, ProductoLeido[]>()
    for (const p of productos) m.set(p.tienda, [...(m.get(p.tienda) || []), p])
    return [...m.entries()].map(([codigo, prods]) => ({ codigo, prods }))
  }, [productos])
  const activas = tiendas.filter((t) => incluir[t.codigo] !== false)
  const sinAsignar = activas.filter((t) => !todosVendedores.some((v) => v.id === codigos[t.codigo]))
  const aProcesar = activas.flatMap((t) => t.prods)

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

  async function procesar() {
    frenar.current = false
    setEstado('procesando')
    const total = aProcesar.length
    setAvance({ hechos: 0, total, errores: 0, etapa: '' })
    // Cada resultado en su lugar: quedan en el orden de las carpetas.
    const filas: (NuevoImportado | undefined)[] = new Array(total)
    let hechos = 0
    let errores = 0
    const cola = aProcesar.map((p, i) => [p, i] as const)
    // 2 a la vez: rápido pero sin pasarse del límite gratis de la IA.
    const trabajador = async () => {
      while (cola.length && !frenar.current) {
        const [p, i] = cola.shift()!
        try {
          const [principal, ...resto] = p.fotos
          const foto = await subirFotoAdmin(password, principal)
          const fotosAdicionales: string[] = []
          for (const f of resto.slice(0, 4)) {
            try { fotosAdicionales.push((await subirFotoAdmin(password, f, false)).url) } catch {}
          }
          setAvance((a) => ({ ...a, etapa: `Analizando “${p.nombre}”…` }))
          const ia = usarIA ? await analizar(foto.url, p.archivo) : null
          filas[i] = {
            vendedorId: codigos[p.tienda],
            archivo: p.archivo,
            nombre: (nombreIA && ia?.nombre) || p.nombre,
            rubro: ia?.rubroId || '',
            publico: p.publico || ia?.publico || 'unisex',
            precio: p.precio != null ? String(p.precio) : '',
            precioOriginal: '',
            stock: p.stock != null ? String(p.stock) : '',
            talles: p.talles.join(', '),
            colores: (ia?.colores || []).join(', '),
            imagenUrl: foto.url,
            thumbUrl: foto.thumbUrl,
            fotosAdicionales,
            descripcionCorta: ia?.descripcion || '',
            error: usarIA && !ia?.rubroId ? 'La IA no pudo: elegí la categoría' : undefined,
          }
        } catch (err: any) {
          errores++
          filas[i] = {
            vendedorId: codigos[p.tienda], archivo: p.archivo, nombre: p.nombre, rubro: '', publico: p.publico || 'unisex',
            precio: p.precio != null ? String(p.precio) : '', precioOriginal: '', stock: p.stock != null ? String(p.stock) : '',
            talles: p.talles.join(', '), colores: '', error: `No se subió la foto: ${err?.message || 'error'}`,
          }
        }
        hechos++
        setAvance((a) => ({ ...a, hechos, errores }))
      }
    }
    await Promise.all([trabajador(), trabajador()])
    setEstado('listo')
    onListo(filas.filter((f): f is NuevoImportado => !!f))
  }

  const nombreDe = (id?: string) => todosVendedores.find((v) => v.id === id)?.nombre

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3.5 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-body text-sm font-semibold text-ink">📁 Importar productos desde una carpeta</div>
        {estado !== 'procesando' && <button type="button" onClick={onCerrar} className="font-body text-xs text-inksoft underline bg-transparent border-none">Cerrar</button>}
      </div>

      {estado === 'elegir' && (
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
            <input ref={input} type="file" multiple className="hidden" onChange={(e) => { elegirArchivos(e.target.files); e.target.value = '' }} />
          </label>
        </>
      )}

      {estado === 'tiendas' && (
        <>
          <div className="font-body text-xs text-ink mb-2">
            {fotos.length} archivos → <strong>{productos.length} productos</strong> en <strong>{tiendas.length} tienda{tiendas.length === 1 ? '' : 's'}</strong>
            {ignorados.length > 0 && <span className="text-inksoft" title={ignorados.join('\n')}> · {ignorados.length} archivos ignorados (no son fotos o no tienen nombre de producto)</span>}
          </div>
          {fotos.length > 0 && fotos.every((f) => f.ruta.split('/').filter(Boolean).length <= 2) && (
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={procesar} disabled={!aProcesar.length || sinAsignar.length > 0} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-40">
              ✨ Procesar {aProcesar.length} producto{aProcesar.length === 1 ? '' : 's'}
            </button>
            <button type="button" onClick={() => { setFotos([]); setEstado('elegir') }} className="px-3 py-2 rounded-lg border border-line bg-white font-body text-xs text-ink">Elegir otra carpeta</button>
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
            {estado === 'listo' && <span className="text-teal font-semibold">✓ Listo: quedaron abajo como productos nuevos (en verde). Revisá precios y categorías y tocá “💾 Guardar cambios”.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
