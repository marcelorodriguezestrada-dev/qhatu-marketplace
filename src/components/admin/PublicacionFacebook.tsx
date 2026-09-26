'use client'

import { useEffect, useMemo, useState } from 'react'

// Admin → Anuncios → "📣 Armar publicación para Facebook": junta lo que la
// gente BUSCA / NECESITA (anuncios "Busco…") de los últimos días, agrupado
// por rubro y sin datos personales, y arma un texto listo para pegar en
// grupos de Facebook invitando a quien lo ofrezca a sumarse a Clasi Click
// ("te conectamos"). Se recuerda qué pedidos ya se publicaron para no
// repetirlos en la próxima publicación.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasiclick.ezeti.pro').replace(/\/$/, '')
const CLAVE = 'clasiclick_publicados_facebook'

type Anuncio = { id: string; titulo?: string; descripcion?: string; tipo?: string; estado?: string; rubro?: string; createdAt?: string }

// Saca teléfonos, emails, links y "llamar al…" — en Facebook solo va QUÉ
// se necesita, nunca quién lo pide.
export function limpiarPedido(texto: string): string {
  let t = String(texto || '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\+?\d[\d\s-]{6,}\d)/g, '')
    .replace(/\b(llam(ar|en|e)|escrib(ir|an|e)|contact(o|ar)|whats?app|wsp|cel(ular)?|inbox|al privado)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.replace(/^(se\s+)?(busc[oa]|necesit[oa]|requier[oe]|solicit[oa]|urgente[:,]?\s*)\s*(un[oa]?\s+)?/i, '')
  t = t.replace(/[\s,.;:-]+$/, '')
  return t ? t.charAt(0).toUpperCase() + t.slice(1, 90) : ''
}

export default function PublicacionFacebook({ anuncios, rubroLabel }: { anuncios: Anuncio[]; rubroLabel: (id?: string) => string | undefined }) {
  const [dias, setDias] = useState(14)
  const [incluirAprobados, setIncluirAprobados] = useState(true)
  const [soloNuevos, setSoloNuevos] = useState(true)
  const [publicados, setPublicados] = useState<Record<string, string>>({})
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set())
  const [texto, setTexto] = useState('')
  const [editado, setEditado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    try { setPublicados(JSON.parse(localStorage.getItem(CLAVE) || '{}')) } catch {}
  }, [])

  const candidatos = useMemo(() => {
    const desde = Date.now() - dias * 86400_000
    return anuncios
      .filter((a) => a.tipo === 'busqueda')
      .filter((a) => ['pendiente_revision', 'info_solicitada'].includes(a.estado || '') || (incluirAprobados && a.estado === 'aprobado'))
      .filter((a) => (Date.parse(a.createdAt || '') || 0) >= desde)
      .filter((a) => !soloNuevos || !publicados[a.id])
      .map((a) => ({ ...a, pedido: limpiarPedido(a.titulo || a.descripcion || ''), grupo: rubroLabel(a.rubro) || 'Otros pedidos' }))
      .filter((a) => a.pedido.length >= 3)
      .sort((x, y) => x.grupo.localeCompare(y.grupo) || (y.createdAt || '').localeCompare(x.createdAt || ''))
  }, [anuncios, dias, incluirAprobados, soloNuevos, publicados, rubroLabel])

  const elegidos = candidatos.filter((a) => !excluidos.has(a.id))

  function armarTexto() {
    const grupos = new Map<string, string[]>()
    for (const a of elegidos) {
      const lista = grupos.get(a.grupo) || []
      if (!lista.some((p) => p.toLowerCase() === a.pedido.toLowerCase())) lista.push(a.pedido)
      grupos.set(a.grupo, lista)
    }
    const entradas = Array.from(grupos.entries())
    const cuerpo =
      entradas.length === 1
        ? entradas[0][1].map((p) => `• ${p}`).join('\n')
        : entradas.map(([g, ps]) => `🔹 ${g}\n${ps.map((p) => `   • ${p}`).join('\n')}`).join('\n\n')
    const cuando = dias <= 7 ? 'Esta semana' : dias <= 14 ? 'Estos días' : 'Este mes'
    return (
      `📢 ¡SE NECESITA EN POTOSÍ! 📢\n\n` +
      `${cuando} vecinos de Potosí están buscando:\n\n${cuerpo}\n\n` +
      `🙋 ¿Ofrecés alguno de estos servicios o productos?\n` +
      `Sumate GRATIS a Clasi Click y te conectamos directo con quien lo necesita 🤝\n\n` +
      `👉 Profesionales y oficios: ${SITE}/publicar-servicio\n` +
      `👉 Vendedores y tiendas: ${SITE}/vender\n\n` +
      `Clasi Click — emprendimiento 100% potosino que conecta a quien busca con quien ofrece. 🇧🇴`
    )
  }

  // El texto se regenera solo mientras no lo hayas editado a mano.
  useEffect(() => {
    if (!editado) setTexto(elegidos.length ? armarTexto() : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos, excluidos, editado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {}
  }

  function marcarPublicados() {
    const ahora = new Date().toISOString()
    const nuevo = { ...publicados }
    for (const a of elegidos) nuevo[a.id] = ahora
    setPublicados(nuevo)
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)) } catch {}
    setEditado(false)
  }

  return (
    <div className="bg-panel border border-indigo-200 rounded-xl p-4 mb-6">
      <div className="font-body text-sm font-semibold text-ink mb-1">📣 Publicación para Facebook: “Se necesita en Potosí”</div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        Junta los anuncios “Busco…” agrupados por rubro, sin nombres ni teléfonos, e invita a quien lo ofrezca a sumarse a Clasi Click. Copiá el texto y pegalo en tus grupos de Facebook.
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3 font-body text-xs text-ink">
        <label className="flex items-center gap-1.5">
          De los últimos
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-line bg-panel">
            {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} días</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={incluirAprobados} onChange={(e) => setIncluirAprobados(e.target.checked)} className="accent-teal" />
          Incluir los ya aprobados
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={soloNuevos} onChange={(e) => setSoloNuevos(e.target.checked)} className="accent-teal" />
          Solo los que todavía no publiqué
        </label>
      </div>

      {candidatos.length === 0 ? (
        <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg px-3 py-2.5">
          No hay pedidos “Busco…” en este período{soloNuevos ? ' que no hayas publicado ya' : ''}. Probá con más días.
        </div>
      ) : (
        <>
          <div className="font-body text-[11px] text-inksoft mb-1.5">Pedidos incluidos ({elegidos.length} de {candidatos.length}) — destildá los que no quieras publicar:</div>
          <div className="max-h-44 overflow-y-auto border border-line rounded-lg mb-3">
            {candidatos.map((a) => (
              <label key={a.id} className="flex items-start gap-2 px-2.5 py-1.5 border-b border-line last:border-b-0 font-body text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={!excluidos.has(a.id)}
                  onChange={(e) => {
                    setEditado(false)
                    setExcluidos((prev) => {
                      const n = new Set(prev)
                      if (e.target.checked) n.delete(a.id)
                      else n.add(a.id)
                      return n
                    })
                  }}
                  className="accent-teal mt-0.5"
                />
                <span className="flex-1">
                  {a.pedido}
                  <span className="text-inksoft"> · {a.grupo}{publicados[a.id] ? ' · ya publicado' : ''}</span>
                </span>
              </label>
            ))}
          </div>

          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setEditado(true) }}
            rows={12}
            className="w-full px-3 py-2 rounded-lg border border-line bg-panelalt font-body text-xs mb-2 whitespace-pre-wrap"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copiar} className="px-4 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-sm font-semibold">
              {copiado ? '✓ Copiado' : '📋 Copiar texto'}
            </button>
            <button type="button" onClick={marcarPublicados} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink" title="La próxima vez no se vuelven a incluir (con “Solo los que todavía no publiqué”)">
              ✓ Ya lo publiqué — marcar estos {elegidos.length}
            </button>
            {editado && (
              <button type="button" onClick={() => setEditado(false)} className="font-body text-xs text-teal underline">Volver a generar</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
