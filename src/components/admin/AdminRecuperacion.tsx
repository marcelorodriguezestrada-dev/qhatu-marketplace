'use client'

import { useEffect, useState } from 'react'
import type { ConfigRecuperacion } from '@/lib/recuperacion'

// Admin → Analítica → "Estabas mirando esto": prender/apagar los avisos
// de recuperación de compras, elegir la hora de envío (con la hora pico
// sugerida por la analítica) y ver enviados / abiertos / compras.

type Metrica = { dia: string; enviados?: number; abiertos?: number; compras?: number }

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

export default function AdminRecuperacion({ password }: { password: string }) {
  const [config, setConfig] = useState<ConfigRecuperacion | null>(null)
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [estado, setEstado] = useState<any>(null)
  const [horaPico, setHoraPico] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  function cargar() {
    fetch('/api/admin/recuperacion', { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setMensaje(d.error); return }
        setConfig(d.config)
        setMetricas(d.metricas || [])
        setEstado(d.estado)
        setHoraPico(d.horaPico)
      })
      .catch(() => setMensaje('No se pudo cargar.'))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardar(c: ConfigRecuperacion = config!) {
    setGuardando(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/recuperacion', { method: 'POST', headers, body: JSON.stringify({ accion: 'guardar', config: c }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setConfig(d.config)
      setMensaje('Guardado ✓')
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function enviarAhora() {
    if (!confirm('¿Mandar ahora los avisos pendientes? (respeta la espera y el tope por persona)')) return
    setEnviando(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/recuperacion', { method: 'POST', headers, body: JSON.stringify({ accion: 'enviar' }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      const r = d.resultado
      setMensaje(`Listo: ${r.enviados} aviso${r.enviados === 1 ? '' : 's'} enviado${r.enviados === 1 ? '' : 's'}${r.yaCompraron ? ` · ${r.yaCompraron} ya habían comprado` : ''}${r.porTope ? ` · ${r.porTope} con tope semanal` : ''}${r.sinStock ? ` · ${r.sinStock} sin stock` : ''}.`)
      cargar()
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo enviar.')
    } finally {
      setEnviando(false)
    }
  }

  if (!config) return <div className="font-body text-sm text-inksoft mb-5">{mensaje || 'Cargando...'}</div>

  const tot = metricas.reduce((a, m) => ({ e: a.e + (m.enviados || 0), ab: a.ab + (m.abiertos || 0), c: a.c + (m.compras || 0) }), { e: 0, ab: 0, c: 0 })
  const ultimo = estado?.ultimoResultado
  const set = (c: Partial<ConfigRecuperacion>) => setConfig({ ...config, ...c })

  return (
    <div className="bg-panel border border-line rounded-xl p-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-body text-sm font-semibold text-ink">👀 &quot;Estabas mirando esto&quot; — recuperación de compras</div>
        <span className={`border rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold ${config.activo ? 'bg-tealsoft text-teal border-teal' : 'bg-panelalt text-inksoft border-line'}`}>
          {config.activo ? '● Activo' : 'Apagado'}
        </span>
      </div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        A quien agregó un producto al carrito (o lo miró 2 veces) y no lo compró, le llega un aviso a la campanita con link directo al producto. Solo usuarios con sesión iniciada.
      </div>

      <label className="flex items-center gap-2 font-body text-sm text-ink cursor-pointer mb-3">
        <input type="checkbox" checked={config.activo} onChange={(e) => set({ activo: e.target.checked })} className="accent-teal w-4 h-4" />
        <span className="font-semibold">Activar avisos automáticos</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 font-body text-xs text-ink">
        <label>
          <span className="block font-semibold text-[11px] text-inksoft mb-1">Hora de envío (Bolivia)</span>
          <div className="flex items-center gap-2">
            <select value={config.horaEnvio} onChange={(e) => set({ horaEnvio: Number(e.target.value) })} className="px-2 py-1.5 rounded-lg border border-line bg-panel">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            {horaPico != null && horaPico !== config.horaEnvio && (
              <button type="button" onClick={() => set({ horaEnvio: horaPico })} className="text-teal underline">
                Usar hora pico ({String(horaPico).padStart(2, '0')}:00)
              </button>
            )}
            {horaPico != null && horaPico === config.horaEnvio && <span className="text-teal">✓ Es tu hora pico</span>}
          </div>
          {horaPico == null && <span className="block text-[10px] text-inksoft mt-1">Prendé el registro de eventos unos días para ver tu hora pico.</span>}
        </label>
        <label>
          <span className="block font-semibold text-[11px] text-inksoft mb-1">Esperar antes de avisar</span>
          <select value={config.esperaHoras} onChange={(e) => set({ esperaHoras: Number(e.target.value) })} className="px-2 py-1.5 rounded-lg border border-line bg-panel">
            {[6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>{h} horas</option>
            ))}
          </select>
        </label>
        <label>
          <span className="block font-semibold text-[11px] text-inksoft mb-1">Máximo por persona</span>
          <select value={config.maxPorSemana} onChange={(e) => set({ maxPorSemana: Number(e.target.value) })} className="px-2 py-1.5 rounded-lg border border-line bg-panel">
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n} aviso{n === 1 ? '' : 's'} por semana</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer pt-5">
          <input type="checkbox" checked={config.incluirVistos} onChange={(e) => set({ incluirVistos: e.target.checked })} className="accent-teal" />
          También a quien solo lo miró 2 veces (no solo carrito)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button type="button" onClick={() => guardar()} disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={enviarAhora} disabled={enviando || !config.activo} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink disabled:opacity-50" title={config.activo ? '' : 'Activalo primero'}>
          {enviando ? 'Enviando...' : 'Enviar pendientes ahora'}
        </button>
        {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-panelalt rounded-lg p-2.5 text-center">
          <div className="font-display text-xl font-bold text-ink">{tot.e}</div>
          <div className="font-body text-[11px] text-inksoft">Enviados</div>
        </div>
        <div className="bg-panelalt rounded-lg p-2.5 text-center">
          <div className="font-display text-xl font-bold text-ink">{tot.ab}</div>
          <div className="font-body text-[11px] text-inksoft">Abiertos · {pct(tot.ab, tot.e)}</div>
        </div>
        <div className="bg-panelalt rounded-lg p-2.5 text-center">
          <div className="font-display text-xl font-bold text-teal">{tot.c}</div>
          <div className="font-body text-[11px] text-inksoft">Compras · {pct(tot.c, tot.e)}</div>
        </div>
      </div>
      <div className="font-body text-[11px] text-inksoft">
        Últimos 14 días. Compra = compró el producto recordado dentro de los 7 días del aviso.
        {ultimo?.fecha && ` Último envío: ${new Date(ultimo.fecha).toLocaleString('es-BO')} — ${ultimo.enviados} aviso${ultimo.enviados === 1 ? '' : 's'}${ultimo.manual ? ' (manual)' : ''}.`}
      </div>
    </div>
  )
}
