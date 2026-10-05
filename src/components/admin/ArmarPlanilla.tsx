'use client'

import { useMemo, useRef, useState } from 'react'
import { leerFotos, nombreGenerico, pareceUnaTienda, type FuenteFoto, type ProductoLeido } from '@/lib/importarCarpeta'
import { armarFilas, descargarPlanilla, rutaDe, type FilaPlanilla, type RubroPlano } from '@/lib/armarPlanilla'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'

// Importar → "🧾 Armar planilla": cuando no hay planilla, se arma desde la
// carpeta de fotos (de Drive o de la compu). Sale un .xlsx con una fila
// por producto (tienda, nombre, público, colores y categoría adivinados
// del nombre de la foto, link a la foto y miniatura) para completar los
// precios y volver a importar desde "Google Sheet".

const idDrive = (link: string) => link.match(/\/file\/d\/([\w-]+)/)?.[1]

export default function ArmarPlanilla({ password, rubros, onUsarSheet }: { password: string; rubros: RubroPlano[]; onUsarSheet: () => void }) {
  const [fuente, setFuente] = useState<'drive' | 'compu'>('drive')
  const [link, setLink] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const [fotos, setFotos] = useState<FuenteFoto[]>([])
  const [origen, setOrigen] = useState('')
  const [subir, setSubir] = useState(true)
  const [unaTienda, setUnaTienda] = useState(false)
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null)
  const [filas, setFilas] = useState<FilaPlanilla[] | null>(null)
  const [unificadas, setUnificadas] = useState<[string, string][]>([])
  const [descargada, setDescargada] = useState(false)
  // Nombre de tienda que quiere el admin para cada tienda detectada ("Gemini" → "Zapatería Ana").
  const [renombres, setRenombres] = useState<Record<string, string>>({})
  const [ia, setIa] = useState<{ hechos: number; total: number; etapa: string } | null>(null)
  const frenar = useRef(false)
  const elegirCarpeta = (el: HTMLInputElement | null) => { if (el) el.setAttribute('webkitdirectory', '') }

  const lectura = useMemo(() => (fotos.length ? leerFotos(fotos, { unaTienda }) : null), [fotos, unaTienda])
  const sinSubcarpetas = fotos.length > 0 && fotos.every((f) => f.ruta.split('/').filter(Boolean).length <= 2)
  const deCompu = fotos.some((f) => f.file)

  function armar(productos: ProductoLeido[], fotoDe: (p: ProductoLeido) => { links: string[]; vista?: string }) {
    const r = armarFilas(productos, rubros, fotoDe)
    setFilas(r.filas)
    setUnificadas(r.unificadas)
    setDescargada(false)
  }

  async function leerDrive() {
    setError('')
    setLeyendo(true)
    try {
      const d = await fetch('/api/admin/carpeta-drive', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ url: link.trim() }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      // Drive guarda fotos sin extensión ("Tienda_producto"): se la ponemos para reconocerlas.
      const fs: FuenteFoto[] = d.fotos.map((f: { id: string; ruta: string }) => ({ ruta: /\.\w{3,4}$/.test(f.ruta) ? f.ruta : `${f.ruta}.jpg`, link: `https://drive.google.com/file/d/${f.id}/view` }))
      setFotos(fs)
      setOrigen(`la carpeta de Drive “${d.carpeta || 'Drive'}”`)
      const l = leerFotos(fs, { unaTienda: pareceUnaTienda(fs) })
      armar(l.productos, (p) => {
        const id = idDrive(p.fotosLink?.[0] || '')
        return { links: p.fotosLink || [], vista: id ? `https://drive.google.com/thumbnail?id=${id}&sz=w200` : undefined }
      })
    } catch (err: any) {
      setError(err?.message || 'No se pudo leer la carpeta.')
    } finally {
      setLeyendo(false)
    }
  }

  function elegirCompu(lista: FileList | null) {
    if (!lista?.length) return
    const fs: FuenteFoto[] = Array.from(lista).map((file) => ({ file, ruta: (file as any).webkitRelativePath || file.name }))
    setFotos(fs)
    setUnaTienda(pareceUnaTienda(fs))
    setOrigen(`la carpeta “${fs[0].ruta.split('/')[0]}”`)
    setFilas(null)
    setError('')
  }

  // Desde la compu: se suben las fotos para que la planilla tenga links
  // (se ven en la columna vista y al importar no hace falta la carpeta).
  async function armarDeCompu() {
    if (!lectura) return
    const productos = lectura.productos
    if (!subir) {
      armar(productos, (p) => ({ links: p.fotos.map((f) => f.name) }))
      return
    }
    frenar.current = false
    const links = new Map<ProductoLeido, { links: string[]; vista?: string }>()
    const cola = [...productos]
    let hechos = 0
    setAvance({ hechos: 0, total: productos.length })
    const trabajador = async () => {
      while (cola.length && !frenar.current) {
        const p = cola.shift()!
        const subidas: { url: string; thumbUrl: string }[] = []
        for (const f of p.fotos.slice(0, 5)) {
          try { subidas.push(await subirFotoAdmin(password, f, subidas.length === 0)) } catch { /* se pone el nombre del archivo */ }
        }
        links.set(p, subidas.length ? { links: subidas.map((s) => s.url), vista: subidas[0].thumbUrl } : { links: p.fotos.map((f) => f.name) })
        setAvance({ hechos: ++hechos, total: productos.length })
      }
    }
    await Promise.all([trabajador(), trabajador(), trabajador()])
    setAvance(null)
    armar(productos, (p) => links.get(p) || { links: p.fotos.map((f) => f.name) })
  }

  // "✨ Completar con IA": mira cada foto y completa el nombre (si es de
  // cámara/IA), la categoría, los colores, el público y la descripción.
  async function completarConIA() {
    if (!filas) return
    const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
    const porId = new Map(rubros.map((r) => [r.id, r]))
    const pendientes = filas.map((f, i) => [f, i] as const).filter(([f]) => /^https:\/\//.test(f.fotos[0] || '') && (nombreGenerico(f.producto) || !f.categoria || !f.descripcion))
    if (!pendientes.length) return
    frenar.current = false
    const nuevas = [...filas]
    let hechos = 0
    setIa({ hechos: 0, total: pendientes.length, etapa: '' })
    const cola = [...pendientes]
    const trabajador = async () => {
      while (cola.length && !frenar.current) {
        const [f, i] = cola.shift()!
        let d: any = null
        for (let intento = 0; intento < 6 && !frenar.current; intento++) {
          const r = await fetch('/api/admin/productos/analizar-foto', { method: 'POST', headers, body: JSON.stringify({ imagenUrl: f.fotos[0], pista: nombreGenerico(f.producto) ? '' : f.producto }) }).catch(() => null)
          if (r?.status === 429) { setIa((x) => x && { ...x, etapa: '⏳ La IA gratis pide una pausa, sigo en unos segundos…' }); await new Promise((ok) => setTimeout(ok, 15000 + intento * 5000)); continue }
          d = r && r.ok ? await r.json().catch(() => null) : null
          break
        }
        if (d) {
          const rubro = d.rubroId ? porId.get(d.rubroId) : undefined
          nuevas[i] = {
            ...f,
            producto: nombreGenerico(f.producto) && d.nombre ? d.nombre : f.producto,
            categoria: f.categoria || (rubro ? rutaDe(rubro) : ''),
            colores: f.colores || (d.colores || []).join(', '),
            publico: f.publico || ({ mujer: 'mujer', hombre: 'hombre', ninos: 'niños', unisex: 'unisex' } as Record<string, string>)[d.publico] || '',
            descripcion: f.descripcion || d.descripcion || '',
          }
          setFilas([...nuevas])
        }
        hechos++
        setIa((x) => x && { ...x, hechos, etapa: '' })
      }
    }
    await Promise.all([trabajador(), trabajador()])
    setIa(null)
    setDescargada(false)
  }

  async function descargar() {
    if (!filas) return
    const fecha = new Date().toISOString().slice(0, 10)
    const conTiendas = filas.map((f) => (renombres[f.tienda]?.trim() ? { ...f, tienda: renombres[f.tienda].trim() } : f))
    await descargarPlanilla(conTiendas, `productos-clasiclick-${fecha}.xlsx`, origen, unificadas)
    setDescargada(true)
  }

  const sinCategoria = filas?.filter((f) => !f.categoria).length || 0
  const sinPrecio = filas?.filter((f) => f.precio == null).length || 0
  const tiendas = filas ? [...new Set(filas.map((f) => f.tienda))] : []
  const conNombreDeFoto = filas?.filter((f) => nombreGenerico(f.producto)).length || 0
  const paraIA = filas?.filter((f) => /^https:\/\//.test(f.fotos[0] || '') && (nombreGenerico(f.producto) || !f.categoria || !f.descripcion)).length || 0

  return (
    <div>
      <div className="font-body text-xs text-ink mb-2">
        ¿No tenés planilla? La armamos desde la carpeta de fotos: <strong>una fila por producto</strong> con la tienda, el nombre, el público, los colores y la categoría (adivinados del nombre de la foto), el link a la foto y la miniatura. Vos completás los <strong>precios</strong> y la importás desde “📊 Google Sheet”.
      </div>
      <div className="font-body text-[11px] text-inksoft bg-white rounded-md border border-indigo-100 p-2.5 mb-3 leading-relaxed">
        Nombrá las fotos <code>tienda_producto</code> (ej. <code>Caprichitos_ajuar RN</code>) o poné una subcarpeta por tienda. Si sabés el precio o los talles, sumalos al nombre: <code>Mary_vestido niña_120_4-6-8</code>.
      </div>
      <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 w-fit border border-indigo-100">
        <button type="button" onClick={() => { setFuente('drive'); setFotos([]); setFilas(null); setError('') }} className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold border-none ${fuente === 'drive' ? 'bg-indigo-600 text-white' : 'bg-transparent text-inksoft'}`}>Carpeta de Drive</button>
        <button type="button" onClick={() => { setFuente('compu'); setFotos([]); setFilas(null); setError('') }} className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold border-none ${fuente === 'compu' ? 'bg-indigo-600 text-white' : 'bg-transparent text-inksoft'}`}>Carpeta de la compu</button>
      </div>

      {fuente === 'drive' ? (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-1.5">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="flex-1 min-w-[260px] px-3 py-2 rounded-lg border border-line font-body text-xs bg-white" />
            <button type="button" onClick={leerDrive} disabled={leyendo || !link.trim()} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-40">
              {leyendo ? 'Leyendo…' : 'Leer carpeta'}
            </button>
          </div>
          <div className="font-body text-[11px] text-inksoft mb-2">La carpeta tiene que estar compartida como <strong>“Cualquier persona con el enlace: Lector”</strong> (si no, ni la miniatura ni la importación pueden ver las fotos).</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <label className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white font-body text-sm font-semibold cursor-pointer">
            📁 {fotos.length ? 'Elegir otra carpeta' : 'Elegir carpeta'}
            <input ref={elegirCarpeta} type="file" multiple className="hidden" onChange={(e) => { elegirCompu(e.target.files); e.target.value = '' }} />
          </label>
          {lectura && !filas && !avance && (
            <>
              <span className="font-body text-xs text-ink" title={lectura.ignorados.join('\n')}>{lectura.productos.length} productos en {new Set(lectura.productos.map((p) => p.tienda)).size} tienda(s){lectura.ignorados.length ? ` · ${lectura.ignorados.length} archivos ignorados (sin “tienda_producto” o no son fotos)` : ''}</span>
              {sinSubcarpetas && (
                <label className="flex items-center gap-1.5 font-body text-xs text-ink">
                  <input type="checkbox" checked={unaTienda} onChange={(e) => setUnaTienda(e.target.checked)} className="accent-teal" />
                  Son todas de una sola tienda: “{fotos[0]?.ruta.split('/')[0]}”
                </label>
              )}
              <label className="flex items-center gap-1.5 font-body text-xs text-ink">
                <input type="checkbox" checked={subir} onChange={(e) => setSubir(e.target.checked)} className="accent-teal" />
                Subir las fotos (se ven en la planilla y al importar no hace falta elegir la carpeta)
              </label>
              <button type="button" onClick={armarDeCompu} disabled={!lectura.productos.length} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold disabled:opacity-40">Armar planilla</button>
            </>
          )}
        </div>
      )}
      {error && <div className="font-body text-xs text-maroon mb-2">{error}</div>}

      {avance && (
        <div className="mb-2">
          <div className="h-2.5 rounded-full bg-white overflow-hidden mb-1"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${(avance.hechos / Math.max(1, avance.total)) * 100}%` }} /></div>
          <div className="flex items-center gap-2 font-body text-xs text-ink">
            Subiendo fotos: {avance.hechos} de {avance.total}
            <button type="button" onClick={() => { frenar.current = true }} className="px-3 py-1 rounded-md border border-line bg-white font-body text-xs">Frenar</button>
          </div>
        </div>
      )}

      {filas && (
        <div className="mt-2">
          <div className="font-body text-xs text-ink mb-1.5">
            <strong>{filas.length} productos</strong> en <strong>{tiendas.length} tienda{tiendas.length === 1 ? '' : 's'}</strong> ({tiendas.join(', ')}).{' '}
            {sinCategoria ? <span className="text-ochre">{sinCategoria} sin categoría (la elige la IA al importar).</span> : 'Todos con categoría.'}{' '}
            {sinPrecio ? <span>Falta el precio en {sinPrecio}.</span> : null}
            {unificadas.length > 0 && <div className="text-inksoft text-[11px]">Tiendas unificadas: {unificadas.map(([a, b]) => `“${a}” → “${b}”`).join(', ')}.</div>}
          </div>
          {/* Tienda: se puede cambiar (ej. "Gemini" salió del nombre de la foto). */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {tiendas.map((t) => (
              <label key={t} className="flex items-center gap-1.5 bg-white border border-indigo-100 rounded-md px-2 py-1 font-body text-[11px] text-inksoft">
                Tienda “{t}” →
                <input value={renombres[t] ?? t} onChange={(e) => setRenombres((r) => ({ ...r, [t]: e.target.value }))} className="px-2 py-1 rounded border border-line font-body text-xs text-ink w-40" aria-label={`Nombre de la tienda ${t}`} />
              </label>
            ))}
          </div>
          {paraIA > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2 bg-indigo-50 border border-indigo-200 rounded-md px-2.5 py-2">
              <span className="font-body text-[11px] text-ink">
                {conNombreDeFoto ? <><strong>{conNombreDeFoto}</strong> con nombre de foto (ej. “{filas.find((f) => nombreGenerico(f.producto))!.producto.slice(0, 28)}”). </> : null}
                La IA puede mirar cada foto y completar el nombre, la categoría, los colores y la descripción.
              </span>
              {ia ? (
                <>
                  <span className="font-body text-[11px] text-indigo-700 font-semibold">✨ {ia.hechos} de {ia.total}{ia.etapa ? ` · ${ia.etapa}` : ''}</span>
                  <button type="button" onClick={() => { frenar.current = true }} className="px-2.5 py-1 rounded-md border border-line bg-white font-body text-xs">Frenar</button>
                </>
              ) : (
                <button type="button" onClick={completarConIA} className="px-3 py-1.5 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold">✨ Completar con IA ({paraIA}{paraIA > 20 ? ` · ≈ ${Math.ceil(paraIA / 12)} min` : ''})</button>
              )}
            </div>
          )}
          <div className="max-h-64 overflow-auto bg-white border border-indigo-100 rounded-md mb-2">
            <table className="w-full font-body text-[11px]">
              <thead className="sticky top-0 bg-panelalt text-inksoft text-left">
                <tr><th className="px-2 py-1">Tienda</th><th className="px-2 py-1">Producto</th><th className="px-2 py-1">Público</th><th className="px-2 py-1">Categoría</th><th className="px-2 py-1">Fotos</th></tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-2 py-1 whitespace-nowrap">{renombres[f.tienda]?.trim() || f.tienda}</td>
                    <td className={`px-2 py-1 ${nombreGenerico(f.producto) ? 'text-ochre' : ''}`}>{f.producto}{f.descripcion && <span className="block text-[10px] text-inksoft truncate max-w-[260px]">{f.descripcion}</span>}</td>
                    <td className="px-2 py-1">{f.publico || '—'}</td>
                    <td className="px-2 py-1">{f.categoria ? f.categoria.split(' > ').slice(-2).join(' › ') : <span className="text-ochre">la IA</span>}</td>
                    <td className="px-2 py-1 text-center">{f.fotos.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={descargar} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold">⬇️ Descargar planilla (.xlsx)</button>
            {descargada && <button type="button" onClick={onUsarSheet} className="px-3 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-700 font-body text-xs font-semibold">Ya la subí → importar desde Google Sheet</button>}
          </div>
          <div className="font-body text-[11px] text-inksoft mt-2 leading-relaxed">
            Después: subí el archivo a Google Drive → <strong>Abrir con Google Sheets</strong>, completá los precios, compartila como “Cualquier persona con el enlace: Lector” y pegá el link en “📊 Google Sheet”.
            {deCompu && !subir ? ' Como las fotos van por nombre de archivo, al importar elegí también la carpeta.' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
