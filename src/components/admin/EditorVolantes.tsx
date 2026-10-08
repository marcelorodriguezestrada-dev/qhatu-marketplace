'use client'

import { useEffect, useState } from 'react'
import { buscarCiudad, type CiudadId } from '@/data/ciudades'
import { useTodasLasCiudades } from '@/lib/ciudad'
import { gentilicioDe } from '@/lib/marketingAdmin'
import { TEMAS_VOLANTE, codificarConfig, destinoDeTipo, textosBase, type ConfigVolante, type PosQR } from '@/lib/volantes'

// Admin → Marketing → "🖼️ Volantes e imágenes":
// - Nuestro diseño con temas de color (rojo, oscuro y verde, azul…),
//   textos editables, logo propio y QR de la campaña.
// - ✨ Crear con IA: se escribe la idea y arma los textos (y el tema).
// - 📤 Mi diseño: subís un volante hecho en Canva (o donde sea) y le
//   estampamos el QR de la campaña donde elijas.
// - Guardar como plantilla para reusarla.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasiclick.ezeti.pro').replace(/\/$/, '')

type Plantilla = { id: string; nombre: string; config: ConfigVolante }

function configBase(tipo: string, ciudad: CiudadId, tema = 'rojo'): ConfigVolante {
  const c = buscarCiudad(ciudad)
  return { modo: 'diseno', tema, destino: destinoDeTipo(tipo), textos: textosBase(tipo, c.nombre, gentilicioDe(c.id)) }
}

