'use client'

import { useEffect, useMemo, useState } from 'react'
import { EVENTOS, CUOTA_GRATIS, type ConfigTracking, type ModoTracking, type NombreEvento } from '@/lib/trackingConfig'

// Admin → Analítica: prender/apagar el registro de eventos (siempre, en
// un horario o solo con campaña activa), tope diario, cuánto consume del
// plan gratis de Firebase, horarios pico y embudos.

type Resumen = {
  id: string
  total?: number
  lotes?: number
  escrituras?: number
  lecturas?: number
  porEvento?: Record<string, number>
  porHora?: Record<string, number>
  porCampana?: Record<string, Record<string, number>>
  porCategoria?: Record<string, Record<string, number>>
}

const MODOS: { id: ModoTracking; label: string; ayuda: string }[] = [
  { id: 'apagado', label: 'Apagado', ayuda: 'No se registra nada. No consume.' },
  { id: 'siempre', label: 'Siempre', ayuda: 'Registra todo el día (hasta el tope diario).' },
  { id: 'horario', label: 'En un horario', ayuda: 'Solo entre las horas que elijas (hora de Bolivia).' },
  { id: 'campana', label: 'Solo con campaña', ayuda: 'Solo mientras haya un cupón con banner vigente.' },
]

const MOTIVOS: Record<string, { texto: string; clase: string }> = {
  activo: { texto: '● Registrando ahora', clase: 'bg-tealsoft text-teal border-teal' },
  apagado: { texto: 'Apagado', clase: 'bg-panelalt text-inksoft border-line' },
  fuera_de_horario: { texto: 'En pausa: fuera del horario', clase: 'bg-ochresoft text-ochre border-ochre' },
  sin_campana: { texto: 'En pausa: no hay campaña activa', clase: 'bg-ochresoft text-ochre border-ochre' },
  limite: { texto: 'En pausa: se llegó al tope de hoy', clase: 'bg-maroonsoft text-maroon border-maroon' },
}

const EMBUDO_GENERAL: NombreEvento[] = ['ver_producto', 'agregar_carrito', 'iniciar_checkout', 'subir_comprobante', 'compra_confirmada']
const EMBUDO_CAMPANA: NombreEvento[] = ['click_banner', 'aplicar_cupon', 'subir_comprobante', 'compra_confirmada']

const labelEvento = (id: string) => EVENTOS.find((e) => e.id === id)?.label || id
const num = (n: number) => n.toLocaleString('es-BO')

