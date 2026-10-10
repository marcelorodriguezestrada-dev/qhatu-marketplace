'use client'

import { useEffect, useMemo, useState } from 'react'
import { linkCampana } from '@/lib/campanas'
import { useTodasLasCiudades } from '@/lib/ciudad'
import {
  CONFIG_POR_DEFECTO, ESTADOS_PUBLICACION, FORMATOS, OBJETIVOS_PUBLICACION, REDES_LANZAMIENTO,
  diasEntre, faseDe, fasesLanzamiento, sumarDias, type ConfigLanzamiento, type Publicacion,
} from '@/lib/lanzamiento'
import { SITE_URL } from '@/lib/sitio'

// Admin → Marketing → "🚀 Plan de lanzamiento": fecha y metas, las 4
// fases, el calendario de publicaciones por red (la IA lo arma), cada
// publicación con su texto listo, su idea y su link rastreable, y los
// resultados de cada una (visitas, cuentas, tiendas, compras).

type Metricas = Record<string, number> | null
type Pub = Publicacion & { metricas: Metricas }
type Propuesta = Omit<Publicacion, 'id' | 'createdAt' | 'campanaId'> & { elegida?: boolean }

const hoyBolivia = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
const red = (id: string) => REDES_LANZAMIENTO.find((r) => r.id === id) || REDES_LANZAMIENTO[0]
const formato = (id: string) => FORMATOS.find((f) => f.id === id)?.label || id
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaLarga = (iso: string) => {
  const t = new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const input = 'w-full px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs'
const etiqueta = 'block font-body text-[11px] text-inksoft mb-0.5'

function Copiar({ texto, label = 'Copiar' }: { texto: string; label?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {}) }} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-[11px] font-semibold text-ink shrink-0">
      {ok ? '✓ Copiado' : label}
    </button>
  )
}

