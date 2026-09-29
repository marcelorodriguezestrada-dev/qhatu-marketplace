'use client'

import { useCiudad } from '@/lib/ciudad'
import { buscarCiudad, type CiudadId } from '@/data/ciudades'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { REDES_MARKETING, TONOS_MARKETING, linkProducto, pctDescuento, textoPlantilla } from '@/lib/marketing'

// /vender → "📣 Marketing": el vendedor arma publicaciones para sus
// redes con sus productos: texto (IA o plantilla), imagen lista para
// post o estado, catálogo para WhatsApp e ideas para vender más.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasiclick.ezeti.pro').replace(/\/$/, '')
const MAX_PRODUCTOS = 5

export default function MarketingVendedor({ misProductos, tienda, irA, ciudadTienda }: { misProductos: any[]; tienda: string; irA: (s: any) => void; ciudadTienda?: CiudadId }) {
  const { usuario, obtenerToken } = useAuth()
  const { ciudadId } = useCiudad()
  const ciudad = buscarCiudad(ciudadTienda || ciudadId)
  const activos = useMemo(() => misProductos.filter((p) => !p.estado || p.estado === 'activo'), [misProductos])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [red, setRed] = useState<string>('facebook')
  const [tono, setTono] = useState<string>('cercano')
  const [texto, setTexto] = useState('')
  const [conIA, setConIA] = useState<boolean | null>(null)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [formato, setFormato] = useState<'cuadrado' | 'vertical'>('cuadrado')
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState('')

  const seleccion = activos.filter((p) => elegidos.includes(p.id))
  const principal = seleccion[0]
  const urlImagen = principal ? `/api/marketing/imagen/${principal.id}?formato=${formato}` : ''
  const linkTienda = usuario ? `${SITE}/tienda/${usuario.uid}?ref=whatsapp` : ''

  function alternar(id: string) {
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_PRODUCTOS ? prev : [...prev, id]))
  }

  async function copiar(valor: string, clave: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(clave)
      setTimeout(() => setCopiado(null), 2000)
    } catch {}
  }

  async function generar() {
    if (elegidos.length === 0) return
    setGenerando(true)
    setError('')
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/marketing/texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productoIds: elegidos, red, tono }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo armar el texto.')
      setTexto(d.texto)
      setConIA(!!d.conIA)
    } catch (err: any) {
      // Sin conexión con el servidor: al menos la plantilla.
      setTexto(textoPlantilla(seleccion as any, red, tienda, SITE, ciudad.nombre))
      setConIA(false)
      setError(err?.message || '')
    } finally {
      setGenerando(false)
    }
  }

  async function bajarImagen(): Promise<File | null> {
    if (!urlImagen) return null
    const blob = await (await fetch(urlImagen)).blob()
    return new File([blob], `clasiclick-${principal.id}-${formato}.png`, { type: 'image/png' })
  }

  async function descargar() {
    setBajando(true)
    try {
      const f = await bajarImagen()
      if (!f) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(f)
      a.download = f.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } finally {
      setBajando(false)
    }
  }

  // En el celular: compartir imagen + texto directo a la app (WhatsApp,
  // Instagram, Facebook...). Si el navegador no puede, se descarga.
  async function compartirConImagen() {
    setBajando(true)
    try {
      const f = await bajarImagen()
      const nav = navigator as any
      if (f && nav.canShare?.({ files: [f] })) {
        await nav.share({ files: [f], text: texto || undefined })
      } else {
        await descargar()
        if (texto) await copiar(texto, 'texto')
        alert('Tu navegador no deja compartir la imagen directo: la descargamos y copiamos el texto para que lo pegues.')
      }
    } catch {
      // cancelado por el usuario
    } finally {
      setBajando(false)
    }
  }

  const mensajeCatalogo =
    `¡Hola! 👋 Te comparto el catálogo de ${tienda || 'mi tienda'} en Clasi Click 🛍️\n\n` +
    activos
      .slice(0, 5)
      .map((p) => `• ${p.nombre} — Bs ${Number(p.precio).toLocaleString('es-BO')}`)
      .join('\n') +
    `${activos.length > 5 ? `\n…y ${activos.length - 5} productos más` : ''}\n\n👉 Mirá todo y pedí acá: ${linkTienda}\nPagás con QR y te lo llevamos 🚚`

  const ideas = [
    activos.filter((p) => !p.imagenUrl).length > 0 && {
      t: `📷 ${activos.filter((p) => !p.imagenUrl).length} producto(s) sin foto`,
      d: 'Las publicaciones con foto venden mucho más. Subí una desde Publicaciones → Editar.',
      s: 'publicaciones',
    },
    activos.filter((p) => pctDescuento(p) > 0).length === 0 && activos.length > 0 && {
      t: '🔥 Probá una oferta',
      d: 'Poné un "precio antes" en algún producto: sale con el cartel de -% en el catálogo, en Ofertas y en la imagen para redes.',
      s: 'publicaciones',
    },
    activos.some((p) => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3) && {
      t: '⏳ Tenés productos con pocas unidades',
      d: 'Publicalos con "¡Últimas unidades!": la urgencia ayuda a decidir. La imagen ya lo muestra.',
      s: null,
    },
    activos.filter((p) => !p.descripcionCorta && !p.descripcionLarga).length > 0 && {
      t: `📝 ${activos.filter((p) => !p.descripcionCorta && !p.descripcionLarga).length} producto(s) sin descripción`,
      d: 'Contá material, medidas y para qué sirve: responde dudas antes de que pregunten.',
      s: 'publicaciones',
    },
    {
      t: '📅 Publicá seguido',
      d: 'Lo que mejor funciona: 1 publicación por día en tu estado de WhatsApp y 2–3 por semana en grupos de compra-venta de Facebook, en la tarde-noche (19–21 hs).',
      s: null,
    },
  ].filter(Boolean) as { t: string; d: string; s: string | null }[]

  if (activos.length === 0) {
    return (
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="font-body text-sm font-semibold text-ink mb-1">📣 Marketing</div>
        <div className="font-body text-sm text-inksoft mb-3">Primero publicá al menos un producto y acá te armamos las publicaciones para tus redes.</div>
        <button type="button" onClick={() => irA('publicar')} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold">➕ Publicar producto</button>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="font-body text-sm font-semibold text-ink mb-1">📣 Crear publicación para redes</div>
        <div className="font-body text-[12px] text-inksoft mb-4">Elegí hasta {MAX_PRODUCTOS} productos, la red y el estilo. Te armamos el texto y la imagen, listos para compartir.</div>

        <div className="font-body text-xs font-semibold text-ink mb-2">1. Productos ({elegidos.length}/{MAX_PRODUCTOS})</div>
        <div className="flex gap-2.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
          {activos.map((p) => {
            const on = elegidos.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => alternar(p.id)}
                className={`relative w-24 shrink-0 rounded-lg border-2 p-1.5 text-left ${on ? 'border-teal bg-tealsoft' : 'border-line bg-panel'}`}
              >
                <div className="w-full aspect-square rounded-md bg-panelalt overflow-hidden mb-1">
                  {(p.thumbUrl || p.imagenUrl) && <img src={p.thumbUrl || p.imagenUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="font-body text-[10px] text-ink leading-tight line-clamp-2">{p.nombre}</div>
                <div className="font-body text-[10px] text-maroon font-semibold">Bs {Number(p.precio).toLocaleString('es-BO')}</div>
                {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-teal text-white text-[11px] flex items-center justify-center">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="font-body text-xs font-semibold text-ink mb-2">2. ¿Dónde lo vas a publicar?</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {REDES_MARKETING.map((r) => (
            <button key={r.id} type="button" onClick={() => setRed(r.id)} className={`px-3.5 py-1.5 rounded-full border font-body text-sm ${red === r.id ? 'border-maroon bg-maroonsoft text-maroon font-semibold' : 'border-line bg-panel text-inksoft'}`}>
              {r.icono} {r.label}
            </button>
          ))}
        </div>

        <div className="font-body text-xs font-semibold text-ink mb-2">3. Estilo</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {TONOS_MARKETING.map((t) => (
            <button key={t.id} type="button" onClick={() => setTono(t.id)} className={`px-3.5 py-1.5 rounded-full border font-body text-sm ${tono === t.id ? 'border-maroon bg-maroonsoft text-maroon font-semibold' : 'border-line bg-panel text-inksoft'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <button type="button" onClick={generar} disabled={generando || elegidos.length === 0} className="px-5 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-50">
          {generando ? 'Escribiendo...' : texto ? '🔄 Crear otra versión' : '✨ Crear publicación'}
        </button>
        {elegidos.length === 0 && <span className="font-body text-xs text-inksoft ml-3">Elegí al menos un producto</span>}
        {error && <div className="font-body text-xs text-maroon mt-2">{error}</div>}

        {texto && (
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">
            <div>
              <div className="font-body text-xs font-semibold text-ink mb-1.5">
                Texto {conIA ? <span className="text-indigo-700 font-normal">· escrito con IA, podés editarlo</span> : <span className="text-inksoft font-normal">· podés editarlo</span>}
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={11} className="w-full px-3 py-2.5 rounded-lg border border-line bg-panelalt font-body text-sm" />
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={() => copiar(texto, 'texto')} className="px-3.5 py-2 rounded-lg border-none bg-ink text-white font-body text-xs font-semibold">
                  {copiado === 'texto' ? '✓ Copiado' : '📋 Copiar texto'}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-lg bg-[#25D366] text-white font-body text-xs font-semibold">
                  💬 WhatsApp
                </a>
                {principal && (
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkProducto(SITE, principal.id, 'facebook'))}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => copiar(texto, 'texto')}
                    className="px-3.5 py-2 rounded-lg bg-[#1877F2] text-white font-body text-xs font-semibold"
                    title="Se abre Facebook con el link; el texto queda copiado para pegarlo"
                  >
                    📘 Facebook
                  </a>
                )}
              </div>
              {red === 'instagram' || red === 'tiktok' ? (
                <div className="font-body text-[11px] text-inksoft mt-2">
                  {red === 'instagram' ? 'Instagram' : 'TikTok'} no deja publicar desde otra página: descargá la imagen, copiá el texto y pegalo al subirla desde la app.
                </div>
              ) : null}
            </div>

            {principal && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-body text-xs font-semibold text-ink">Imagen</div>
                  <div className="flex gap-1">
                    {(['cuadrado', 'vertical'] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setFormato(f)} className={`px-2 py-0.5 rounded-md border font-body text-[11px] ${formato === f ? 'border-teal bg-tealsoft text-teal' : 'border-line text-inksoft'}`}>
                        {f === 'cuadrado' ? 'Post' : 'Estado / historia'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`bg-panelalt rounded-lg overflow-hidden border border-line ${formato === 'vertical' ? 'aspect-[9/16] max-h-[420px] mx-auto' : 'aspect-square'}`}>
                  <img key={urlImagen} src={urlImagen} alt={`Imagen para redes de ${principal.nombre}`} className="w-full h-full object-contain" />
                </div>
                {seleccion.length > 1 && <div className="font-body text-[10px] text-inksoft mt-1">Imagen del primer producto elegido.</div>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" onClick={compartirConImagen} disabled={bajando} className="px-3 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-60">
                    📤 Compartir
                  </button>
                  <button type="button" onClick={descargar} disabled={bajando} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink disabled:opacity-60">
                    {bajando ? 'Preparando...' : '⬇️ Descargar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="font-body text-sm font-semibold text-ink mb-1">🛍️ Tu catálogo para WhatsApp</div>
        <div className="font-body text-[12px] text-inksoft mb-3">Un solo link con todos tus productos. Mandalo a tus contactos o ponelo en tu estado y en la bio de Instagram.</div>
        <div className="font-body text-sm text-ink bg-panelalt rounded-lg px-3 py-2.5 mb-3 whitespace-pre-line">{mensajeCatalogo}</div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(mensajeCatalogo)}`} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-lg bg-[#25D366] text-white font-body text-xs font-semibold">
            💬 Enviar por WhatsApp
          </a>
          <button type="button" onClick={() => copiar(mensajeCatalogo, 'catalogo')} className="px-3.5 py-2 rounded-lg border border-line font-body text-xs text-ink">
            {copiado === 'catalogo' ? '✓ Copiado' : '📋 Copiar mensaje'}
          </button>
          <button type="button" onClick={() => copiar(linkTienda.replace('?ref=whatsapp', '?ref=bio'), 'link')} className="px-3.5 py-2 rounded-lg border border-line font-body text-xs text-ink">
            {copiado === 'link' ? '✓ Copiado' : '🔗 Copiar solo el link'}
          </button>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="font-body text-sm font-semibold text-ink mb-3">💡 Ideas para vender más</div>
        <div className="grid gap-2">
          {ideas.map((i) => (
            <div key={i.t} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-panelalt">
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm text-ink font-medium">{i.t}</div>
                <div className="font-body text-[12px] text-inksoft">{i.d}</div>
              </div>
              {i.s && (
                <button type="button" onClick={() => irA(i.s)} className="font-body text-xs text-teal font-semibold shrink-0 mt-0.5">Ir ›</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