export default function EditorVolantes({ password, campanas }: { password: string; campanas: { id: string; nombre: string; activa: boolean }[] }) {
  const ciudadesTodas = useTodasLasCiudades()
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [ciudad, setCiudad] = useState<CiudadId>('potosi')
  const [config, setConfig] = useState<ConfigVolante>(() => configBase('general', 'potosi'))
  const [formato, setFormato] = useState<'post' | 'cuadrado' | 'historia'>('post')
  const [campana, setCampana] = useState('')
  const [editarTextos, setEditarTextos] = useState(false)
  const [idea, setIdea] = useState('')
  const [creandoIA, setCreandoIA] = useState(false)
  const [subiendo, setSubiendo] = useState<'' | 'logo' | 'fondo'>('')
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [plantillaId, setPlantillaId] = useState<string | null>(null)
  const [nombrePlantilla, setNombrePlantilla] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [bajando, setBajando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function cargarPlantillas() {
    const d = await fetch('/api/admin/volantes', { headers }).then((r) => r.json()).catch(() => ({}))
    setPlantillas(d.plantillas || [])
  }
  useEffect(() => {
    cargarPlantillas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (c: Partial<ConfigVolante>) => setConfig((prev) => ({ ...prev, ...c }))
  const setTx = (c: Partial<ConfigVolante['textos']>) => setConfig((prev) => ({ ...prev, textos: { ...prev.textos, ...c } }))
  const setCaja = (i: number, c: Partial<ConfigVolante['textos']['cajas'][number]>) =>
    setConfig((prev) => ({ ...prev, textos: { ...prev.textos, cajas: prev.textos.cajas.map((x, j) => (j === i ? { ...x, ...c } : x)) } }))

  function empezar(tipo: string) {
    setConfig(configBase(tipo, ciudad, config.modo === 'diseno' ? config.tema : 'rojo'))
    setPlantillaId(null)
    setNombrePlantilla('')
    setMensaje('')
  }

  async function subirImagen(archivo: File | null, destino: 'logo' | 'fondo') {
    if (!archivo) return
    setSubiendo(destino)
    setMensaje('')
    try {
      const fd = new FormData()
      fd.append('image', archivo)
      const d = await fetch('/api/upload-image', { method: 'POST', headers: { 'x-admin-password': password }, body: fd }).then((r) => r.json())
      if (!d.url) throw new Error(d.error || 'No se pudo subir la imagen.')
      if (destino === 'logo') set({ logoUrl: d.url })
      else set({ modo: 'imagen', fondoUrl: d.url, qrPos: config.qrPos || 'abajo-derecha', qrTam: config.qrTam || 22 })
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo subir la imagen.')
    } finally {
      setSubiendo('')
    }
  }

  async function crearConIA() {
    setCreandoIA(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/marketing/volante-ia', { method: 'POST', headers, body: JSON.stringify({ idea, ciudad }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setConfig((prev) => ({ ...d.config, logoUrl: prev.logoUrl }))
      setEditarTextos(true)
      setPlantillaId(null)
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo crear con IA.')
    } finally {
      setCreandoIA(false)
    }
  }

  async function guardarPlantilla(comoNueva = false) {
    const nombre = nombrePlantilla.trim()
    if (nombre.length < 2) { setMensaje('Poné un nombre a la plantilla.'); return }
    setGuardando(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/volantes', { method: 'POST', headers, body: JSON.stringify({ id: comoNueva ? null : plantillaId, nombre, config }) })
        .then((r) => r.json())
        .catch(() => ({ error: 'No se pudo guardar la plantilla. Probá de nuevo.' }))
      if (d.error) { setMensaje(d.error); return }
      setPlantillaId(d.id)
      setMensaje(`Plantilla “${nombre}” guardada ✓ — la tenés arriba en “Mis plantillas”.`)
      cargarPlantillas()
    } finally {
      setGuardando(false)
    }
  }

  async function borrarPlantilla(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return
    await fetch(`/api/admin/volantes?id=${p.id}`, { method: 'DELETE', headers })
    if (plantillaId === p.id) setPlantillaId(null)
    cargarPlantillas()
  }

  const params = new URLSearchParams({ d: codificarConfig(config), formato })
  if (campana) params.set('c', campana)
  const urlImagen = `/api/marketing/volante?${params.toString()}`

  async function descargar() {
    setBajando(true)
    try {
      const blob = await (await fetch(urlImagen)).blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `clasiclick-volante-${formato}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } finally {
      setBajando(false)
    }
  }

  const sel = 'px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink'
  const input = 'w-full px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs'
  const chip = (activo: boolean) => `px-3 py-1.5 rounded-full border font-body text-xs ${activo ? 'border-maroon bg-maroonsoft text-maroon font-semibold' : 'border-line bg-panel text-inksoft'}`

  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="font-body text-sm font-semibold text-ink mb-1">🖼️ Volantes e imágenes</div>
      <div className="font-body text-[11px] text-inksoft mb-3">Con QR al link de la campaña: para imprimir (mercados, ferias, locales) y para publicar en redes.</div>

      {/* Empezar desde */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-body text-[11px] text-inksoft">Empezar desde:</span>
        <button type="button" onClick={() => empezar('general')} className={chip(false)}>General</button>
        <button type="button" onClick={() => empezar('vendedores')} className={chip(false)}>Vendedores</button>
        <button type="button" onClick={() => empezar('profesionales')} className={chip(false)}>Profesionales</button>
        <label className={`${chip(config.modo === 'imagen')} cursor-pointer`}>
          {subiendo === 'fondo' ? 'Subiendo...' : '📤 Mi diseño (subir imagen)'}
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0] || null, 'fondo')} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="font-body text-[11px] text-inksoft">Mis plantillas:</span>
        {plantillas.length === 0 && <span className="font-body text-[11px] text-inksoft italic">todavía no guardaste ninguna — armá un volante y tocá “💾 Guardar como plantilla”.</span>}
      {plantillas.length > 0 && (
        <>
          {plantillas.map((p) => (
            <span key={p.id} className={`${chip(plantillaId === p.id)} inline-flex items-center gap-1.5`}>
              <button type="button" onClick={() => { setConfig(p.config); setPlantillaId(p.id); setNombrePlantilla(p.nombre) }}>
                {p.config.modo === 'imagen' ? '📤 ' : '🎨 '}{p.nombre}
              </button>
              <button type="button" onClick={() => borrarPlantilla(p)} className="text-inksoft hover:text-maroon" aria-label={`Borrar ${p.nombre}`}>✕</button>
            </span>
          ))}
        </>
      )}
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-4">
        <div className="grid gap-3 content-start">
          <div className="flex flex-wrap gap-2">
            <select value={formato} onChange={(e) => setFormato(e.target.value as any)} className={sel} aria-label="Formato">
              <option value="post">Post / volante (4:5)</option>
              <option value="cuadrado">Cuadrado (1:1)</option>
              <option value="historia">Historia / estado (9:16)</option>
            </select>
            <select value={ciudad} onChange={(e) => setCiudad(e.target.value as CiudadId)} className={sel} aria-label="Ciudad" title="Ciudad de los textos base y de la IA">
              {ciudadesTodas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={campana} onChange={(e) => setCampana(e.target.value)} className={sel} aria-label="Campaña">
              <option value="">Sin campaña (link normal)</option>
              {campanas.filter((c) => c.activa).map((c) => <option key={c.id} value={c.id}>🎯 {c.nombre}</option>)}
            </select>
            <select value={config.destino} onChange={(e) => set({ destino: e.target.value })} className={sel} aria-label="El QR lleva a">
              <option value="/">QR → Inicio (compradores)</option>
              <option value="/vender">QR → Vender</option>
              <option value="/publicar-servicio">QR → Anotarse como profesional</option>
              <option value="/anuncios">QR → Anuncios</option>
            </select>
          </div>

          {config.modo === 'diseno' ? (
            <>
              <div>
                <div className="font-body text-[11px] text-inksoft mb-1.5">Estilo</div>
                <div className="flex flex-wrap gap-2">
                  {TEMAS_VOLANTE.map((t) => (
                    <button key={t.id} type="button" onClick={() => set({ tema: t.id })} className={chip(config.tema === t.id)}>
                      <span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5 border border-black/10" style={{ background: t.franja || t.titulo }} />
                      {t.label.replace(/^\S+\s/, '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <div className="font-body text-xs font-semibold text-indigo-800 mb-1.5">✨ Crear con IA</div>
                <div className="flex gap-2">
                  <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ej: volante para la feria de artesanía de El Alto, invitando a artesanos a vender" className={input} />
                  <button type="button" onClick={crearConIA} disabled={creandoIA || idea.trim().length < 8} className="px-3.5 py-1.5 rounded-md border-none bg-indigo-600 text-white font-body text-xs font-semibold whitespace-nowrap disabled:opacity-50">
                    {creandoIA ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg border border-line font-body text-xs text-ink cursor-pointer">
                  {subiendo === 'logo' ? 'Subiendo...' : config.logoUrl ? '🔁 Cambiar logo' : '🏷️ Subir logo (opcional)'}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0] || null, 'logo')} />
                </label>
                {config.logoUrl && <button type="button" onClick={() => set({ logoUrl: undefined })} className="font-body text-[11px] text-maroon underline">Quitar logo</button>}
                <button type="button" onClick={() => setEditarTextos((v) => !v)} className="px-3 py-1.5 rounded-lg border border-line font-body text-xs text-ink">
                  ✏️ {editarTextos ? 'Ocultar textos' : 'Editar textos'}
                </button>
              </div>

              {editarTextos && (
                <div className="grid gap-2 bg-panelalt rounded-lg p-3">
                  <input value={config.textos.titulo} onChange={(e) => setTx({ titulo: e.target.value })} placeholder="Título" className={input} />
                  <input value={config.textos.subtitulo} onChange={(e) => setTx({ subtitulo: e.target.value })} placeholder="Subtítulo (| corta la línea)" className={input} />
                  <input value={config.textos.bajada} onChange={(e) => setTx({ bajada: e.target.value })} placeholder="Frase bajo el logo (| corta la línea)" className={input} />
                  <div className="grid sm:grid-cols-2 gap-2">
                    {config.textos.cajas.map((c, i) => (
                      <div key={i} className="grid gap-1.5 bg-panel border border-line rounded-md p-2">
                        <input value={c.titulo} onChange={(e) => setCaja(i, { titulo: e.target.value })} placeholder={`Columna ${i + 1}: título`} className={input} />
                        <input value={c.bajada} onChange={(e) => setCaja(i, { bajada: e.target.value })} placeholder="Bajada" className={input} />
                        {[0, 1, 2].map((k) => (
                          <input
                            key={k}
                            value={c.items[k] || ''}
                            onChange={(e) => { const items = [...c.items]; items[k] = e.target.value; setCaja(i, { items: items.filter((x, idx) => x || idx < 3) }) }}
                            placeholder={`Punto ${k + 1}`}
                            className={input}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <input value={config.textos.cta} onChange={(e) => setTx({ cta: e.target.value })} placeholder="Llamado a la acción" className={input} />
                  <input value={config.textos.pie} onChange={(e) => setTx({ pie: e.target.value })} placeholder="Frase final" className={input} />
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-2 bg-panelalt rounded-lg p-3">
              <div className="font-body text-xs text-ink">📤 Tu diseño + el QR de la campaña</div>
              <div className="font-body text-[11px] text-inksoft">Para que no se corte, subilo del mismo formato elegido: post 1080×1350, cuadrado 1080×1080 o historia 1080×1920 (JPG o PNG).</div>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={config.qrPos} onChange={(e) => set({ qrPos: e.target.value as PosQR })} className={sel} aria-label="Posición del QR">
                  <option value="abajo-derecha">QR abajo a la derecha</option>
                  <option value="abajo-izquierda">QR abajo a la izquierda</option>
                  <option value="abajo-centro">QR abajo al centro</option>
                  <option value="arriba-derecha">QR arriba a la derecha</option>
                  <option value="arriba-izquierda">QR arriba a la izquierda</option>
                </select>
                <label className="font-body text-xs text-ink flex items-center gap-2">
                  Tamaño
                  <input type="range" min={12} max={40} value={config.qrTam || 22} onChange={(e) => set({ qrTam: Number(e.target.value) })} />
                </label>
                <label className="font-body text-xs text-ink flex items-center gap-1.5">
                  <input type="checkbox" checked={config.mostrarLink !== false} onChange={(e) => set({ mostrarLink: e.target.checked })} className="accent-teal" />
                  Link debajo del QR
                </label>
              </div>
              <div className="flex gap-2">
                <label className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink cursor-pointer">
                  {subiendo === 'fondo' ? 'Subiendo...' : '🔁 Cambiar imagen'}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0] || null, 'fondo')} />
                </label>
                <button type="button" onClick={() => empezar('general')} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink">Volver a nuestro diseño</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button type="button" onClick={descargar} disabled={bajando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-xs font-semibold disabled:opacity-60">
              {bajando ? 'Preparando...' : '⬇️ Descargar imagen'}
            </button>
            <button
              type="button"
              onClick={async () => { try { await navigator.clipboard.writeText(`${SITE}${urlImagen}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {} }}
              className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink"
            >
              {copiado ? '✓ Copiado' : '🔗 Copiar link de la imagen'}
            </button>
            <input value={nombrePlantilla} onChange={(e) => setNombrePlantilla(e.target.value)} placeholder="Nombre para guardarla" className="px-2.5 py-2 rounded-lg border border-line font-body text-xs w-44" />
            <button type="button" onClick={() => guardarPlantilla()} disabled={guardando} className="px-3 py-2 rounded-lg border border-teal bg-tealsoft text-teal font-body text-xs font-semibold disabled:opacity-60">
              💾 {guardando ? 'Guardando...' : plantillaId ? 'Actualizar plantilla' : 'Guardar como plantilla'}
            </button>
            {plantillaId && (
              <button type="button" onClick={() => guardarPlantilla(true)} disabled={guardando} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink disabled:opacity-60">
                Guardar como nueva
              </button>
            )}
          </div>
          {mensaje && <div className="font-body text-xs text-ink">{mensaje}</div>}
          {!campana && <div className="font-body text-[10px] text-ochre">Sin campaña elegida: el QR funciona, pero no vas a poder medir cuánta gente entró por este volante.</div>}
        </div>

        <div className={`bg-panelalt rounded-lg overflow-hidden border border-line ${formato === 'historia' ? 'aspect-[9/16] max-h-[520px]' : formato === 'cuadrado' ? 'aspect-square' : 'aspect-[4/5]'}`}>
          <img key={urlImagen} src={urlImagen} alt="Vista previa del volante" className="w-full h-full object-contain" />
        </div>
      </div>
    </div>
  )
}
