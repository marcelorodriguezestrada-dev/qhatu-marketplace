'use client'

import { useState } from 'react'

// Una publicación compartida desde Vender → Marketing: qué imagen y texto,
// dónde se compartió, en qué grupo / página (lo anota la tienda) y lo que
// trajo. La usan "📊 Tus publicaciones" (editable) y el admin (solo lectura).

const RED: Record<string, { icono: string; label: string }> = {
  facebook: { icono: '📘', label: 'Facebook' },
  instagram: { icono: '📸', label: 'Instagram' },
  whatsapp: { icono: '💬', label: 'WhatsApp' },
  tiktok: { icono: '🎵', label: 'TikTok' },
}
const DONDE: Record<string, string> = {
  facebook: '📘 Abrió Facebook',
  whatsapp: '💬 Abrió WhatsApp',
  copiado: '📋 Copió el texto',
  compartir: '📤 Compartió la imagen',
  descarga: '⬇️ Descargó la imagen',
}
const fecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export default function TarjetaPublicacion({
  p,
  precio,
  tienda,
  onGuardar,
}: {
  p: any
  precio: (n: number) => string
  tienda?: string
  onGuardar?: (cambios: { lugar: string; linkPost: string }) => Promise<void>
}) {
  const [abierta, setAbierta] = useState(false)
  const [lugar, setLugar] = useState(p.lugar || '')
  const [linkPost, setLinkPost] = useState(p.linkPost || '')
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState('')
  const red = RED[p.red] || { icono: '📣', label: p.red }
  const nombres = (p.productos || []).map((x: any) => x.nombre).join(', ') || 'Publicación'
  const linkCompleto = p.link ? (typeof window !== 'undefined' ? window.location.origin : 'https://www.clasiclick.com') + p.link : ''

  function copiar(t: string, k: string) {
    navigator.clipboard?.writeText(t).then(() => { setCopiado(k); setTimeout(() => setCopiado(''), 1500) }).catch(() => {})
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={() => setAbierta(!abierta)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-panelalt">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-panelalt border border-line shrink-0">
          {p.imagen && <img src={p.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-body text-sm text-ink truncate">{tienda && <b>{tienda} · </b>}{nombres}</div>
          <div className="font-body text-[11px] text-inksoft truncate">
            {red.icono} {red.label}{p.lugar ? ` · ${p.lugar}` : ''} · {fecha(p.publicadaAt)}
          </div>
        </div>
        <div className="flex gap-3 font-body text-xs text-ink shrink-0 text-right items-center">
          <span title="Visitas desde esta publicación">👀 {p.visitas || 0}</span>
          <span title="Pedidos en la tienda">🧾 {p.pedidos || 0}</span>
          <span className="hidden sm:inline font-semibold" title="Vendido">{precio(p.ventasBs || 0)}</span>
          <span className="text-inksoft">{abierta ? '▲' : '▼'}</span>
        </div>
      </button>

      {abierta && (
        <div className="px-3 pb-4 grid gap-3 sm:grid-cols-[180px_1fr]">
          <div>
            {p.imagen ? (
              <a href={p.imagen} target="_blank" rel="noreferrer" title="Ver la imagen grande">
                <img src={p.imagen} alt="Imagen publicada" className="w-full rounded-lg border border-line" />
              </a>
            ) : (
              <div className="aspect-square rounded-lg bg-panelalt border border-line" />
            )}
            <div className="font-body text-[10px] text-inksoft mt-1">Imagen {p.formato === 'vertical' ? 'para estado / historia' : 'para post'}</div>
          </div>
          <div className="min-w-0 grid gap-2.5 content-start">
            <div>
              <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Texto publicado</div>
              <div className="font-body text-xs text-ink whitespace-pre-wrap bg-panelalt rounded-lg px-3 py-2 max-h-40 overflow-y-auto">{p.texto || 'Sin texto guardado.'}</div>
            </div>
            <div>
              <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Qué se hizo</div>
              <div className="flex flex-wrap gap-1.5">
                {(p.compartidaEn || []).map((c: any, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-panelalt border border-line font-body text-[11px] text-ink">{DONDE[c.donde] || c.donde} · {fecha(c.at)}</span>
                ))}
              </div>
            </div>

            {onGuardar ? (
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="font-body text-[11px] text-inksoft">¿Dónde la publicaste? (grupo, página, estado…)
                  <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Grupo Compra y Venta Potosí" className="w-full mt-0.5 px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs text-ink" />
                </label>
                <label className="font-body text-[11px] text-inksoft">Link del post (opcional)
                  <input value={linkPost} onChange={(e) => setLinkPost(e.target.value)} placeholder="https://facebook.com/groups/…" className="w-full mt-0.5 px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs text-ink" />
                </label>
                {(lugar !== (p.lugar || '') || linkPost !== (p.linkPost || '')) && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={async () => { setGuardando(true); await onGuardar({ lugar, linkPost }); setGuardando(false) }}
                    className="sm:col-span-2 justify-self-start px-3 py-1.5 rounded-md border-none bg-ink text-white font-body text-xs font-semibold disabled:opacity-60"
                  >
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              </div>
            ) : (
              (p.lugar || p.linkPost) && (
                <div className="font-body text-xs text-ink">📍 {p.lugar || 'Sin anotar'}</div>
              )
            )}

            <div className="flex flex-wrap gap-2">
              {p.linkPost && <a href={p.linkPost} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-md bg-[#1877F2] text-white font-body text-[11px] font-semibold no-underline">Ver el post ↗</a>}
              {linkCompleto && <button type="button" onClick={() => copiar(linkCompleto, 'link')} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-[11px]">{copiado === 'link' ? '✓ Copiado' : '🔗 Copiar link rastreado'}</button>}
              {p.texto && <button type="button" onClick={() => copiar(p.texto, 'texto')} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-[11px]">{copiado === 'texto' ? '✓ Copiado' : '📋 Copiar texto para volver a publicar'}</button>}
            </div>
            <div className="font-body text-[10px] text-inksoft">Código de seguimiento: <span className="font-mono">{p.id}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
