'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { REDES_MARKETING } from '@/lib/marketing'
import { OBJETIVOS_ESTRATEGIA, type Estrategia, type FechaEspecial, type ObjetivoEstrategia } from '@/lib/fechasEspeciales'

// Vender → Marketing → "🎯 Estrategia con IA": el vendedor elige un
// objetivo (lo más visto, lo que no se vende, una fecha especial...) y la
// IA le arma un plan de 7 días con sus productos y sus números. Cada día
// tiene "Armar esta publicación", que carga los productos en "Crear
// publicación" (así sale con su imagen y su link rastreado).

export type ArmarPublicacion = { productoIds: string[]; red: string; tono: string }

const fechaCorta = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })
const cuandoFalta = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`)
const red = (id: string) => REDES_MARKETING.find((r) => r.id === id) || { icono: '📣', label: id }

export default function EstrategiaIA({ productos, precio, onArmar }: { productos: any[]; precio: (p: any) => string; onArmar: (a: ArmarPublicacion) => void }) {
  const { usuario, obtenerToken } = useAuth()
  const [cargado, setCargado] = useState(false)
  const [estrategia, setEstrategia] = useState<Estrategia | null>(null)
  const [fechas, setFechas] = useState<FechaEspecial[]>([])
  const [premium, setPremium] = useState(false)
  const [puedeGenerar, setPuedeGenerar] = useState(true)
  const [proximaGratis, setProximaGratis] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false) // mostrando el formulario aunque haya una guardada
  const [objetivo, setObjetivo] = useState<ObjetivoEstrategia>('mas-vistos')
  const [fechaId, setFechaId] = useState('')
  const [pedido, setPedido] = useState('')
  const [armando, setArmando] = useState(false)
  const [error, setError] = useState('')

  const porId = (id: string) => productos.find((p) => p.id === id)

  async function llamar(metodo: 'GET' | 'POST', body?: unknown) {
    const token = await obtenerToken()
    const res = await fetch('/api/marketing/estrategia', {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { ok: res.ok, d: await res.json().catch(() => ({})) }
  }

  useEffect(() => {
    if (!usuario) return
    llamar('GET')
      .then(({ ok, d }) => {
        if (!ok) return
        setEstrategia(d.estrategia)
        setFechas(d.fechas || [])
        setPremium(!!d.premium)
        setPuedeGenerar(d.puedeGenerar !== false)
        setProximaGratis(d.proximaGratis || null)
        if (d.fechas?.[0]) setFechaId(d.fechas[0].id)
      })
      .catch(() => {})
      .finally(() => setCargado(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function armar() {
    setArmando(true)
    setError('')
    try {
      const { ok, d } = await llamar('POST', { objetivo, fechaId, pedido })
      if (!ok) {
        if (d.proximaGratis) {
          setPuedeGenerar(false)
          setProximaGratis(d.proximaGratis)
        }
        throw new Error(d.error || 'No se pudo armar la estrategia.')
      }
      setEstrategia(d.estrategia)
      setPuedeGenerar(d.puedeGenerar !== false)
      setProximaGratis(d.proximaGratis || null)
      setNueva(false)
    } catch (e: any) {
      setError(e?.message || 'No se pudo armar la estrategia.')
    } finally {
      setArmando(false)
    }
  }

  async function marcarHecho(dia: number, hecho: boolean) {
    if (!estrategia) return
    setEstrategia({ ...estrategia, dias: estrategia.dias.map((d) => (d.dia === dia ? { ...d, hecho } : d)) })
    llamar('POST', { accion: 'hecho', dia, hecho }).catch(() => {})
  }

  if (!cargado) return null

  const fechaProxima = proximaGratis ? new Date(proximaGratis).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const mostrarFormulario = !estrategia || nueva
  const hechos = estrategia?.dias.filter((d) => d.hecho).length || 0

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div className="font-body text-sm font-semibold text-ink">🎯 Estrategia con IA</div>
        {!premium && <span className="font-body text-[11px] text-inksoft bg-panelalt rounded-full px-2.5 py-0.5">Gratis: 1 por semana · ⭐ Premium: ilimitadas</span>}
      </div>
      <div className="font-body text-[12px] text-inksoft mb-4">Decinos qué querés lograr y te armamos un plan de una semana con tus productos y tus números: qué publicar, dónde y a qué hora.</div>

      {mostrarFormulario && (
        <div>
          <div className="font-body text-xs font-semibold text-ink mb-2">¿Qué querés lograr?</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            {OBJETIVOS_ESTRATEGIA.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setObjetivo(o.id)}
                className={`text-left rounded-lg border-2 px-3 py-2.5 ${objetivo === o.id ? 'border-maroon bg-maroonsoft' : 'border-line bg-panel hover:border-maroon/40'}`}
              >
                <div className={`font-body text-sm ${objetivo === o.id ? 'text-maroon font-semibold' : 'text-ink'}`}>{o.label}</div>
                <div className="font-body text-[11px] text-inksoft leading-snug mt-0.5">{o.ayuda}</div>
              </button>
            ))}
          </div>

          {objetivo === 'fecha' && (
            <div className="mb-3">
              <div className="font-body text-xs font-semibold text-ink mb-2">¿Para qué fecha?</div>
              {fechas.length === 0 ? (
                <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg px-3 py-2.5">No hay fechas especiales en los próximos 2 meses. Probá con otro objetivo o contanos tu idea en “Lo que vos quieras”.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fechas.map((f) => (
                    <button key={`${f.id}-${f.fecha}`} type="button" onClick={() => setFechaId(f.id)} className={`px-3 py-1.5 rounded-full border font-body text-sm ${fechaId === f.id ? 'border-maroon bg-maroonsoft text-maroon font-semibold' : 'border-line bg-panel text-ink'}`}>
                      {f.emoji} {f.nombre} <span className="text-[11px] text-inksoft font-normal">· {cuandoFalta(f.faltan)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <div className="font-body text-xs font-semibold text-ink mb-1.5">{objetivo === 'libre' ? 'Contanos tu objetivo' : 'Algo más que quieras pedir (opcional)'}</div>
            <textarea
              value={pedido}
              onChange={(e) => setPedido(e.target.value.slice(0, 400))}
              rows={2}
              placeholder={objetivo === 'libre' ? 'Ej: quiero vender las zapatillas de niño antes del regreso a clases' : 'Ej: solo quiero publicar en WhatsApp, o no quiero hacer descuentos'}
              className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={armar}
              disabled={armando || !puedeGenerar || (objetivo === 'fecha' && !fechaId) || (objetivo === 'libre' && pedido.trim().length < 5)}
              className="px-5 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-50"
            >
              {armando ? 'Pensando tu estrategia...' : '✨ Armar mi estrategia'}
            </button>
            {estrategia && <button type="button" onClick={() => setNueva(false)} className="font-body text-xs text-inksoft underline">Volver a mi estrategia</button>}
          </div>
          {!puedeGenerar && (
            <div className="font-body text-xs text-ink bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mt-3">
              Ya usaste tu estrategia gratis de esta semana{fechaProxima ? `: la próxima la podés armar el ${fechaProxima}` : ''}. Con ⭐ Premium armás todas las que quieras.
            </div>
          )}
          {error && puedeGenerar && <div className="font-body text-xs text-maroon mt-2">{error}</div>}
        </div>
      )}

      {estrategia && !mostrarFormulario && (
        <div>
          <div className="rounded-xl bg-gradient-to-br from-maroonsoft to-panelalt p-4 mb-4">
            <div className="font-display text-lg font-bold text-ink">{estrategia.titulo}</div>
            {estrategia.fechaEspecial && <div className="font-body text-xs text-maroon font-semibold mt-0.5">{estrategia.fechaEspecial.emoji} {estrategia.fechaEspecial.nombre} · {fechaCorta(estrategia.fechaEspecial.fecha)}</div>}
            <div className="font-body text-sm text-ink mt-2">{estrategia.resumen}</div>
            <div className="font-body text-[11px] text-inksoft mt-2">
              {estrategia.conIA ? '✨ Armada con IA' : 'Plan base (la IA no estuvo disponible)'} · {new Date(estrategia.creadaAt).toLocaleDateString('es-BO')} · {hechos}/{estrategia.dias.length} días hechos
            </div>
          </div>

          <div className="font-body text-xs font-semibold text-ink mb-2">Productos a promocionar</div>
          <div className="grid gap-2 mb-4">
            {estrategia.productos.map((x) => {
              const p = porId(x.id)
              if (!p) return null
              return (
                <div key={x.id} className="flex gap-3 items-start bg-panelalt rounded-lg p-2.5">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-panel shrink-0">
                    {(p.thumbUrl || p.imagenUrl) ? <img src={p.thumbUrl || p.imagenUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🛍️</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-sm text-ink font-medium truncate">{p.nombre} <span className="text-maroon font-bold">{precio(p)}</span></div>
                    <div className="font-body text-[12px] text-inksoft">{x.porque}</div>
                    {x.accion && <div className="font-body text-[12px] text-teal mt-0.5">👉 {x.accion}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {estrategia.oferta && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
              <div className="font-body text-xs font-semibold text-ink">🏷️ Oferta sugerida</div>
              <div className="font-body text-sm text-ink">{estrategia.oferta}</div>
              <div className="font-body text-[11px] text-inksoft mt-1">Es una sugerencia: si la querés usar, cargá el “precio antes” en el producto desde Publicaciones.</div>
            </div>
          )}

          <div className="font-body text-xs font-semibold text-ink mb-2">Tu plan día por día</div>
          <div className="grid gap-2 mb-4">
            {estrategia.dias.map((d) => {
              const r = red(d.red)
              const ps = d.productoIds.map(porId).filter(Boolean) as any[]
              return (
                <div key={d.dia} className={`rounded-lg border p-3 ${d.hecho ? 'border-teal/40 bg-tealsoft/60' : 'border-line bg-panel'}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span className="font-body text-xs font-bold text-ink capitalize">Día {d.dia} · {fechaCorta(d.fecha)}</span>
                    <span className="font-body text-[11px] text-inksoft">{r.icono} {r.label} · 🕖 {d.hora}</span>
                    <label className="ml-auto flex items-center gap-1.5 font-body text-[11px] text-inksoft cursor-pointer">
                      <input type="checkbox" checked={!!d.hecho} onChange={(e) => marcarHecho(d.dia, e.target.checked)} />
                      Hecho
                    </label>
                  </div>
                  <div className={`font-body text-sm ${d.hecho ? 'text-inksoft line-through' : 'text-ink'}`}>{d.idea}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {ps.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-panelalt font-body text-[11px] text-ink max-w-[200px]">
                        <span className="w-5 h-5 rounded-full overflow-hidden bg-panel shrink-0">{(p.thumbUrl || p.imagenUrl) && <img src={p.thumbUrl || p.imagenUrl} alt="" className="w-full h-full object-cover" />}</span>
                        <span className="truncate">{p.nombre}</span>
                      </span>
                    ))}
                    {ps.length > 0 && (
                      <button type="button" onClick={() => onArmar({ productoIds: ps.map((p) => p.id), red: d.red, tono: d.tono })} className="ml-auto px-3 py-1.5 rounded-lg border-none bg-ink text-white font-body text-xs font-semibold">
                        ✍️ Armar esta publicación
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {estrategia.consejos.length > 0 && (
            <div className="mb-4">
              <div className="font-body text-xs font-semibold text-ink mb-1.5">💡 Consejos</div>
              <ul className="list-disc pl-5 grid gap-1">
                {estrategia.consejos.map((c) => <li key={c} className="font-body text-[12px] text-inksoft">{c}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { setNueva(true); setError('') }} className="px-4 py-2 rounded-lg border border-line bg-panel font-body text-xs font-semibold text-ink">
              🔄 Nueva estrategia
            </button>
            <span className="font-body text-[11px] text-inksoft">Al final de la semana mirá en “Tus publicaciones” cuál trajo más visitas y ventas.</span>
          </div>
        </div>
      )}
    </div>
  )
}
