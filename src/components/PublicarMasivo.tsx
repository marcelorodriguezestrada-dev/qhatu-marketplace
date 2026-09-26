'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'
import { COLUMNAS_PLANILLA, MAX_FILAS_PLANILLA, leerFilas, normalizarTexto, type FilaLeida } from '@/lib/planillaProductos'

// /vender → "Publicar con Excel": 1) descargar la plantilla (con la hoja
// de categorías válidas), 2) subirla completa, 3) revisar fila por fila
// qué se va a publicar y qué tiene errores, 4) publicar todo. Cada fila
// se publica con la misma API que el formulario (mismas validaciones).

function iconoPara(categoria: string): string {
  const c = normalizarTexto(categoria)
  if (/calzad|zapat|bot|sandal/.test(c)) return 'shoe'
  if (/ropa|chomp|abrig|tejid/.test(c)) return 'sweater'
  if (/gorr|sombr/.test(c)) return 'hat'
  return 'bag'
}

export default function PublicarMasivo({ misProductos, alTerminar }: { misProductos: { nombre?: string }[]; alTerminar: () => void }) {
  const { usuario, obtenerToken } = useAuth()
  const { rubrosFlat } = useCategoriasProductos()
  const [filas, setFilas] = useState<FilaLeida[]>([])
  const [archivo, setArchivo] = useState('')
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [saltearExistentes, setSaltearExistentes] = useState(true)
  const [publicando, setPublicando] = useState(false)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [resultado, setResultado] = useState<{ ok: number; fallidos: { fila: number; nombre: string; error: string }[] } | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  async function descargarPlantilla() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const ejemplo = rubrosFlat[0]?.label || 'Botines'
    const encabezado = COLUMNAS_PLANILLA.map((c) => ({ value: c.titulo, fontWeight: 'bold' as const, backgroundColor: '#DCEBE5' }))
    const filaEjemplo = COLUMNAS_PLANILLA.map((c) => ({ value: c.clave === 'rubro' ? ejemplo : c.ejemplo === '' ? null : c.ejemplo }))
    const categorias = [
      [{ value: 'Grupo', fontWeight: 'bold' as const }, { value: 'Categoría (copiala tal cual en la columna "Categoría")', fontWeight: 'bold' as const }],
      ...rubrosFlat.map((r) => [{ value: r.categoriaLabel }, { value: r.label }]),
    ]
    const instrucciones = [
      [{ value: 'Cómo completar la planilla', fontWeight: 'bold' as const }],
      [{ value: '1. Completá una fila por producto en la hoja "Productos" (borrá la fila de ejemplo).' }],
      [{ value: '2. Obligatorios: Nombre, Precio Bs y Categoría (copiala de la hoja "Categorías").' }],
      [{ value: '3. "Para": Mujer, Hombre, Niños o Unisex. Talles y colores separados por coma.' }],
      [{ value: '4. Stock vacío = no se controla. Foto: un link https (opcional); después podés subir fotos desde "Editar".' }],
      [{ value: `5. Hasta ${MAX_FILAS_PLANILLA} productos por planilla. Guardá como .xlsx y subila en Clasi Click → Vender → Publicar con Excel.` }],
    ]
    await writeXlsxFile([
      { data: [encabezado, filaEjemplo], sheet: 'Productos', columns: COLUMNAS_PLANILLA.map((c) => ({ width: c.ancho })) },
      { data: categorias, sheet: 'Categorías', columns: [{ width: 24 }, { width: 40 }] },
      { data: instrucciones, sheet: 'Instrucciones', columns: [{ width: 100 }] },
    ] as any).toFile('plantilla-productos-clasiclick.xlsx')
  }

  async function leerArchivo(file: File | null | undefined) {
    if (!file) return
    setError('')
    setResultado(null)
    setFilas([])
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Subí el archivo en formato .xlsx (en Excel: Archivo → Guardar como → Libro de Excel .xlsx).')
      return
    }
    setLeyendo(true)
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const datos = (await readSheet(file, 'Productos').catch(() => readSheet(file))) as unknown[][]
      const r = leerFilas(datos, rubrosFlat, misProductos.map((p) => p.nombre || ''))
      if (r.error) setError(r.error)
      setFilas(r.filas)
      setArchivo(file.name)
    } catch {
      setError('No pudimos leer el archivo. Revisá que sea la plantilla en .xlsx y que no esté protegida con contraseña.')
    } finally {
      setLeyendo(false)
    }
  }

  const aPublicar = filas.filter((f) => f.datos && !(saltearExistentes && f.avisos.some((a) => a.startsWith('Ya tenés'))))
  const conError = filas.filter((f) => !f.datos)

  async function publicarTodo() {
    if (aPublicar.length === 0) return
    setPublicando(true)
    setProgreso({ hechos: 0, total: aPublicar.length })
    const fallidos: { fila: number; nombre: string; error: string }[] = []
    let ok = 0
    const token = await obtenerToken()
    for (const f of aPublicar) {
      try {
        const categoria = rubrosFlat.find((r) => r.id === f.datos!.rubro)?.categoriaLabel || ''
        const res = await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...f.datos, icono: iconoPara(categoria) }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        ok++
      } catch (e: any) {
        fallidos.push({ fila: f.fila, nombre: f.datos!.nombre, error: e?.message || 'Error al publicar' })
      }
      setProgreso((p) => ({ ...p, hechos: p.hechos + 1 }))
    }
    setResultado({ ok, fallidos })
    setPublicando(false)
    setFilas([])
    alTerminar()
  }

  return (
    <div className="bg-panel border border-teal rounded-xl p-5 mb-6">
      <div className="font-display text-lg font-bold text-ink mb-1">📊 Publicar varios productos con Excel</div>
      <div className="font-body text-xs text-inksoft mb-4">Hasta {MAX_FILAS_PLANILLA} productos por planilla. Se publican al instante, igual que desde el formulario.</div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-teal text-white font-body text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <button type="button" onClick={descargarPlantilla} disabled={rubrosFlat.length === 0} className="px-3.5 py-2 rounded-lg border border-teal bg-panel text-teal font-body text-sm font-semibold disabled:opacity-50">
            ⬇ Descargar plantilla
          </button>
          <span className="font-body text-[11px] text-inksoft">Trae la lista de categorías válidas y un ejemplo.</span>
        </div>

        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-teal text-white font-body text-xs font-bold flex items-center justify-center shrink-0 mt-1">2</span>
          <label
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); leerArchivo(e.dataTransfer.files?.[0]) }}
            className={`flex-1 border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer ${arrastrando ? 'border-teal bg-tealsoft' : 'border-line bg-panelalt'}`}
          >
            <div className="font-body text-sm text-ink">
              <span className="text-teal font-semibold">Seleccionar</span> o arrastrar la planilla completa aquí
            </div>
            <div className="font-body text-[11px] text-inksoft mt-1">{leyendo ? 'Leyendo...' : archivo ? `Archivo: ${archivo}` : 'Formato .xlsx'}</div>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { leerArchivo(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {error && <div className="font-body text-sm text-maroon bg-maroonsoft border border-maroon rounded-lg px-3 py-2 mt-4">{error}</div>}

      {filas.length > 0 && (
        <div className="mt-4">
          <div className="flex items-start gap-3 mb-2">
            <span className="w-6 h-6 rounded-full bg-teal text-white font-body text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <div className="font-body text-sm text-ink">
              Revisá: <strong className="text-teal">{aPublicar.length} para publicar</strong>
              {conError.length > 0 && <> · <strong className="text-maroon">{conError.length} con errores</strong> (no se publican: corregilas en el Excel y volvé a subirlo)</>}
            </div>
          </div>
          {filas.some((f) => f.avisos.some((a) => a.startsWith('Ya tenés'))) && (
            <label className="flex items-center gap-2 font-body text-xs text-ink mb-2 ml-9 cursor-pointer">
              <input type="checkbox" checked={saltearExistentes} onChange={(e) => setSaltearExistentes(e.target.checked)} className="accent-teal" />
              Saltear los que ya tenés publicados con el mismo nombre
            </label>
          )}
          <div className="max-h-80 overflow-y-auto border border-line rounded-lg">
            <table className="w-full font-body text-xs">
              <thead className="bg-panelalt sticky top-0">
                <tr className="text-left text-inksoft">
                  <th className="px-2 py-1.5">Fila</th>
                  <th className="px-2 py-1.5">Producto</th>
                  <th className="px-2 py-1.5 text-right">Precio</th>
                  <th className="px-2 py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const salteada = f.datos && !aPublicar.includes(f)
                  return (
                    <tr key={f.fila} className="border-t border-line align-top">
                      <td className="px-2 py-1.5 text-inksoft">{f.fila}</td>
                      <td className="px-2 py-1.5 text-ink">
                        {f.datos?.nombre || <span className="text-inksoft">—</span>}
                        {f.datos && <div className="text-[10px] text-inksoft">{rubrosFlat.find((r) => r.id === f.datos!.rubro)?.label}{typeof f.datos.stock === 'number' ? ` · stock ${f.datos.stock}` : ''}</div>}
                      </td>
                      <td className="px-2 py-1.5 text-right text-ink">{f.datos ? `Bs ${f.datos.precio}` : ''}</td>
                      <td className="px-2 py-1.5">
                        {f.errores.map((e) => <div key={e} className="text-maroon">✗ {e}</div>)}
                        {!f.errores.length && !salteada && <div className="text-teal font-semibold">✓ Se publica</div>}
                        {salteada && <div className="text-inksoft">Se saltea</div>}
                        {f.avisos.map((a) => <div key={a} className="text-ochre">⚠ {a}</div>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="w-6 h-6 rounded-full bg-teal text-white font-body text-xs font-bold flex items-center justify-center shrink-0">4</span>
            <button type="button" onClick={publicarTodo} disabled={publicando || aPublicar.length === 0} className="px-5 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-50">
              {publicando ? `Publicando ${progreso.hechos} de ${progreso.total}...` : `Publicar ${aPublicar.length} producto${aPublicar.length === 1 ? '' : 's'}`}
            </button>
          </div>
          {publicando && (
            <div className="h-2 rounded-full bg-panelalt border border-line overflow-hidden mt-2">
              <div className="h-full bg-teal transition-all" style={{ width: `${progreso.total ? (progreso.hechos / progreso.total) * 100 : 0}%` }} />
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="bg-tealsoft border-2 border-teal rounded-xl p-4 mt-4">
          <div className="font-display text-base font-bold text-ink mb-1">
            ✅ ¡Listo! Se publicaron {resultado.ok} producto{resultado.ok === 1 ? '' : 's'}
          </div>
          {resultado.fallidos.length > 0 && (
            <div className="font-body text-xs text-maroon mb-2">
              No se pudieron publicar {resultado.fallidos.length}:
              {resultado.fallidos.map((f) => <div key={f.fila}>Fila {f.fila} ({f.nombre}): {f.error}</div>)}
            </div>
          )}
          <div className="font-body text-xs text-inksoft mb-3">Ya aparecen en el catálogo. Podés agregarles fotos desde &quot;Editar&quot; en tu lista de productos.</div>
          <div className="flex flex-wrap gap-2">
            <Link href={usuario ? `/tienda/${usuario.uid}` : '/'} className="px-4 py-2 rounded-lg bg-teal text-white font-body text-sm font-semibold">🛍️ Ver mi catálogo</Link>
            <button type="button" onClick={() => { setResultado(null); setArchivo('') }} className="px-4 py-2 rounded-lg border border-teal bg-panel text-teal font-body text-sm font-semibold">📊 Subir otra planilla</button>
          </div>
        </div>
      )}
    </div>
  )
}
