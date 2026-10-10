'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LogoClasiClick } from '@/components/LogoClasiClick'
import { ESTADOS_PUBLICACION, FORMATOS, REDES_LANZAMIENTO } from '@/lib/lanzamiento'

// Calendario de publicaciones compartido por link (sin entrar al admin):
// qué publicar cada día, en qué red, la idea, el texto listo con su link
// y, si el link lo permite, marcar lo publicado.

type Pub = { id: string; fecha: string; red: string; formato: string; titulo: string; idea: string; texto: string; link: string; estado: string }
type Datos = { permiso: 'ver' | 'marcar'; lanzamiento: { fecha: string; ciudad: string; fases: { id: string; label: string; desde: string; hasta: string; que: string }[] }; publicaciones: Pub[] }

const hoyBolivia = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
const red = (id: string) => REDES_LANZAMIENTO.find((r) => r.id === id)
const fechaLarga = (iso: string) => {
  const t = new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Copiar({ texto, label }: { texto: string; label: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {})} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-[11px] font-semibold text-ink shrink-0">
      {ok ? '✓ Copiado' : label}
    </button>
  )
}

export default function CalendarioCompartido() {
  const { token } = useParams<{ token: string }>()
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [todo, setTodo] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/calendario/${encodeURIComponent(token)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j) })
      .catch((e) => setError(e?.message || 'No se pudo abrir el calendario.'))
  }, [token])

  async function marcar(p: Pub, estado: string) {
    setD((prev) => prev && { ...prev, publicaciones: prev.publicaciones.map((x) => (x.id === p.id ? { ...x, estado } : x)) })
    await fetch(`/api/calendario/${encodeURIComponent(token)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, estado }) }).catch(() => null)
  }

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 font-body text-sm text-ink text-center">{error}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center font-body text-sm text-inksoft">Cargando el calendario…</div>

  const hoy = hoyBolivia()
  const lista = d.publicaciones.filter((p) => todo || p.fecha >= hoy)
  const porDia = lista.reduce<Record<string, Pub[]>>((m, p) => ((m[p.fecha] = m[p.fecha] || []).push(p), m), {})
  const faseHoy = d.lanzamiento.fases.find((f) => hoy >= f.desde && hoy <= f.hasta)
  const ics = typeof window !== 'undefined' ? `${window.location.origin}/api/calendario/${token}/ics` : ''
  const webcal = ics.replace(/^https?:/, 'webcal:')

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-marca text-white px-4 py-4">
        <div className="max-w-[760px] mx-auto">
          <LogoClasiClick size={30} />
          <div className="font-display text-lg font-bold mt-3">Calendario de publicaciones</div>
          <div className="font-body text-xs text-white/70">Lanzamiento en {d.lanzamiento.ciudad}: {fechaLarga(d.lanzamiento.fecha)}{faseHoy ? ` · hoy: fase ${faseHoy.label}` : ''}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-md bg-verde text-marca font-body text-xs font-bold no-underline">📅 Agregar a Google Calendar</a>
            <a href={webcal} className="px-3 py-1.5 rounded-md border border-white/25 text-white font-body text-xs font-semibold no-underline">📱 Calendario del celular</a>
          </div>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-4 pt-4 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-body text-xs text-inksoft">{d.permiso === 'marcar' ? 'Cuando publiques algo, marcalo como 🚀 Publicada.' : 'Solo para ver: copiá el texto y el link de cada publicación.'}</div>
          <button type="button" onClick={() => setTodo((v) => !v)} className="shrink-0 px-3 py-1 rounded-full border border-line bg-panel font-body text-xs">{todo ? 'Solo desde hoy' : 'Ver también lo anterior'}</button>
        </div>
        {Object.keys(porDia).length === 0 && <div className="font-body text-sm text-inksoft text-center py-10">No hay publicaciones programadas desde hoy.</div>}
        {Object.entries(porDia).map(([dia, pubs]) => (
          <section key={dia}>
            <div className={`font-body text-xs font-bold mb-1.5 ${dia === hoy ? 'text-verdeoscuro' : 'text-inksoft'}`}>{dia === hoy ? '📌 HOY · ' : ''}{fechaLarga(dia)}{dia === d.lanzamiento.fecha ? ' · 🚀 Lanzamiento' : ''}</div>
            <div className="grid gap-2">
              {pubs.map((p) => {
                const r = red(p.red)
                const abierto = abierta === p.id
                return (
                  <div key={p.id} className="bg-panel border border-line rounded-xl p-3" style={{ borderLeft: `4px solid ${r?.color || '#999'}` }}>
                    <button type="button" onClick={() => setAbierta(abierto ? null : p.id)} className="w-full text-left bg-transparent border-none p-0">
                      <div className="font-body text-[11px] text-inksoft"><b style={{ color: r?.color }}>{r?.icono} {r?.label}</b> · {FORMATOS.find((f) => f.id === p.formato)?.label || p.formato} · {ESTADOS_PUBLICACION.find((e) => e.id === p.estado)?.label}</div>
                      <div className="font-body text-sm font-semibold text-ink">{p.titulo} <span className="text-inksoft font-normal text-xs">{abierto ? '▲' : '▼'}</span></div>
                    </button>
                    {abierto && (
                      <div className="grid gap-2 mt-2">
                        {p.idea && <div className="bg-panelalt rounded-lg p-2.5 font-body text-xs text-ink"><b>🎬 Qué grabar / diseñar:</b> {p.idea}</div>}
                        <div className="bg-panelalt rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1"><span className="font-body text-[11px] font-semibold text-inksoft">📝 Texto para pegar</span><Copiar texto={p.texto} label="Copiar texto" /></div>
                          <div className="font-body text-xs text-ink whitespace-pre-wrap break-words">{p.texto}</div>
                        </div>
                        {p.link && <div className="flex items-center gap-2 bg-panelalt rounded-lg p-2.5"><span className="font-body text-[11px] text-ink break-all flex-1">🔗 {p.link}</span><Copiar texto={p.link} label="Copiar link" /></div>}
                        {d.permiso === 'marcar' && (
                          <div className="flex flex-wrap gap-1.5">
                            {ESTADOS_PUBLICACION.map((e) => (
                              <button key={e.id} type="button" onClick={() => marcar(p, e.id)} className={`px-2.5 py-1 rounded-full border font-body text-xs ${p.estado === e.id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{e.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