function Barra({ valor, maximo, alerta }: { valor: number; maximo: number; alerta?: boolean }) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0
  return (
    <div className="h-2.5 rounded-full bg-panelalt border border-line overflow-hidden">
      <div className={`h-full rounded-full ${alerta ? 'bg-maroon' : 'bg-teal'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function AdminAnalitica({ password }: { password: string }) {
  const [config, setConfig] = useState<ConfigTracking | null>(null)
  const [estado, setEstado] = useState<{ activo: boolean; motivo: string } | null>(null)
  const [resumenes, setResumenes] = useState<Resumen[]>([])
  const [proyecto, setProyecto] = useState('')
  const [dias, setDias] = useState(7)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [campana, setCampana] = useState('')
  const [horaHover, setHoraHover] = useState<number | null>(null)

  function cargar(d = dias) {
    setCargando(true)
    fetch(`/api/admin/analitica?dias=${d}`, { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setMensaje(data.error); return }
        setConfig(data.config)
        setEstado(data.estado)
        setResumenes(data.resumenes || [])
        setProyecto(data.proyectoFirebase || '')
      })
      .catch(() => setMensaje('No se pudo cargar la analítica.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardar() {
    if (!config) return
    setGuardando(true)
    setMensaje('')
    try {
      const res = await fetch('/api/admin/analitica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMensaje('Guardado ✓ — se aplica en el sitio en 1 a 10 minutos.')
      cargar()
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const hoy = resumenes[0]?.id === new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10) ? resumenes[0] : null
  const totales = useMemo(() => {
    const porEvento: Record<string, number> = {}
    const porHora: number[] = Array(24).fill(0)
    const porCampana: Record<string, Record<string, number>> = {}
    let eventos = 0, escrituras = 0
    for (const r of resumenes) {
      eventos += r.total || 0
      escrituras += r.escrituras || 0
      for (const [k, v] of Object.entries(r.porEvento || {})) porEvento[k] = (porEvento[k] || 0) + v
      for (const [h, v] of Object.entries(r.porHora || {})) porHora[Number(h)] += v
      for (const [c, ev] of Object.entries(r.porCampana || {})) {
        porCampana[c] ||= {}
        for (const [k, v] of Object.entries(ev)) porCampana[c][k] = (porCampana[c][k] || 0) + v
      }
    }
    return { porEvento, porHora, porCampana, eventos, escrituras }
  }, [resumenes])

  if (cargando && !config) return <div className="font-body text-sm text-inksoft">Cargando...</div>
  if (!config) return <div className="font-body text-sm text-maroon">{mensaje || 'No se pudo cargar.'}</div>

  const est = MOTIVOS[estado?.motivo || 'apagado'] || MOTIVOS.apagado
  const eventosHoy = hoy?.total || 0
  const escriturasHoy = hoy?.escrituras || 0
  const pctCuota = (escriturasHoy / CUOTA_GRATIS.escrituras) * 100
  const maxHora = Math.max(1, ...totales.porHora)
  const horasPico = totales.porHora
    .map((v, h) => ({ h, v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)

  const pasos = campana ? EMBUDO_CAMPANA : EMBUDO_GENERAL
  const fuente = campana ? totales.porCampana[campana] || {} : totales.porEvento
  const valoresEmbudo = pasos.map((p) => fuente[p] || 0)
  const maxEmbudo = Math.max(1, ...valoresEmbudo)
  const campanas = Object.keys(totales.porCampana).sort()

  const tarjeta = 'bg-panel border border-line rounded-xl p-4 mb-5'
  const titulo = 'font-body text-sm font-semibold text-ink mb-1'
  const ayuda = 'font-body text-[11px] text-inksoft mb-3'

  return (
    <div>
      {/* --- Control --- */}
      <div className={tarjeta}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className={titulo}>Registro de eventos</div>
          <span className={`border rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold ${est.clase}`}>{est.texto}</span>
        </div>
        <div className={ayuda}>Elegí cuándo se registra lo que hace la gente en el sitio. Apagado no consume nada del plan gratis.</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setConfig({ ...config, modo: m.id })}
              className={`px-3 py-2.5 rounded-lg border font-body text-xs font-semibold text-left ${config.modo === m.id ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-ink'}`}
            >
              {m.label}
              <span className={`block font-normal text-[10px] mt-0.5 ${config.modo === m.id ? 'text-white/80' : 'text-inksoft'}`}>{m.ayuda}</span>
            </button>
          ))}
        </div>

        {config.modo === 'horario' && (
          <div className="flex flex-wrap items-center gap-2 mb-3 font-body text-xs text-ink">
            Registrar de
            <input type="time" value={config.horaDesde} onChange={(e) => setConfig({ ...config, horaDesde: e.target.value })} className="px-2 py-1.5 rounded-lg border border-line" />
            a
            <input type="time" value={config.horaHasta} onChange={(e) => setConfig({ ...config, horaHasta: e.target.value })} className="px-2 py-1.5 rounded-lg border border-line" />
            <span className="text-inksoft">(hora de Bolivia)</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="font-body text-xs text-ink">
            <span className="block font-semibold text-[11px] text-inksoft mb-1">Tope de eventos por día</span>
            <input
              type="number"
              min={100}
              step={100}
              value={config.limiteDiario}
              onChange={(e) => setConfig({ ...config, limiteDiario: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm"
            />
            <span className="block text-[10px] text-inksoft mt-1">Al llegar se pausa solo hasta mañana.</span>
          </label>
          <label className="flex items-start gap-2 font-body text-xs text-ink cursor-pointer pt-5">
            <input type="checkbox" checked={config.guardarDetalle} onChange={(e) => setConfig({ ...config, guardarDetalle: e.target.checked })} className="accent-teal mt-0.5" />
            <span>
              <span className="font-semibold">Guardar el detalle de cada evento</span>
              <span className="block text-[10px] text-inksoft">Sirve para análisis por usuario más adelante. Duplica las escrituras — dejalo apagado mientras no lo necesites.</span>
            </span>
          </label>
        </div>

        <div className="font-body text-[11px] font-semibold text-inksoft mb-1.5">Qué eventos registrar</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3">
          {EVENTOS.map((e) => (
            <label key={e.id} className="flex items-center gap-2 font-body text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={config.eventos.includes(e.id)}
                onChange={(ev) =>
                  setConfig({ ...config, eventos: ev.target.checked ? [...config.eventos, e.id] : config.eventos.filter((x) => x !== e.id) })
                }
                className="accent-teal"
              />
              {e.label}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
        </div>
      </div>

      {/* --- Consumo --- */}
      <div className={tarjeta}>
        <div className={titulo}>Consumo de hoy</div>
        <div className={ayuda}>Lo que gasta el registro de eventos del plan gratis de Firebase (se reinicia cada día).</div>

        <div className="mb-3">
          <div className="flex justify-between font-body text-xs text-ink mb-1">
            <span>Eventos registrados</span>
            <span className="font-semibold">{num(eventosHoy)} de {num(config.limiteDiario)}</span>
          </div>
          <Barra valor={eventosHoy} maximo={config.limiteDiario} alerta={eventosHoy >= config.limiteDiario} />
        </div>

        <div className="mb-2">
          <div className="flex justify-between font-body text-xs text-ink mb-1">
            <span>Escrituras de Firestore (del registro)</span>
            <span className="font-semibold">{num(escriturasHoy)} de {num(CUOTA_GRATIS.escrituras)} gratis · {pctCuota.toFixed(1)}%</span>
          </div>
          <Barra valor={escriturasHoy} maximo={CUOTA_GRATIS.escrituras} alerta={pctCuota >= 50} />
        </div>
        <div className="font-body text-[11px] text-inksoft mb-2">
          Cada tanda de hasta 50 eventos cuesta {config.guardarDetalle ? '2 escrituras' : '1 escritura'} y 1 lectura. Hoy: {num(hoy?.lotes || 0)} tandas, ~{num(hoy?.lecturas || 0)} lecturas de {num(CUOTA_GRATIS.lecturas)} gratis.
          {pctCuota >= 50 && <span className="text-maroon font-semibold"> ⚠ El registro ya usa más de la mitad de las escrituras gratis de hoy — bajá el tope o usá horario.</span>}
        </div>
        <div className="font-body text-[11px] text-inksoft">
          Esto cuenta solo el registro de eventos. El consumo total del sitio (pedidos, productos, etc.) lo ves en{' '}
          <a
            href={proyecto ? `https://console.firebase.google.com/project/${proyecto}/firestore/usage` : 'https://console.firebase.google.com/'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal underline"
          >
            Firebase → Firestore → Uso
          </a>
          .
        </div>
      </div>

      {/* --- Período --- */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-body text-xs text-inksoft">Período:</span>
        {[1, 7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDias(d); cargar(d) }}
            className={`px-3 py-1 rounded-full border font-body text-xs font-semibold ${dias === d ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'}`}
          >
            {d === 1 ? 'Hoy' : `${d} días`}
          </button>
        ))}
        <span className="font-body text-xs text-inksoft ml-auto">{num(totales.eventos)} eventos</span>
      </div>

      {totales.eventos === 0 ? (
        <div className={`${tarjeta} text-center font-body text-sm text-inksoft`}>
          Todavía no hay eventos en este período.{config.modo === 'apagado' && ' Prendé el registro arriba para empezar a medir.'}
        </div>
      ) : (
        <>
          {/* --- Embudo --- */}
          <div className={tarjeta}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className={titulo}>Embudo</div>
              <select value={campana} onChange={(e) => setCampana(e.target.value)} className="px-2 py-1.5 rounded-lg border border-line font-body text-xs">
                <option value="">Todas las compras</option>
                {campanas.map((c) => (
                  <option key={c} value={c}>Campaña: cupón {c}</option>
                ))}
              </select>
            </div>
            <div className={ayuda}>
              {campana ? `Pasos de quienes usaron el cupón ${campana}.` : 'Cuántas veces se llegó a cada paso y qué % sigue al siguiente.'} Son conteos de eventos, no personas únicas.
            </div>
            <div className="flex flex-col gap-2">
              {pasos.map((p, i) => {
                const v = valoresEmbudo[i]
                const previo = i > 0 ? valoresEmbudo[i - 1] : 0
                const pctPrevio = i > 0 && previo > 0 ? Math.round((v / previo) * 100) : null
                const pctInicio = valoresEmbudo[0] > 0 ? Math.round((v / valoresEmbudo[0]) * 100) : null
                return (
                  <div key={p} title={`${labelEvento(p)}: ${num(v)}${pctInicio != null ? ` · ${pctInicio}% del inicio` : ''}`}>
                    <div className="flex justify-between font-body text-xs mb-0.5">
                      <span className="text-ink">{i + 1}. {labelEvento(p)}</span>
                      <span className="text-ink font-semibold">
                        {num(v)}
                        {pctPrevio != null && <span className="text-inksoft font-normal"> · {pctPrevio}% del paso anterior</span>}
                      </span>
                    </div>
                    <div className="h-5 rounded-md bg-panelalt">
                      <div className="h-full rounded-md bg-teal" style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / maxEmbudo) * 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* --- Horarios pico --- */}
          <div className={tarjeta}>
            <div className={titulo}>Horarios pico</div>
            <div className={ayuda}>
              Eventos por hora del día (hora de Bolivia), sumando el período.
              {horasPico.length > 0 && ` Más actividad: ${horasPico.map((x) => `${x.h}:00`).join(', ')} — buen momento para mandar avisos.`}
            </div>
            <div className="font-body text-[11px] text-ink h-4 mb-1">
              {horaHover != null ? `${horaHover}:00 – ${horaHover}:59 · ${num(totales.porHora[horaHover])} eventos` : ' '}
            </div>
            <div className="flex items-end gap-[2px] h-32" onMouseLeave={() => setHoraHover(null)}>
              {totales.porHora.map((v, h) => (
                <div
                  key={h}
                  className="flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHoraHover(h)}
                  onClick={() => setHoraHover(h)}
                  title={`${h}:00 · ${num(v)} eventos`}
                >
                  <div
                    className={`w-full rounded-t ${horaHover === h ? 'bg-ink' : 'bg-teal'}`}
                    style={{ height: `${v > 0 ? Math.max(3, (v / maxHora) * 100) : 0}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between font-body text-[10px] text-inksoft mt-1 border-t border-line pt-1">
              <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
            </div>
          </div>

          {/* --- Tabla por evento --- */}
          <div className={tarjeta}>
            <div className={titulo}>Eventos por tipo</div>
            <table className="w-full font-body text-xs mt-2">
              <tbody>
                {EVENTOS.filter((e) => totales.porEvento[e.id]).sort((a, b) => (totales.porEvento[b.id] || 0) - (totales.porEvento[a.id] || 0)).map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-b-0">
                    <td className="py-1.5 text-ink">{e.label}</td>
                    <td className="py-1.5 text-right font-semibold text-ink">{num(totales.porEvento[e.id] || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- Consumo por día --- */}
          <div className={tarjeta}>
            <div className={titulo}>Consumo por día</div>
            <table className="w-full font-body text-xs mt-2">
              <thead>
                <tr className="text-inksoft text-left">
                  <th className="py-1 font-semibold">Día</th>
                  <th className="py-1 font-semibold text-right">Eventos</th>
                  <th className="py-1 font-semibold text-right">Escrituras</th>
                  <th className="py-1 font-semibold text-right">% del gratis</th>
                </tr>
              </thead>
              <tbody>
                {resumenes.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1.5 text-ink">{r.id.split('-').reverse().join('/')}</td>
                    <td className="py-1.5 text-right text-ink">{num(r.total || 0)}</td>
                    <td className="py-1.5 text-right text-ink">{num(r.escrituras || 0)}</td>
                    <td className="py-1.5 text-right text-ink">{(((r.escrituras || 0) / CUOTA_GRATIS.escrituras) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
