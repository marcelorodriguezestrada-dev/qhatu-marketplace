'use client'

import { useEffect, useState } from 'react'
import { REDES_LANZAMIENTO } from '@/lib/lanzamiento'
import type { Reporte } from '@/lib/reporteMarketing'

// Admin → Marketing → "📊 Reportes": cómo va el lanzamiento contra las
// metas (con la proyección al ritmo de los últimos 7 días), visitas por
// día, qué red y qué formato rinden más, las mejores publicaciones, lo
// atrasado y las recomendaciones de la IA.

const NOMBRE: Record<string, string> = { visitas: 'Visitas', registros: 'Cuentas nuevas', pedidos: 'Compras', vendedores: 'Tiendas nuevas' }
const red = (id: string) => REDES_LANZAMIENTO.find((r) => r.id === id)
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`
const fmt = (n: number) => Math.round(n).toLocaleString('es-BO')

export default function AdminReporteMarketing({ password }: { password: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [dias, setDias] = useState(30)
  const [r, setR] = useState<Reporte | null>(null)
  const [error, setError] = useState('')
  const [ia, setIa] = useState<{ resumen: string; recomendaciones: { titulo: string; detalle: string }[]; conIA: boolean } | null>(null)
  const [iaCargando, setIaCargando] = useState(false)
  const [verTabla, setVerTabla] = useState(false)

  useEffect(() => {
    setR(null)
    fetch(`/api/admin/lanzamiento/reporte?dias=${dias}`, { headers })
      .then((x) => x.json())
      .then((d) => (d.reporte ? setR(d.reporte) : setError(d.error || 'No se pudo armar el reporte.')))
      .catch(() => setError('No se pudo armar el reporte.'))
  }, [dias]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pedirIA() {
    setIaCargando(true)
    const d = await fetch('/api/admin/lanzamiento/reporte', { method: 'POST', headers }).then((x) => x.json()).catch(() => null)
    setIa(d?.recomendaciones ? d : null)
    setIaCargando(false)
  }

  if (error) return <div className="font-body text-xs text-maroon">{error}</div>
  if (!r) return <div className="font-body text-xs text-inksoft">Armando el reporte…</div>

  const maxRed = Math.max(1, ...r.porRed.map((x) => x.visitasPorPublicacion))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg font-bold text-ink">📊 Cómo va el lanzamiento</div>
          <div className="font-body text-[11px] text-inksoft">Todo sale de los links de tus publicaciones: quién entró por cada una y qué hizo después (30 días).</div>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Período">
          {[14, 30, 60].map((n) => (
            <button key={n} type="button" onClick={() => setDias(n)} className={`px-3 py-1 rounded-full border font-body text-xs ${dias === n ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{n} días</button>
          ))}
        </div>
      </div>

      {/* Metas con proyección */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {r.metas.map((m) => {
          const pct = m.meta ? Math.min(100, Math.round((m.actual / m.meta) * 100)) : 0
          return (
            <div key={m.id} className="bg-panel border border-line rounded-xl p-3">
              <div className="font-body text-[11px] text-inksoft">{NOMBRE[m.id]}</div>
              <div className="font-display text-2xl font-bold text-ink tabular-nums">{fmt(m.actual)}<span className="font-body text-xs text-inksoft font-normal"> / {fmt(m.meta)}</span></div>
              <div className="h-1.5 rounded bg-panelalt mt-1 overflow-hidden"><div className="h-full bg-verde" style={{ width: `${pct}%` }} /></div>
              <div className="font-body text-[11px] text-inksoft mt-1.5">{m.ritmoDiario} por día · proyección {fmt(m.proyectado)} al {dm(r.finCampana)}</div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full font-body text-[10px] font-bold ${m.llega ? 'bg-verdesoft text-verdeoscuro' : 'bg-ochresoft text-ochre'}`}>{m.llega ? '✓ Llegás a la meta' : '⚠ Al ritmo actual no llegás'}</span>
            </div>
          )
        })}
      </div>

      {/* Visitas por día */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="font-body text-sm font-semibold text-ink">Visitas por día por tus links</div>
          <button type="button" onClick={() => setVerTabla((v) => !v)} className="font-body text-[11px] text-teal underline bg-transparent border-none">{verTabla ? 'Ver gráfico' : 'Ver como tabla'}</button>
        </div>
        {verTabla ? <TablaDias r={r} /> : <GraficoDias r={r} />}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Por red */}
        <div className="bg-panel border border-line rounded-xl p-4">
          <div className="font-body text-sm font-semibold text-ink mb-0.5">Por red</div>
          <div className="font-body text-[11px] text-inksoft mb-3">Visitas promedio por publicación publicada.</div>
          {r.porRed.length === 0 ? <div className="font-body text-xs text-inksoft">Todavía no hay publicaciones.</div> : (
            <div className="grid gap-2.5">
              {r.porRed.map((x) => (
                <div key={x.id} className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-2 font-body text-xs" title={`${x.label}: ${x.visitas} visitas, ${x.registros} cuentas, ${x.pedidos} compras en ${x.publicadas} publicaciones`}>
                  <span className="text-ink font-semibold">{x.icono} {x.label}</span>
                  <span className="h-3.5 rounded-r bg-panelalt overflow-hidden"><span className="block h-full bg-verde rounded-r" style={{ width: `${(x.visitasPorPublicacion / maxRed) * 100}%` }} /></span>
                  <span className="text-ink tabular-nums w-[140px] text-right">{x.visitasPorPublicacion} / pub · {x.pedidos} compras</span>
                </div>
              ))}
              <div className="font-body text-[10px] text-inksoft">{r.porRed.map((x) => `${x.label}: ${x.publicadas}/${x.publicaciones} publicadas`).join(' · ')}</div>
            </div>
          )}
        </div>

        {/* Por formato */}
        <div className="bg-panel border border-line rounded-xl p-4">
          <div className="font-body text-sm font-semibold text-ink mb-0.5">Video o imagen</div>
          <div className="font-body text-[11px] text-inksoft mb-3">Solo publicaciones ya publicadas.</div>
          {r.porFormato.length === 0 ? <div className="font-body text-xs text-inksoft">Cuando marques publicaciones como 🚀 Publicada, acá vas a ver qué formato rinde más.</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {r.porFormato.map((f) => (
                <div key={f.formato} className="bg-panelalt rounded-lg p-2.5">
                  <div className="font-body text-xs font-semibold text-ink">{f.formato === 'Video' ? '🎬' : f.formato === 'Imagen' ? '🖼️' : '⭕'} {f.formato}</div>
                  <div className="font-display text-xl font-bold text-ink tabular-nums">{f.visitasPorPublicacion}</div>
                  <div className="font-body text-[10px] text-inksoft">visitas por publicación · {f.publicadas} publicadas</div>
                  <div className="font-body text-[10px] text-inksoft">{f.conversion}% de las visitas crea su cuenta</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mejores publicaciones */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="font-body text-sm font-semibold text-ink mb-2">🏆 Las publicaciones que más trajeron</div>
        {r.mejores.length === 0 ? <div className="font-body text-xs text-inksoft">Todavía nadie entró por los links de tus publicaciones.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-xs tabular-nums">
              <thead><tr className="text-inksoft text-[10px] uppercase tracking-wider"><th className="text-left py-1.5 pr-2">Publicación</th><th className="text-right px-2">Visitas</th><th className="text-right px-2">Cuentas</th><th className="text-right px-2">Tiendas</th><th className="text-right px-2">Compras</th><th className="text-right pl-2">Bs</th></tr></thead>
              <tbody>
                {r.mejores.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{red(p.red)?.icono} {p.titulo} <span className="text-inksoft">· {dm(p.fecha)}</span></td>
                    <td className="text-right px-2">{fmt(p.visitas)}</td>
                    <td className="text-right px-2">{fmt(p.registros)}</td>
                    <td className="text-right px-2">{fmt(p.vendedores)}</td>
                    <td className="text-right px-2 font-semibold">{fmt(p.pedidos)}</td>
                    <td className="text-right pl-2">{fmt(p.ventasBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pendientes */}
      {(r.atrasadas.length > 0 || r.sinPieza.length > 0) && (
        <div className="bg-ochresoft border border-ochre rounded-xl p-4 grid gap-2 font-body text-xs text-ink">
          {r.atrasadas.length > 0 && (
            <div><b>⚠ Atrasadas ({r.atrasadas.length}):</b> {r.atrasadas.slice(0, 6).map((p) => `${dm(p.fecha)} ${red(p.red)?.icono || ''} ${p.titulo}`).join(' · ')}{r.atrasadas.length > 6 ? '…' : ''} <span className="text-inksoft">— publicalas o movelas de día en el plan.</span></div>
          )}
          {r.sinPieza.length > 0 && (
            <div><b>🎞️ Esta semana, sin video o imagen ({r.sinPieza.length}):</b> {r.sinPieza.map((p) => `${dm(p.fecha)} ${red(p.red)?.icono || ''} ${p.titulo}`).join(' · ')} <span className="text-inksoft">— subilas en 🎬 Contenido.</span></div>
          )}
        </div>
      )}

      {/* IA */}
      <div className="bg-panel border border-teal rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="font-body text-sm font-semibold text-ink">✨ Qué hacer esta semana</div>
          <button type="button" onClick={pedirIA} disabled={iaCargando} className="px-3 py-1.5 rounded-md bg-verde text-marca border-none font-body text-xs font-bold disabled:opacity-50">{iaCargando ? 'Analizando…' : ia ? '↻ Volver a analizar' : '✨ Pedir recomendaciones a la IA'}</button>
        </div>
        {!ia ? (
          <div className="font-body text-xs text-inksoft">La IA lee estos números (por red, por formato, las mejores publicaciones y las metas) y te dice qué priorizar.</div>
        ) : (
          <div className="grid gap-2">
            {ia.resumen && <div className="font-body text-sm text-ink">{ia.resumen}</div>}
            {!ia.conIA && <div className="font-body text-[11px] text-ochre">La IA no respondió: estas recomendaciones salen de reglas simples sobre tus números.</div>}
            <ol className="grid gap-1.5 list-decimal pl-5">
              {ia.recomendaciones.map((x, i) => (
                <li key={i} className="font-body text-xs text-ink"><b>{x.titulo}.</b> <span className="text-inksoft">{x.detalle}</span></li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// Área de visitas por día (una sola serie), con las publicaciones marcadas
// abajo y un tooltip por día.
function GraficoDias({ r }: { r: Reporte }) {
  const [sel, setSel] = useState<number | null>(null)
  const s = r.serie
  const W = 720, H = 200, L = 36, R = 8, T = 10, B = 34
  const maxV = Math.max(4, ...s.map((x) => x.visitas))
  const paso = Math.pow(10, Math.floor(Math.log10(maxV)))
  const tope = Math.ceil(maxV / paso) * paso
  const ticks = [0, tope / 2, tope]
  const x = (i: number) => L + (s.length <= 1 ? 0 : (i * (W - L - R)) / (s.length - 1))
  const y = (v: number) => T + (1 - v / tope) * (H - T - B)
  const linea = s.map((d, i) => `${x(i)},${y(d.visitas)}`).join(' ')
  const cada = Math.max(1, Math.ceil(s.length / 7))
  const d = sel != null ? s[sel] : null
  const lanzIdx = s.findIndex((p) => p.dia === r.lanzamiento)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Visitas por día del ${dm(s[0].dia)} al ${dm(s[s.length - 1].dia)}`} onMouseLeave={() => setSel(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#DEDACB" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#5B6676">{fmt(t)}</text>
          </g>
        ))}
        {lanzIdx >= 0 && (
          <g>
            <line x1={x(lanzIdx)} x2={x(lanzIdx)} y1={T} y2={H - B} stroke="#0E9A47" strokeWidth={1} strokeDasharray="4 3" />
            <text x={x(lanzIdx) + 4} y={T + 10} fontSize={10} fill="#0E9A47">🚀 lanzamiento</text>
          </g>
        )}
        <polygon points={`${x(0)},${y(0)} ${linea} ${x(s.length - 1)},${y(0)}`} fill="#16C35B" fillOpacity={0.15} />
        <polyline points={linea} fill="none" stroke="#0E9A47" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(s.length - 1)} cy={y(s[s.length - 1].visitas)} r={4} fill="#0E9A47" stroke="#FFFFFF" strokeWidth={2} />
        {s.map((p, i) => (r.publicadasPorDia[p.dia] ? <text key={`p${i}`} x={x(i)} y={H - B + 12} textAnchor="middle" fontSize={9} fill="#0E9A47">▲</text> : null))}
        {s.map((p, i) => (i % cada === 0 || i === s.length - 1 ? <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'} fontSize={10} fill="#5B6676">{dm(p.dia)}</text> : null))}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1={T} y2={H - B} stroke="#5B6676" strokeWidth={1} />}
        {sel != null && <circle cx={x(sel)} cy={y(s[sel].visitas)} r={4.5} fill="#0E9A47" stroke="#FFFFFF" strokeWidth={2} />}
        {/* Zonas para el hover, más anchas que la línea. */}
        {s.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - (W - L - R) / Math.max(1, s.length - 1) / 2} y={T} width={(W - L - R) / Math.max(1, s.length - 1)} height={H - T - B + 14} fill="transparent" onMouseEnter={() => setSel(i)} onTouchStart={() => setSel(i)} />
        ))}
      </svg>
      {d && (
        <div className={`absolute top-1 ${sel != null && sel > s.length / 2 ? 'left-10' : 'right-1'} bg-panel border border-line rounded-lg shadow-lg px-3 py-2 font-body text-[11px] text-ink pointer-events-none`}>
          <div className="font-semibold mb-0.5">{dm(d.dia)}</div>
          <div>{fmt(d.visitas)} visitas · {fmt(d.registros)} cuentas</div>
          <div>{fmt(d.pedidos)} compras · Bs {fmt(d.ventasBs)}</div>
          {r.publicadasPorDia[d.dia] ? <div className="text-verdeoscuro">▲ {r.publicadasPorDia[d.dia]} publicación(es) ese día</div> : null}
        </div>
      )}
      <div className="font-body text-[10px] text-inksoft mt-1">▲ días en que publicaste · pasá el dedo o el mouse por el gráfico para ver cada día</div>
    </div>
  )
}

function TablaDias({ r }: { r: Reporte }) {
  return (
    <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
      <table className="w-full font-body text-xs tabular-nums">
        <thead><tr className="text-inksoft text-[10px] uppercase tracking-wider"><th className="text-left py-1.5">Día</th><th className="text-right px-2">Visitas</th><th className="text-right px-2">Cuentas</th><th className="text-right px-2">Tiendas</th><th className="text-right px-2">Compras</th><th className="text-right pl-2">Publicadas</th></tr></thead>
        <tbody>
          {[...r.serie].reverse().map((d) => (
            <tr key={d.dia} className="border-t border-line"><td className="py-1">{dm(d.dia)}</td><td className="text-right px-2">{fmt(d.visitas)}</td><td className="text-right px-2">{fmt(d.registros)}</td><td className="text-right px-2">{fmt(d.vendedores)}</td><td className="text-right px-2">{fmt(d.pedidos)}</td><td className="text-right pl-2">{r.publicadasPorDia[d.dia] || ''}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
