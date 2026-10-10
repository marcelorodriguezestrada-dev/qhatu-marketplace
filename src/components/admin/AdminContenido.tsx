'use client'

import { useEffect, useRef, useState } from 'react'
import { EDICION_POR_DEFECTO, miniaturaVideo, pesoLegible, urlEditada, type Edicion, type Medio } from '@/lib/medios'
import { REDES_LANZAMIENTO } from '@/lib/lanzamiento'

// Admin → Marketing → "🎬 Contenido": los videos e imágenes de las
// publicaciones. Se suben directo a Cloudinary (gratis, no ocupan lugar
// en el repositorio ni en Firebase) y se editan ahí mismo: recortar,
// 9:16, texto arriba / abajo, logo y link. El resultado es un MP4 listo
// para TikTok, Reels y estados.

type PubCorta = { id: string; fecha: string; red: string; titulo: string }

const input = 'w-full px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs'
const etiqueta = 'block font-body text-[11px] text-inksoft mb-0.5'
const seg = (n: number | null) => (n == null ? '' : `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`)

export default function AdminContenido({ password }: { password: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [medios, setMedios] = useState<Medio[] | null>(null)
  const [cloud, setCloud] = useState<{ activo: boolean; cloud: string }>({ activo: false, cloud: '' })
  const [pubs, setPubs] = useState<PubCorta[]>([])
  const [subiendo, setSubiendo] = useState<{ nombre: string; pct: number } | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [porLink, setPorLink] = useState<{ url: string; nombre: string; tipo: 'video' | 'imagen' } | null>(null)
  const [editando, setEditando] = useState<Medio | null>(null)

  async function cargar() {
    const [m, l] = await Promise.all([
      fetch('/api/admin/medios', { headers }).then((r) => r.json()).catch(() => null),
      fetch('/api/admin/lanzamiento', { headers }).then((r) => r.json()).catch(() => null),
    ])
    setMedios(m?.medios || [])
    if (m?.cloudinary) setCloud(m.cloudinary)
    setPubs((l?.publicaciones || []).map((p: any) => ({ id: p.id, fecha: p.fecha, red: p.red, titulo: p.titulo })))
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarMedio(medio: Partial<Medio>) {
    const d = await fetch('/api/admin/medios', { method: 'POST', headers, body: JSON.stringify({ accion: 'guardar', medio }) }).then((r) => r.json()).catch(() => null)
    if (d?.medio) setMedios((prev) => [d.medio, ...(prev || [])])
    else setMensaje(d?.error || 'No se pudo guardar.')
    return d?.medio as Medio | undefined
  }

  async function subir(file: File) {
    setMensaje('')
    if (file.size > 100 * 1024 * 1024) { setMensaje('El archivo pesa más de 100 MB (el límite gratis de Cloudinary). Achicalo o subilo a Drive y agregalo por link.'); return }
    const f = await fetch('/api/admin/medios', { method: 'POST', headers, body: JSON.stringify({ accion: 'firmar' }) }).then((r) => r.json()).catch(() => null)
    if (!f?.signature) { setMensaje(f?.error || 'No se pudo preparar la subida.'); return }
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', f.api_key)
    form.append('timestamp', String(f.timestamp))
    form.append('folder', f.folder)
    form.append('signature', f.signature)
    setSubiendo({ nombre: file.name, pct: 0 })
    // XHR para mostrar el avance (un video tarda).
    const res: any = await new Promise((ok) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', f.url)
      xhr.upload.onprogress = (e) => e.lengthComputable && setSubiendo({ nombre: file.name, pct: Math.round((e.loaded / e.total) * 100) })
      xhr.onload = () => { try { ok(JSON.parse(xhr.responseText)) } catch { ok(null) } }
      xhr.onerror = () => ok(null)
      xhr.send(form)
    })
    setSubiendo(null)
    if (!res?.secure_url) { setMensaje(res?.error?.message ? `Cloudinary: ${res.error.message}` : 'No se pudo subir el archivo.'); return }
    await guardarMedio({
      tipo: res.resource_type === 'image' ? 'imagen' : 'video',
      nombre: file.name.replace(/\.[^.]+$/, ''),
      origen: 'cloudinary',
      url: res.secure_url,
      publicId: res.public_id,
      duracion: res.duration || null,
      ancho: res.width || null,
      alto: res.height || null,
      bytes: res.bytes || file.size,
    })
    setMensaje('✓ Subido. Tocá “✂️ Editar” para recortarlo y pasarlo a 9:16.')
  }

  async function asignar(m: Medio, publicacionId: string) {
    setMedios((prev) => (prev || []).map((x) => (x.id === m.id ? { ...x, publicacionId: publicacionId || null } : x)))
    await fetch('/api/admin/medios', { method: 'PATCH', headers, body: JSON.stringify({ id: m.id, publicacionId }) }).catch(() => null)
  }

  async function borrar(m: Medio) {
    setMedios((prev) => (prev || []).filter((x) => x.id !== m.id))
    await fetch(`/api/admin/medios?id=${encodeURIComponent(m.id)}`, { method: 'DELETE', headers }).catch(() => null)
  }

  const nombrePub = (id: string | null) => {
    const p = pubs.find((x) => x.id === id)
    if (!p) return ''
    const r = REDES_LANZAMIENTO.find((x) => x.id === p.red)
    return `${p.fecha.slice(8)}/${p.fecha.slice(5, 7)} ${r?.icono || ''} ${p.titulo}`
  }

  return (
    <div className="grid gap-4">
      {!cloud.activo && (
        <div className="bg-ochresoft border border-ochre rounded-xl p-4 font-body text-xs text-ink">
          <div className="text-sm font-semibold mb-1">☁️ Para subir y editar videos falta conectar Cloudinary (gratis, una sola vez)</div>
          <ol className="list-decimal pl-5 grid gap-0.5">
            <li>Creá una cuenta en <b>cloudinary.com</b> (plan Free, sin tarjeta: 25 GB).</li>
            <li>En su <b>Dashboard</b> copiá <b>Cloud name</b>, <b>API Key</b> y <b>API Secret</b>.</li>
            <li>En <b>Vercel → Settings → Environment Variables</b> agregá <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code> y <code>CLOUDINARY_API_SECRET</code>, y volvé a desplegar.</li>
          </ol>
          <div className="mt-1.5 text-inksoft">Mientras tanto podés agregar videos por link (Google Drive, YouTube…).</div>
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-body text-sm font-semibold text-ink">🎬 Biblioteca de contenido</div>
            <div className="font-body text-[11px] text-inksoft">Subí tus videos e imágenes y asignalos a una publicación del calendario.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`px-3 py-1.5 rounded-md font-body text-xs font-bold ${cloud.activo && !subiendo ? 'bg-verde text-marca cursor-pointer' : 'bg-panelalt text-inksoft cursor-not-allowed'}`}>
              ⬆️ Subir video o imagen
              <input type="file" accept="video/*,image/*" className="hidden" disabled={!cloud.activo || !!subiendo} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f) }} />
            </label>
            <button type="button" onClick={() => setPorLink({ url: '', nombre: '', tipo: 'video' })} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs font-semibold text-ink">🔗 Agregar por link</button>
          </div>
        </div>

        {subiendo && (
          <div className="mb-3 font-body text-xs text-ink">
            Subiendo <b>{subiendo.nombre}</b>… {subiendo.pct}%
            <div className="h-2 rounded bg-panelalt mt-1 overflow-hidden"><div className="h-full bg-verde transition-all" style={{ width: `${subiendo.pct}%` }} /></div>
          </div>
        )}
        {mensaje && <div className="mb-3 font-body text-xs text-teal">{mensaje}</div>}

        {porLink && (
          <div className="mb-3 grid gap-2 border border-teal rounded-lg p-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_120px] gap-2">
              <label><span className={etiqueta}>Link (Drive, YouTube, etc.)</span><input id="pl-url" value={porLink.url} onChange={(e) => setPorLink({ ...porLink, url: e.target.value })} placeholder="https://drive.google.com/…" className={input} /></label>
              <label><span className={etiqueta}>Nombre</span><input id="pl-nombre" value={porLink.nombre} onChange={(e) => setPorLink({ ...porLink, nombre: e.target.value })} placeholder="Video tienda Risitas" className={input} /></label>
              <label><span className={etiqueta}>Tipo</span><select id="pl-tipo" value={porLink.tipo} onChange={(e) => setPorLink({ ...porLink, tipo: e.target.value as any })} className={input}><option value="video">Video</option><option value="imagen">Imagen</option></select></label>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={!/^https:\/\//.test(porLink.url)} onClick={async () => { if (await guardarMedio({ ...porLink, origen: 'link' })) setPorLink(null) }} className="px-3 py-1.5 rounded-md bg-ink text-white border-none font-body text-xs font-semibold disabled:opacity-40">Agregar</button>
              <button type="button" onClick={() => setPorLink(null)} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">Cancelar</button>
            </div>
          </div>
        )}

        {!medios ? (
          <div className="font-body text-xs text-inksoft">Cargando…</div>
        ) : medios.length === 0 ? (
          <div className="font-body text-xs text-inksoft py-6 text-center">Todavía no subiste nada. Empezá por el video que tenés: subilo, recortalo a 15 segundos y asignalo a la publicación de TikTok.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {medios.map((m) => {
              const vista = m.tipo === 'imagen' ? m.url : m.origen === 'cloudinary' && m.publicId ? miniaturaVideo(cloud.cloud, m.publicId) : ''
              return (
                <div key={m.id} className="border border-line rounded-xl overflow-hidden bg-panel flex flex-col">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/5] bg-marca">
                    {vista ? <img src={vista} alt={m.nombre} loading="lazy" className="w-full h-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-4xl">{m.tipo === 'video' ? '🎬' : '🖼️'}</span>}
                    {m.tipo === 'video' && <span className="absolute inset-0 flex items-center justify-center"><span className="w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">▶</span></span>}
                    {m.editadoDe && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-verde text-marca font-body text-[10px] font-bold">✂️ Editado</span>}
                  </a>
                  <div className="p-2.5 grid gap-1.5 flex-1">
                    <div className="font-body text-xs font-semibold text-ink truncate" title={m.nombre}>{m.nombre}</div>
                    <div className="font-body text-[10px] text-inksoft">{m.tipo === 'video' ? '🎬 Video' : '🖼️ Imagen'}{m.duracion ? ` · ${seg(m.duracion)}` : ''}{m.ancho && m.alto ? ` · ${m.ancho}×${m.alto}` : ''}{m.bytes ? ` · ${pesoLegible(m.bytes)}` : ''}{m.origen === 'link' ? ' · link' : ''}</div>
                    <select value={m.publicacionId || ''} onChange={(e) => asignar(m, e.target.value)} className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px]" aria-label="Publicación">
                      <option value="">— Sin publicación —</option>
                      {pubs.map((p) => <option key={p.id} value={p.id}>{nombrePub(p.id)}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {m.origen === 'cloudinary' && <button type="button" onClick={() => setEditando(m)} className="px-2 py-1 rounded-md bg-ink text-white border-none font-body text-[11px] font-semibold">✂️ Editar</button>}
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px] text-ink no-underline">Abrir</a>
                      <button type="button" onClick={() => borrar(m)} className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px] text-maroon ml-auto" aria-label={`Borrar ${m.nombre}`}>🗑️</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editando && (
        <Editor
          medio={editando}
          cloud={cloud.cloud}
          tituloPub={pubs.find((p) => p.id === editando.publicacionId)?.titulo || ''}
          onCerrar={() => setEditando(null)}
          onGuardar={async (url, e) => {
            const nuevo = await guardarMedio({
              tipo: editando.tipo,
              nombre: `${editando.nombre} (${e.formato}${editando.tipo === 'video' ? `, ${seg((e.fin || editando.duracion || 0) - e.inicio)}` : ''})`,
              origen: 'cloudinary',
              url,
              publicId: editando.publicId,
              duracion: editando.tipo === 'video' ? (e.fin || editando.duracion || 0) - e.inicio : null,
              ancho: 1080,
              alto: e.formato === '9:16' ? 1920 : e.formato === '1:1' ? 1080 : editando.alto,
              publicacionId: editando.publicacionId,
              editadoDe: editando.id,
            })
            if (nuevo) { setEditando(null); setMensaje('✓ Edición guardada en la biblioteca.') }
          }}
        />
      )}
    </div>
  )
}

// Editor rápido: recorte, formato, textos, logo y link. La vista previa
// la arma Cloudinary (la primera vez tarda unos segundos).
function Editor({ medio, cloud, tituloPub, onCerrar, onGuardar }: { medio: Medio; cloud: string; tituloPub: string; onCerrar: () => void; onGuardar: (url: string, e: Edicion) => void }) {
  const dur = medio.duracion || 0
  const [e, setE] = useState<Edicion>({ ...EDICION_POR_DEFECTO, fin: Math.min(dur, 15), textoArriba: tituloPub })
  const [vista, setVista] = useState<string | null>(null)
  const [cargandoVista, setCargandoVista] = useState(false)
  const original = useRef<HTMLVideoElement>(null)
  const esVideo = medio.tipo === 'video'
  const url = urlEditada(cloud, medio, e)
  const largo = esVideo ? Math.max(0, (e.fin || dur) - e.inicio) : 0

  return (
    <div className="fixed inset-0 z-40 bg-ink/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-panel w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-base font-bold text-ink">✂️ Editar “{medio.nombre}”</div>
          <button type="button" onClick={onCerrar} className="font-body text-sm text-inksoft bg-transparent border-none">✕</button>
        </div>
        <div className="grid sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4">
          <div>
            <div className="font-body text-[11px] text-inksoft mb-1">{vista ? 'Vista previa con la edición' : 'Original'}</div>
            {vista ? (
              esVideo ? <video key={vista} src={vista} controls playsInline onLoadedData={() => setCargandoVista(false)} onError={() => setCargandoVista(false)} className="w-full rounded-lg bg-black max-h-[460px]" />
                : <img src={vista} alt="Vista previa" onLoad={() => setCargandoVista(false)} className="w-full rounded-lg" />
            ) : esVideo ? (
              <video ref={original} src={medio.url} controls playsInline className="w-full rounded-lg bg-black max-h-[460px]" />
            ) : (
              <img src={medio.url} alt={medio.nombre} className="w-full rounded-lg" />
            )}
            {cargandoVista && <div className="font-body text-[11px] text-inksoft mt-1">Cloudinary está armando el video… (puede tardar unos segundos)</div>}
            {vista && <button type="button" onClick={() => setVista(null)} className="mt-1 font-body text-[11px] text-teal underline bg-transparent border-none">Ver el original</button>}
          </div>
          <div className="grid gap-3 content-start">
            {esVideo && dur > 0 && (
              <div>
                <div className="font-body text-xs font-semibold text-ink mb-1">Recorte: {e.inicio.toFixed(1)} s → {(e.fin || dur).toFixed(1)} s <span className={`font-normal ${largo > 0 && largo <= 15 ? 'text-teal' : 'text-ochre'}`}>({largo.toFixed(1)} s{largo > 15 ? ' · para TikTok conviene 9–15 s' : ''})</span></div>
                <label className="block font-body text-[11px] text-inksoft">Inicio
                  <input id="ed-inicio" type="range" min={0} max={dur} step={0.1} value={e.inicio} onChange={(ev) => { const v = Number(ev.target.value); setE({ ...e, inicio: Math.min(v, (e.fin || dur) - 0.5) }); if (original.current) original.current.currentTime = v }} className="w-full accent-teal" />
                </label>
                <label className="block font-body text-[11px] text-inksoft">Fin
                  <input id="ed-fin" type="range" min={0} max={dur} step={0.1} value={e.fin || dur} onChange={(ev) => { const v = Number(ev.target.value); setE({ ...e, fin: Math.max(v, e.inicio + 0.5) }); if (original.current) original.current.currentTime = v }} className="w-full accent-teal" />
                </label>
                <div className="flex gap-1.5 mt-1">
                  <button type="button" onClick={() => original.current && setE({ ...e, inicio: Math.min(original.current.currentTime, (e.fin || dur) - 0.5) })} className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px]">Empezar acá ▶|</button>
                  <button type="button" onClick={() => original.current && setE({ ...e, fin: Math.max(original.current.currentTime, e.inicio + 0.5) })} className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px]">|◀ Terminar acá</button>
                </div>
              </div>
            )}
            <div>
              <div className="font-body text-xs font-semibold text-ink mb-1">Formato</div>
              <div className="flex flex-wrap gap-1.5">
                {([['9:16', '📱 9:16 · TikTok, Reels, estados'], ['1:1', '⬛ 1:1 · Facebook, feed'], ['original', 'Original']] as const).map(([id, l]) => (
                  <button key={id} type="button" onClick={() => setE({ ...e, formato: id })} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${e.formato === id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{l}</button>
                ))}
              </div>
            </div>
            <label><span className={etiqueta}>Texto arriba (el gancho de los primeros 2 segundos)</span><input id="ed-arriba" value={e.textoArriba} onChange={(ev) => setE({ ...e, textoArriba: ev.target.value.slice(0, 80) })} placeholder="¿Ropa en Potosí sin salir de casa?" className={input} /></label>
            <label><span className={etiqueta}>Texto abajo (subtítulo)</span><input id="ed-abajo" value={e.textoAbajo} onChange={(ev) => setE({ ...e, textoAbajo: ev.target.value.slice(0, 100) })} placeholder="Pedí hoy y recibí mañana 🛵" className={input} /></label>
            <div className="flex flex-wrap gap-4 font-body text-xs text-ink">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={e.logo} onChange={(ev) => setE({ ...e, logo: ev.target.checked })} className="accent-teal" /> Logo ClasiClick</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={e.link} onChange={(ev) => setE({ ...e, link: ev.target.checked })} className="accent-teal" /> clasiclick.com</label>
            </div>
            <div className="font-body text-[10px] text-inksoft">Los emojis en los textos del video pueden no verse: usá letras y signos. Para música y efectos, editá en CapCut y subí el resultado.</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => { setCargandoVista(true); setVista(url) }} className="px-3 py-1.5 rounded-md border border-teal bg-tealsoft text-teal font-body text-xs font-semibold">👁️ Vista previa</button>
              {url && <a href={urlEditada(cloud, medio, e, true) || '#'} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs font-semibold text-ink no-underline">⬇️ Descargar {esVideo ? 'MP4' : 'JPG'}</a>}
              <button type="button" onClick={() => url && onGuardar(url, e)} className="px-3 py-1.5 rounded-md bg-ink text-white border-none font-body text-xs font-semibold">💾 Guardar en la biblioteca</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