export default function AdminLanzamiento({ password }: { password: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const ciudades = useTodasLasCiudades()
  const [cfg, setCfg] = useState<ConfigLanzamiento>(CONFIG_POR_DEFECTO)
  const [pubs, setPubs] = useState<Pub[] | null>(null)
  const [editandoPlan, setEditandoPlan] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [mes, setMes] = useState(hoyBolivia().slice(0, 7))
  const [abierta, setAbierta] = useState<string | null>(null)
  // IA
  const [iaAbierta, setIaAbierta] = useState(false)
  const [iaDesde, setIaDesde] = useState(hoyBolivia())
  const [iaDias, setIaDias] = useState(14)
  const [iaExtra, setIaExtra] = useState('')
  const [iaCargando, setIaCargando] = useState(false)
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null)
  const [conIA, setConIA] = useState(true)
  // Manual
  const [nueva, setNueva] = useState<Propuesta | null>(null)

  async function cargar() {
    const d = await fetch('/api/admin/lanzamiento', { headers }).then((r) => r.json()).catch(() => null)
    if (d?.config) setCfg(d.config)
    setPubs(d?.publicaciones || [])
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarPlan() {
    const d = await fetch('/api/admin/lanzamiento', { method: 'POST', headers, body: JSON.stringify({ config: cfg }) }).then((r) => r.json()).catch(() => null)
    if (d?.config) { setCfg(d.config); setEditandoPlan(false); setMensaje('Plan guardado ✓') } else setMensaje('No se pudo guardar el plan.')
  }

  async function pedirIA() {
    setIaCargando(true)
    setPropuestas(null)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/lanzamiento/ia', { method: 'POST', headers, body: JSON.stringify({ desde: iaDesde, dias: iaDias, extra: iaExtra }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setConIA(d.conIA)
      setPropuestas((d.propuestas || []).map((p: Propuesta) => ({ ...p, elegida: true })))
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo armar el calendario.')
    } finally {
      setIaCargando(false)
    }
  }

  async function agregar(lista: Propuesta[]) {
    const d = await fetch('/api/admin/lanzamiento/publicaciones', { method: 'POST', headers, body: JSON.stringify({ publicaciones: lista }) }).then((r) => r.json()).catch(() => null)
    if (d?.creadas) {
      setMensaje(`✓ ${d.creadas.length} publicación(es) en el calendario, cada una con su link.`)
      setPropuestas(null)
      setIaAbierta(false)
      setNueva(null)
      if (lista[0]?.fecha) setMes(lista[0].fecha.slice(0, 7))
      cargar()
    } else setMensaje(d?.error || 'No se pudo guardar.')
  }

  async function cambiar(id: string, cambios: Partial<Publicacion>) {
    setPubs((prev) => (prev || []).map((p) => (p.id === id ? { ...p, ...cambios } : p)))
    await fetch('/api/admin/lanzamiento/publicaciones', { method: 'PATCH', headers, body: JSON.stringify({ id, cambios }) }).catch(() => null)
  }

  async function borrar(id: string) {
    setPubs((prev) => (prev || []).filter((p) => p.id !== id))
    setAbierta(null)
    await fetch(`/api/admin/lanzamiento/publicaciones?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers }).catch(() => null)
  }

  const hoy = hoyBolivia()
  const faltan = diasEntre(hoy, cfg.fecha)
  const fases = fasesLanzamiento(cfg.fecha)
  const faseHoy = faseDe(cfg.fecha, hoy)
  const total = useMemo(() => {
    const t = { visitas: 0, registros: 0, pedidos: 0, vendedores: 0, ventasBs: 0 }
    for (const p of pubs || []) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += p.metricas?.[k] || 0
    return t
  }, [pubs])
  const linkDe = (p: Pub) => (p.campanaId ? linkCampana(SITE_URL, { id: p.campanaId, destino: OBJETIVOS_PUBLICACION.find((o) => o.id === p.objetivo)?.destino || '/' }) : '')
  const textoFinal = (p: Pub) => `${p.texto.replaceAll('{LINK}', linkDe(p))}${p.hashtags ? `\n\n${p.hashtags}` : ''}`
  const deHoy = (pubs || []).filter((p) => p.fecha === hoy)

  // Celdas del mes (empieza el lunes).
  const celdas = useMemo(() => {
    const [y, m] = mes.split('-').map(Number)
    const primero = `${mes}-01`
    const dow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
    const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const out: (string | null)[] = Array(dow).fill(null)
    for (let i = 0; i < diasMes; i++) out.push(sumarDias(primero, i))
    while (out.length % 7) out.push(null)
    return out
  }, [mes])
  const cambiarMes = (n: number) => {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMes(d.toISOString().slice(0, 7))
  }
  const pubAbierta = (pubs || []).find((p) => p.id === abierta) || null
  const ranking = [...(pubs || [])].filter((p) => p.metricas && (p.metricas.visitas || p.metricas.pedidos)).sort((a, b) => (b.metricas!.pedidos - a.metricas!.pedidos) || (b.metricas!.visitas - a.metricas!.visitas))
  const porRed = REDES_LANZAMIENTO.map((r) => {
    const de = (pubs || []).filter((p) => p.red === r.id)
    return { ...r, n: de.length, publicadas: de.filter((p) => p.estado === 'publicada').length, visitas: de.reduce((s, p) => s + (p.metricas?.visitas || 0), 0), pedidos: de.reduce((s, p) => s + (p.metricas?.pedidos || 0), 0) }
  }).filter((r) => r.n > 0)

  return (
    <div className="grid gap-4">
      {/* Cabecera: fecha, cuenta regresiva y metas */}
      <div className="rounded-xl p-4 text-white bg-marca" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(22,195,91,.22), transparent 50%)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-body text-[10px] font-bold tracking-[0.16em] text-verde uppercase">🚀 Plan de lanzamiento · {ciudades.find((c) => c.id === cfg.ciudad)?.nombre || 'Potosí'}</div>
            <div className="font-display text-xl font-bold mt-1">{fechaLarga(cfg.fecha)}</div>
            <div className="font-body text-xs text-white/70 mt-1">Hoy estás en la fase <b className="text-white">{faseHoy.label}</b>: {faseHoy.que}</div>
          </div>
          <div className="text-center bg-marcaalt rounded-lg px-4 py-2">
            <div className="font-display text-3xl font-bold text-verde leading-none tabular-nums">{faltan > 0 ? faltan : faltan === 0 ? '¡Hoy!' : `+${-faltan}`}</div>
            <div className="font-body text-[10px] text-white/70">{faltan > 0 ? 'días para el lanzamiento' : faltan === 0 ? 'es el lanzamiento' : 'días desde el lanzamiento'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {fases.map((f) => (
            <div key={f.id} className={`rounded-lg px-2.5 py-2 bg-marcaalt border-t-[3px] ${f.id === faseHoy.id ? 'border-verde' : 'border-white/15'}`}>
              <div className="font-body text-xs font-bold">{f.label}</div>
              <div className="font-body text-[10px] text-white/60">{f.desde.slice(8)}/{f.desde.slice(5, 7)} – {f.hasta.slice(8)}/{f.hasta.slice(5, 7)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {([['visitas', 'Visitas por tus links'], ['registros', 'Cuentas nuevas'], ['pedidos', 'Compras'], ['vendedores', 'Tiendas nuevas']] as const).map(([k, l]) => {
            const meta = cfg.metas[k]
            const pct = meta ? Math.min(100, Math.round((total[k] / meta) * 100)) : 0
            return (
              <div key={k} className="rounded-lg px-2.5 py-2 bg-marcaalt">
                <div className="font-display text-lg font-bold tabular-nums">{total[k].toLocaleString('es-BO')}<span className="font-body text-[11px] text-white/50"> / {meta.toLocaleString('es-BO')}</span></div>
                <div className="font-body text-[10px] text-white/60">{l}</div>
                <div className="h-1.5 rounded bg-white/10 mt-1 overflow-hidden"><div className="h-full bg-verde" style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={() => setEditandoPlan((v) => !v)} className="px-3 py-1.5 rounded-md border border-white/25 bg-transparent text-white font-body text-xs font-semibold">⚙️ Fecha, metas y promos</button>
          <button type="button" onClick={() => { setIaAbierta(true); setPropuestas(null) }} className="px-3 py-1.5 rounded-md bg-verde text-marca border-none font-body text-xs font-bold">✨ Armar calendario con IA</button>
          <button type="button" onClick={() => setNueva({ fecha: hoy, red: 'tiktok', formato: 'video', titulo: '', idea: '', texto: '👉 {LINK}', hashtags: '', objetivo: 'compradores', estado: 'pendiente' })} className="px-3 py-1.5 rounded-md border border-white/25 bg-transparent text-white font-body text-xs font-semibold">➕ Publicación a mano</button>
        </div>
      </div>

      {mensaje && <div className="font-body text-xs text-teal">{mensaje}</div>}

      {editandoPlan && (
        <div className="bg-panel border border-teal rounded-xl p-4 grid gap-2.5">
          <div className="font-body text-sm font-semibold text-ink">⚙️ Plan de lanzamiento</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label><span className={etiqueta}>Fecha del lanzamiento</span><input id="lz-fecha" type="date" value={cfg.fecha} onChange={(e) => setCfg({ ...cfg, fecha: e.target.value })} className={input} /></label>
            <label><span className={etiqueta}>Ciudad</span>
              <select id="lz-ciudad" value={cfg.ciudad} onChange={(e) => setCfg({ ...cfg, ciudad: e.target.value })} className={input}>{ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([['visitas', 'Meta de visitas'], ['registros', 'Meta de cuentas'], ['pedidos', 'Meta de compras'], ['vendedores', 'Meta de tiendas']] as const).map(([k, l]) => (
              <label key={k}><span className={etiqueta}>{l}</span><input id={`lz-meta-${k}`} type="number" min={0} value={cfg.metas[k]} onChange={(e) => setCfg({ ...cfg, metas: { ...cfg.metas, [k]: Number(e.target.value) } })} className={input} /></label>
            ))}
          </div>
          <label><span className={etiqueta}>Promos reales del lanzamiento (la IA usa solo estas)</span><textarea id="lz-promos" rows={2} value={cfg.promos} onChange={(e) => setCfg({ ...cfg, promos: e.target.value })} className={input} /></label>
          <div className="flex flex-wrap gap-3 font-body text-xs text-ink">
            {REDES_LANZAMIENTO.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={cfg.redes.includes(r.id)} onChange={(e) => setCfg({ ...cfg, redes: e.target.checked ? [...cfg.redes, r.id] : cfg.redes.filter((x) => x !== r.id) })} className="accent-teal" />
                {r.icono} {r.label}
              </label>
            ))}
          </div>
          <div><button type="button" onClick={guardarPlan} className="px-3 py-1.5 rounded-md bg-ink text-white border-none font-body text-xs font-semibold">Guardar plan</button></div>
        </div>
      )}

      {/* IA: propuesta de calendario */}
      {iaAbierta && (
        <div className="bg-panel border border-teal rounded-xl p-4 grid gap-2.5">
          <div className="flex items-center justify-between"><div className="font-body text-sm font-semibold text-ink">✨ Calendario con IA</div><button type="button" onClick={() => { setIaAbierta(false); setPropuestas(null) }} className="font-body text-xs text-inksoft bg-transparent border-none">Cerrar ✕</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label><span className={etiqueta}>Desde</span><input id="ia-desde" type="date" value={iaDesde} onChange={(e) => setIaDesde(e.target.value)} className={input} /></label>
            <label><span className={etiqueta}>Cuántos días</span>
              <select id="ia-dias" value={iaDias} onChange={(e) => setIaDias(Number(e.target.value))} className={input}><option value={7}>1 semana</option><option value={14}>2 semanas</option><option value={21}>3 semanas</option><option value={30}>1 mes</option></select>
            </label>
            <label className="col-span-2"><span className={etiqueta}>Algo más para la IA (opcional)</span><input id="ia-extra" value={iaExtra} onChange={(e) => setIaExtra(e.target.value)} placeholder="Ej: tengo un video de una tienda de ropa; más TikTok que Facebook" className={input} /></label>
          </div>
          <div><button type="button" onClick={pedirIA} disabled={iaCargando} className="px-3 py-1.5 rounded-md bg-verde text-marca border-none font-body text-xs font-bold disabled:opacity-50">{iaCargando ? 'Armando… (puede tardar unos segundos)' : propuestas ? '↻ Armar otra propuesta' : '✨ Armar propuesta'}</button></div>
          {propuestas && (
            <>
              {!conIA && <div className="font-body text-[11px] text-ochre">La IA no respondió: te dejo una semana tipo según la fase. Podés editar cada publicación después.</div>}
              <div className="grid gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                {propuestas.map((p, i) => (
                  <label key={i} className={`flex gap-2.5 items-start border rounded-lg px-3 py-2 cursor-pointer ${p.elegida ? 'border-teal bg-tealsoft/40' : 'border-line opacity-60'}`}>
                    <input type="checkbox" checked={!!p.elegida} onChange={(e) => setPropuestas((prev) => prev!.map((x, k) => (k === i ? { ...x, elegida: e.target.checked } : x)))} className="accent-teal mt-1" />
                    <span className="min-w-0">
                      <span className="block font-body text-[11px] text-inksoft">{fechaLarga(p.fecha)} · <b style={{ color: red(p.red).color }}>{red(p.red).icono} {red(p.red).label}</b> · {formato(p.formato)}</span>
                      <span className="block font-body text-sm font-semibold text-ink">{p.titulo}</span>
                      {p.idea && <span className="block font-body text-xs text-inksoft">🎬 {p.idea}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div><button type="button" onClick={() => agregar(propuestas.filter((p) => p.elegida))} disabled={!propuestas.some((p) => p.elegida)} className="px-3 py-1.5 rounded-md bg-ink text-white border-none font-body text-xs font-semibold disabled:opacity-40">Agregar {propuestas.filter((p) => p.elegida).length} al calendario</button></div>
            </>
          )}
        </div>
      )}

      {/* Publicación a mano */}
      {nueva && (
        <div className="bg-panel border border-teal rounded-xl p-4 grid gap-2">
          <div className="flex items-center justify-between"><div className="font-body text-sm font-semibold text-ink">➕ Nueva publicación</div><button type="button" onClick={() => setNueva(null)} className="font-body text-xs text-inksoft bg-transparent border-none">Cerrar ✕</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label><span className={etiqueta}>Día</span><input id="nv-fecha" type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} className={input} /></label>
            <label><span className={etiqueta}>Red</span><select id="nv-red" value={nueva.red} onChange={(e) => setNueva({ ...nueva, red: e.target.value as any })} className={input}>{REDES_LANZAMIENTO.map((r) => <option key={r.id} value={r.id}>{r.icono} {r.label}</option>)}</select></label>
            <label><span className={etiqueta}>Formato</span><select id="nv-formato" value={nueva.formato} onChange={(e) => setNueva({ ...nueva, formato: e.target.value })} className={input}>{FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            <label><span className={etiqueta}>Para</span><select id="nv-obj" value={nueva.objetivo} onChange={(e) => setNueva({ ...nueva, objetivo: e.target.value })} className={input}>{OBJETIVOS_PUBLICACION.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          </div>
          <label><span className={etiqueta}>Título</span><input id="nv-titulo" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} placeholder="Ej: Teaser “se viene”" className={input} /></label>
          <label><span className={etiqueta}>Idea / qué grabar</span><textarea id="nv-idea" rows={2} value={nueva.idea} onChange={(e) => setNueva({ ...nueva, idea: e.target.value })} className={input} /></label>
          <label><span className={etiqueta}>Texto (poné {'{LINK}'} donde va el link)</span><textarea id="nv-texto" rows={3} value={nueva.texto} onChange={(e) => setNueva({ ...nueva, texto: e.target.value })} className={input} /></label>
          <div><button type="button" onClick={() => agregar([nueva])} disabled={!nueva.titulo.trim()} className="px-3 py-1.5 rounded-md bg-ink text-white border-none font-body text-xs font-semibold disabled:opacity-40">Agregar al calendario</button></div>
        </div>
      )}

      {/* Hoy */}
      {deHoy.length > 0 && (
        <div className="bg-verdesoft border border-verde rounded-xl p-3">
          <div className="font-body text-sm font-semibold text-ink mb-1.5">📌 Para publicar hoy</div>
          <div className="flex flex-wrap gap-2">
            {deHoy.map((p) => (
              <button key={p.id} type="button" onClick={() => setAbierta(p.id)} className="px-3 py-1.5 rounded-lg bg-panel border border-line font-body text-xs text-ink text-left">
                <b style={{ color: red(p.red).color }}>{red(p.red).icono} {red(p.red).label}</b> · {p.titulo} · {ESTADOS_PUBLICACION.find((e) => e.id === p.estado)?.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendario del mes */}
      <div className="bg-panel border border-line rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button type="button" onClick={() => cambiarMes(-1)} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-xs">‹</button>
          <div className="font-display text-base font-bold text-ink capitalize">{MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</div>
          <button type="button" onClick={() => cambiarMes(1)} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-xs">›</button>
        </div>
        {!pubs ? (
          <div className="font-body text-xs text-inksoft">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 min-w-[640px]">
              {DIAS.map((d) => <div key={d} className="font-body text-[10px] font-bold text-inksoft text-center py-1">{d}</div>)}
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} />
                const del = pubs.filter((p) => p.fecha === dia)
                const esLanz = dia === cfg.fecha
                return (
                  <div key={dia} className={`min-h-[84px] rounded-md p-1 flex flex-col gap-1 ${esLanz ? 'bg-verdesoft ring-2 ring-verde' : dia === hoy ? 'bg-tealsoft' : 'bg-panelalt'}`}>
                    <div className="font-body text-[10px] font-bold text-inksoft flex justify-between"><span>{Number(dia.slice(8))}</span>{esLanz && <span className="text-verdeoscuro">🚀</span>}</div>
                    {del.map((p) => (
                      <button key={p.id} type="button" onClick={() => setAbierta(p.id)} className="text-left rounded px-1 py-0.5 bg-panel border border-line font-body text-[10px] leading-tight text-ink truncate" style={{ borderLeft: `3px solid ${red(p.red).color}`, opacity: p.estado === 'publicada' ? 0.65 : 1 }} title={p.titulo}>
                        {p.estado === 'publicada' ? '✓ ' : p.estado === 'lista' ? '● ' : ''}{red(p.red).icono} {p.titulo}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-2 font-body text-[11px] text-inksoft">
          {REDES_LANZAMIENTO.map((r) => <span key={r.id}><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-[-1px]" style={{ background: r.color }} />{r.label}</span>)}
          <span>● lista · ✓ publicada · 🚀 lanzamiento</span>
        </div>
      </div>

      {/* Detalle de una publicación */}
      {pubAbierta && (
        <div className="fixed inset-0 z-40 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAbierta(null)}>
          <div className="bg-panel w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 grid gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-body text-[11px] text-inksoft">{fechaLarga(pubAbierta.fecha)} · <b style={{ color: red(pubAbierta.red).color }}>{red(pubAbierta.red).icono} {red(pubAbierta.red).label}</b> · {formato(pubAbierta.formato)}</div>
                <div className="font-display text-lg font-bold text-ink">{pubAbierta.titulo}</div>
              </div>
              <button type="button" onClick={() => setAbierta(null)} className="font-body text-sm text-inksoft bg-transparent border-none">✕</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS_PUBLICACION.map((e) => (
                <button key={e.id} type="button" onClick={() => cambiar(pubAbierta.id, { estado: e.id })} className={`px-2.5 py-1 rounded-full border font-body text-xs ${pubAbierta.estado === e.id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{e.label}</button>
              ))}
            </div>
            {pubAbierta.idea && <div className="bg-panelalt rounded-lg p-3 font-body text-sm text-ink"><div className="font-semibold text-xs text-inksoft mb-0.5">🎬 Qué grabar / diseñar</div>{pubAbierta.idea}</div>}
            <div className="bg-panelalt rounded-lg p-3">
              <div className="flex items-center justify-between mb-1"><span className="font-semibold font-body text-xs text-inksoft">📝 Texto para pegar</span><Copiar texto={textoFinal(pubAbierta)} /></div>
              <div className="font-body text-sm text-ink whitespace-pre-wrap break-words">{textoFinal(pubAbierta)}</div>
            </div>
            {pubAbierta.campanaId && (
              <div className="flex items-center gap-2 bg-panelalt rounded-lg p-3">
                <div className="min-w-0 flex-1"><div className="font-semibold font-body text-xs text-inksoft">🔗 Link rastreable (ponelo en la bio o en el post)</div><div className="font-body text-xs text-ink break-all">{linkDe(pubAbierta)}</div></div>
                <Copiar texto={linkDe(pubAbierta)} />
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 text-center">
              {([['visitas', 'Visitas'], ['registros', 'Cuentas'], ['vendedores', 'Tiendas'], ['pedidos', 'Compras']] as const).map(([k, l]) => (
                <div key={k} className="bg-panelalt rounded-lg py-2"><div className="font-display text-lg font-bold text-ink tabular-nums">{pubAbierta.metricas?.[k] || 0}</div><div className="font-body text-[10px] text-inksoft">{l}</div></div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="font-body text-xs text-inksoft">Mover al día <input id="det-fecha" type="date" value={pubAbierta.fecha} onChange={(e) => e.target.value && cambiar(pubAbierta.id, { fecha: e.target.value })} className="ml-1 px-2 py-1 rounded-md border border-line bg-panel font-body text-xs" /></label>
              <span className="flex-1" />
              <button type="button" onClick={() => borrar(pubAbierta.id)} className="font-body text-xs text-maroon underline bg-transparent border-none">Sacar del calendario</button>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="font-body text-sm font-semibold text-ink mb-1">📊 Qué está funcionando</div>
        <div className="font-body text-[11px] text-inksoft mb-3">Cada publicación cuenta las visitas que entraron por su link, y lo que esas personas hicieron después durante 30 días: crear su cuenta, abrir una tienda, comprar.</div>
        {porRed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {porRed.map((r) => (
              <div key={r.id} className="rounded-lg bg-panelalt p-2.5" style={{ borderTop: `3px solid ${r.color}` }}>
                <div className="font-body text-xs font-bold text-ink">{r.icono} {r.label}</div>
                <div className="font-body text-[11px] text-inksoft">{r.publicadas}/{r.n} publicadas · {r.visitas} visitas · {r.pedidos} compras</div>
              </div>
            ))}
          </div>
        )}
        {ranking.length === 0 ? (
          <div className="font-body text-xs text-inksoft">Todavía no hay visitas por los links de las publicaciones. Cuando publiques y la gente entre, acá vas a ver cuál trae más.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-xs tabular-nums">
              <thead><tr className="text-inksoft text-[10px] uppercase tracking-wider"><th className="text-left py-1.5 pr-2">Publicación</th><th className="text-right px-2">Visitas</th><th className="text-right px-2">Cuentas</th><th className="text-right px-2">Tiendas</th><th className="text-right px-2">Compras</th><th className="text-right pl-2">Bs</th></tr></thead>
              <tbody>
                {ranking.slice(0, 15).map((p) => (
                  <tr key={p.id} className="border-t border-line cursor-pointer hover:bg-panelalt" onClick={() => setAbierta(p.id)}>
                    <td className="py-1.5 pr-2 whitespace-nowrap"><span style={{ color: red(p.red).color }}>{red(p.red).icono}</span> {p.titulo} <span className="text-inksoft">· {p.fecha.slice(8)}/{p.fecha.slice(5, 7)}</span></td>
                    <td className="text-right px-2">{p.metricas!.visitas}</td>
                    <td className="text-right px-2">{p.metricas!.registros}</td>
                    <td className="text-right px-2">{p.metricas!.vendedores}</td>
                    <td className="text-right px-2 font-semibold">{p.metricas!.pedidos}</td>
                    <td className="text-right pl-2">{Math.round(p.metricas!.ventasBs || 0).toLocaleString('es-BO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
