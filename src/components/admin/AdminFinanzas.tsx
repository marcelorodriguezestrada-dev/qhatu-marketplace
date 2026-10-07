'use client'

import { useEffect, useMemo, useState } from 'react'
import { mesBolivia, diaBolivia } from '@/lib/fechaBolivia'
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  METODOS,
  bs,
  mesDe,
  nombreMes,
  porCategoria,
  rangoMeses,
  resumenPorMes,
  sumarMeses,
  variacion,
  type Movimiento,
  type TipoMovimiento,
} from '@/lib/finanzas'

// Admin → 💰 Finanzas: cargar ingresos y gastos de Clasi Click y ver si
// el negocio crece. Arriba se carga un movimiento en un toque; abajo el
// reporte del período (ingresos, gastos, resultado y variación contra el
// período anterior), el gráfico mes a mes, en qué se va la plata, las
// ventas que pasan por la plataforma y la lista de movimientos (con
// exportar a Excel e imprimir).

const COLOR_INGRESO = '#2a78d6'
const COLOR_GASTO = '#eb6834'

type Periodo = '1' | '3' | '6' | '12' | 'anio'
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: '1', label: 'Este mes' },
  { id: '3', label: '3 meses' },
  { id: '6', label: '6 meses' },
  { id: '12', label: '12 meses' },
  { id: 'anio', label: 'Este año' },
]

function Variacion({ v, inverso = false }: { v: number | null; inverso?: boolean }) {
  if (v == null) return <span className="text-inksoft">sin datos del período anterior</span>
  const bueno = inverso ? v <= 0 : v >= 0
  return <span className={bueno ? 'text-teal' : 'text-maroon'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(0)}% vs período anterior</span>
}

// Barras agrupadas ingresos vs gastos por mes (un solo eje, en Bs).
function GraficoMeses({ datos }: { datos: { mes: string; ingresos: number; gastos: number; resultado: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 240
  const pad = { l: 56, r: 12, t: 12, b: 28 }
  const max = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]))
  const paso = Math.pow(10, Math.floor(Math.log10(max)))
  const tope = Math.ceil(max / paso) * paso
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * tope)
  const ancho = (W - pad.l - pad.r) / datos.length
  const barra = Math.max(4, Math.min(28, (ancho - 10) / 2))
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / tope)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ingresos y gastos por mes">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e7e2d6" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#6b6a64">{t >= 1000 ? `${(t / 1000).toLocaleString('es-BO')}k` : t}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x0 = pad.l + i * ancho + (ancho - barra * 2 - 2) / 2
          const rect = (x: number, v: number, color: string) => {
            const alto = Math.max(0, y(0) - y(v))
            if (!alto) return null
            const r = Math.min(4, alto, barra / 2)
            // Esquinas redondeadas solo arriba (la base queda pegada al eje).
            return <path d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barra - r} Q${x + barra},${y(v)} ${x + barra},${y(v) + r} V${y(0)} Z`} fill={color} />
          }
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * ancho} y={pad.t} width={ancho} height={H - pad.t - pad.b} fill={hover === i ? '#f3efe6' : 'transparent'} />
              {rect(x0, d.ingresos, COLOR_INGRESO)}
              {rect(x0 + barra + 2, d.gastos, COLOR_GASTO)}
              <text x={pad.l + i * ancho + ancho / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#6b6a64">{nombreMes(d.mes)}</text>
            </g>
          )
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#b9b4a8" strokeWidth={1} />
      </svg>
      {hover != null && datos[hover] && (
        <div className="absolute top-2 pointer-events-none bg-white border border-line rounded-lg shadow-md px-3 py-2 font-body text-xs" style={{ left: `${Math.min(70, ((hover + 0.5) / datos.length) * 100)}%` }}>
          <div className="font-semibold text-ink mb-1">{nombreMes(datos[hover].mes, true)}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_INGRESO }} />Ingresos <b className="ml-auto pl-3">{bs(datos[hover].ingresos)}</b></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_GASTO }} />Gastos <b className="ml-auto pl-3">{bs(datos[hover].gastos)}</b></div>
          <div className={`border-t border-line mt-1 pt-1 font-semibold ${datos[hover].resultado >= 0 ? 'text-teal' : 'text-maroon'}`}>Resultado {bs(datos[hover].resultado)}</div>
        </div>
      )}
      <div className="flex gap-4 font-body text-xs text-inksoft mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: COLOR_INGRESO }} />Ingresos</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: COLOR_GASTO }} />Gastos</span>
      </div>
    </div>
  )
}

function BarrasCategoria({ titulo, filas, color }: { titulo: string; filas: { categoria: string; monto: number }[]; color: string }) {
  const total = filas.reduce((s, f) => s + f.monto, 0)
  const max = Math.max(1, ...filas.map((f) => f.monto))
  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="font-body text-sm font-semibold text-ink mb-2">{titulo}</div>
      {!filas.length ? <div className="font-body text-xs text-inksoft">Nada cargado en este período.</div> : (
        <div className="grid gap-2">
          {filas.map((f) => (
            <div key={f.categoria} className="font-body text-xs">
              <div className="flex justify-between gap-2 text-ink"><span className="truncate">{f.categoria}</span><span className="shrink-0"><b>{bs(f.monto)}</b> <span className="text-inksoft">· {total ? Math.round((f.monto / total) * 100) : 0}%</span></span></div>
              <div className="h-2 rounded-full bg-panelalt mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(f.monto / max) * 100}%`, background: color }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminFinanzas({ password }: { password: string }) {
  const mesActual = mesBolivia()
  const [periodo, setPeriodo] = useState<Periodo>('6')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [ventas, setVentas] = useState<Record<string, { pedidos: number; vendido: number; envios: number }>>({})
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoMovimiento>('')
  const [editando, setEditando] = useState<string | null>(null)
  const vacio = { tipo: 'gasto' as TipoMovimiento, monto: '', categoria: '', descripcion: '', fecha: diaBolivia(), metodo: 'Efectivo', recurrente: false }
  const [form, setForm] = useState(vacio)
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  // Período elegido y el anterior de igual largo (para comparar).
  const meses = useMemo(() => {
    if (periodo === 'anio') return rangoMeses(`${mesActual.slice(0, 4)}-01`, mesActual)
    return rangoMeses(sumarMeses(mesActual, -(Number(periodo) - 1)), mesActual)
  }, [periodo, mesActual])
  const mesesAnteriores = useMemo(() => rangoMeses(sumarMeses(meses[0], -meses.length), sumarMeses(meses[0], -1)), [meses])

  async function cargar() {
    setCargando(true)
    // Traemos también el período anterior para la comparación.
    const d = await fetch(`/api/admin/finanzas?desde=${mesesAnteriores[0]}&hasta=${mesActual}`, { headers }).then((r) => r.json()).catch(() => ({ error: 'No se pudo cargar.' }))
    if (d.error) setMensaje(d.error)
    else { setMovimientos(d.movimientos || []); setVentas(d.ventas || {}) }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [mesesAnteriores[0]]) // eslint-disable-line react-hooks/exhaustive-deps

  const delPeriodo = movimientos.filter((m) => meses.includes(mesDe(m.fecha)))
  const delAnterior = movimientos.filter((m) => mesesAnteriores.includes(mesDe(m.fecha)))
  const suma = (l: Movimiento[], t: TipoMovimiento) => l.filter((m) => m.tipo === t).reduce((s, m) => s + m.monto, 0)
  const ing = suma(delPeriodo, 'ingreso')
  const gas = suma(delPeriodo, 'gasto')
  const ingAnt = suma(delAnterior, 'ingreso')
  const gasAnt = suma(delAnterior, 'gasto')
  const res = ing - gas
  const resAnt = ingAnt - gasAnt
  const porMes = resumenPorMes(delPeriodo, meses)
  const vendido = meses.reduce((s, m) => s + (ventas[m]?.vendido || 0), 0)
  const vendidoAnt = mesesAnteriores.reduce((s, m) => s + (ventas[m]?.vendido || 0), 0)
  const pedidosPer = meses.reduce((s, m) => s + (ventas[m]?.pedidos || 0), 0)

  // ¿Estoy creciendo? Último mes completo vs el anterior.
  const mesCerrado = sumarMeses(mesActual, -1)
  const r1 = resumenPorMes(movimientos, [sumarMeses(mesActual, -2), mesCerrado])
  const diagnostico = (() => {
    const [a, b] = r1
    if (!a.ingresos && !b.ingresos && !a.gastos && !b.gastos) return 'Cargá tus ingresos y gastos de cada mes y acá te digo si el negocio está creciendo.'
    const vi = variacion(b.ingresos, a.ingresos)
    const partes = [`En ${nombreMes(mesCerrado, true)} ${b.resultado >= 0 ? `ganaste ${bs(b.resultado)}` : `perdiste ${bs(-b.resultado)}`}`]
    if (vi != null) partes.push(`los ingresos ${vi >= 0 ? 'subieron' : 'bajaron'} ${Math.abs(vi).toFixed(0)}% respecto a ${nombreMes(a.mes, true)}`)
    const vv = variacion(ventas[mesCerrado]?.vendido || 0, ventas[a.mes]?.vendido || 0)
    if (vv != null) partes.push(`y lo vendido en Clasi Click ${vv >= 0 ? 'creció' : 'cayó'} ${Math.abs(vv).toFixed(0)}%`)
    return partes.join(', ') + '.'
  })()

  async function guardar() {
    setGuardando(true)
    setMensaje('')
    try {
      const url = editando ? `/api/admin/finanzas/${editando}` : '/api/admin/finanzas'
      const d = await fetch(url, { method: editando ? 'PATCH' : 'POST', headers, body: JSON.stringify(form) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setMovimientos((prev) => [d.movimiento, ...prev.filter((m) => m.id !== d.movimiento.id)].sort((a, b) => b.fecha.localeCompare(a.fecha)))
      setMensaje(`✓ ${form.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${bs(Number(form.monto))} ${editando ? 'actualizado' : 'guardado'}.`)
      setForm({ ...vacio, tipo: form.tipo, fecha: form.fecha, metodo: form.metodo })
      setEditando(null)
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(m: Movimiento) {
    if (!confirm(`¿Borrar ${m.tipo === 'ingreso' ? 'el ingreso' : 'el gasto'} de ${bs(m.monto)} (${m.categoria})?`)) return
    await fetch(`/api/admin/finanzas/${m.id}`, { method: 'DELETE', headers })
    setMovimientos((prev) => prev.filter((x) => x.id !== m.id))
  }

  async function cargarFijos() {
    const d = await fetch('/api/admin/finanzas', { method: 'POST', headers, body: JSON.stringify({ accion: 'recurrentes', mes: mesActual }) }).then((r) => r.json()).catch(() => ({}))
    if (d.creados) {
      setMovimientos((prev) => [...d.creados, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha)))
      setMensaje(d.creados.length ? `✓ Cargados ${d.creados.length} movimientos fijos de ${nombreMes(mesActual, true)}.` : 'Los fijos de este mes ya estaban cargados.')
    }
  }

  async function cargarEnviosComoIngreso(mes: string) {
    const monto = ventas[mes]?.envios || 0
    if (!monto) return
    setForm({ tipo: 'ingreso', monto: String(Math.round(monto)), categoria: 'Envíos cobrados', descripcion: `Envíos de los pedidos de ${nombreMes(mes, true)}`, fecha: mes === mesActual ? diaBolivia() : `${mes}-28`, metodo: 'QR', recurrente: false })
    setEditando(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function exportar() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const enc = (t: string) => ({ value: t, fontWeight: 'bold', backgroundColor: '#DCEBE5', type: String })
    const hojaResumen = [
      [enc('Mes'), enc('Ingresos'), enc('Gastos'), enc('Resultado'), enc('Pedidos'), enc('Vendido en Clasi Click')],
      ...porMes.map((r) => [{ value: nombreMes(r.mes, true), type: String }, { value: r.ingresos, type: Number }, { value: r.gastos, type: Number }, { value: r.resultado, type: Number }, { value: ventas[r.mes]?.pedidos || 0, type: Number }, { value: Math.round(ventas[r.mes]?.vendido || 0), type: Number }]),
      [{ value: 'Total', type: String, fontWeight: 'bold' }, { value: ing, type: Number, fontWeight: 'bold' }, { value: gas, type: Number, fontWeight: 'bold' }, { value: res, type: Number, fontWeight: 'bold' }, { value: pedidosPer, type: Number }, { value: Math.round(vendido), type: Number }],
    ]
    const hojaMovs = [
      [enc('Fecha'), enc('Tipo'), enc('Categoría'), enc('Descripción'), enc('Método'), enc('Monto'), enc('Fijo')],
      ...delPeriodo.map((m) => [{ value: m.fecha, type: String }, { value: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', type: String }, { value: m.categoria, type: String }, { value: m.descripcion || '', type: String }, { value: m.metodo || '', type: String }, { value: m.tipo === 'ingreso' ? m.monto : -m.monto, type: Number }, { value: m.recurrente ? 'Sí' : '', type: String }]),
    ]
    await (writeXlsxFile as any)([hojaResumen, hojaMovs], { sheets: ['Resumen', 'Movimientos'], fileName: `finanzas-clasiclick-${meses[0]}-a-${meses[meses.length - 1]}.xlsx`, columns: [[{ width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 22 }], [{ width: 12 }, { width: 10 }, { width: 28 }, { width: 40 }, { width: 14 }, { width: 12 }, { width: 6 }]] })
  }

  const categorias = form.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  const lista = delPeriodo.filter((m) => !filtroTipo || m.tipo === filtroTipo)
  const inp = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'
  const textoPeriodo = meses.length === 1 ? nombreMes(meses[0], true) : `${nombreMes(meses[0], true)} – ${nombreMes(meses[meses.length - 1], true)}`

  return (
    <div className="grid gap-4" id="reporte-finanzas">
      {/* Al imprimir sale solo el reporte (sin el menú del admin). */}
      <style>{`@media print { body * { visibility: hidden } #reporte-finanzas, #reporte-finanzas * { visibility: visible } #reporte-finanzas { position: absolute; inset: 0 auto auto 0; width: 100% } }`}</style>
      {/* Cargar */}
      <div className="bg-panel border border-teal rounded-xl p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-display text-lg font-bold text-ink">💰 Finanzas</div>
            <div className="font-body text-xs text-inksoft">Anotá cada ingreso y gasto de Clasi Click para saber si el negocio está creciendo.</div>
          </div>
          <button type="button" onClick={cargarFijos} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink" title="Copia a este mes los movimientos marcados como fijos (alquiler, internet, hosting…)">🔁 Cargar fijos del mes</button>
        </div>
        <div className="flex gap-1 bg-panelalt rounded-lg p-1 w-fit mb-3">
          {(['ingreso', 'gasto'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t, categoria: '' })} className={`px-4 py-1.5 rounded-md border-none font-body text-sm font-semibold ${form.tipo === t ? (t === 'ingreso' ? 'bg-teal text-white' : 'bg-maroon text-white') : 'bg-transparent text-ink'}`}>
              {t === 'ingreso' ? '➕ Ingreso' : '➖ Gasto'}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-[140px_1fr_1fr] gap-2">
          <label className="font-body text-[11px] text-inksoft">Monto (Bs) *<input type="number" inputMode="decimal" min={0} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0" className={`${inp} text-base font-semibold`} /></label>
          <label className="font-body text-[11px] text-inksoft">Categoría *
            <input list="cats-finanzas" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Elegí o escribí una" className={inp} />
            <datalist id="cats-finanzas">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="font-body text-[11px] text-inksoft">Descripción<input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder={form.tipo === 'ingreso' ? 'Ej: comisión pedidos semana 1' : 'Ej: publicidad Facebook octubre'} className={inp} /></label>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {categorias.slice(0, 6).map((c) => (
            <button key={c} type="button" onClick={() => setForm({ ...form, categoria: c })} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${form.categoria === c ? 'bg-ink text-white border-ink' : 'bg-panel text-inksoft border-line'}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 mt-3">
          <label className="font-body text-[11px] text-inksoft">Fecha<input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inp} /></label>
          <label className="font-body text-[11px] text-inksoft">Medio
            <select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })} className={inp}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label className="font-body text-xs text-ink flex items-center gap-1.5 pb-2"><input type="checkbox" checked={form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} className="accent-teal" /> Se repite cada mes</label>
          <span className="flex-1" />
          {editando && <button type="button" onClick={() => { setEditando(null); setForm(vacio) }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs">Cancelar</button>}
          <button type="button" onClick={guardar} disabled={guardando || !(Number(form.monto) > 0) || !form.categoria.trim()} className={`px-4 py-2 rounded-lg border-none text-white font-body text-sm font-semibold disabled:opacity-40 ${form.tipo === 'ingreso' ? 'bg-teal' : 'bg-maroon'}`}>
            {guardando ? 'Guardando…' : editando ? '💾 Guardar cambios' : form.tipo === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto'}
          </button>
        </div>
        {mensaje && <div className="font-body text-xs text-ink mt-2">{mensaje}</div>}
      </div>

      {/* Reporte */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="font-body text-sm font-semibold text-ink mr-2">📊 Reporte · {textoPeriodo}</div>
          <div className="flex gap-1 print:hidden">
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${periodo === p.id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{p.label}</button>
            ))}
          </div>
          <span className="flex-1" />
          <div className="flex gap-1.5 print:hidden">
            <button type="button" onClick={exportar} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink">⬇️ Excel</button>
            <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink">🖨️ Imprimir</button>
          </div>
        </div>

        <div className={`rounded-lg px-3 py-2.5 mb-3 font-body text-sm ${r1[1].resultado >= 0 ? 'bg-tealsoft text-ink' : 'bg-maroonsoft text-ink'}`}>📈 {diagnostico}</div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {[
            { t: 'Ingresos', v: bs(ing), sub: <Variacion v={variacion(ing, ingAnt)} /> },
            { t: 'Gastos', v: bs(gas), sub: <Variacion v={variacion(gas, gasAnt)} inverso /> },
            { t: res >= 0 ? 'Ganancia' : 'Pérdida', v: bs(Math.abs(res)), sub: <Variacion v={variacion(res, resAnt)} />, color: res >= 0 ? 'text-teal' : 'text-maroon' },
            { t: 'Vendido en Clasi Click', v: bs(vendido), sub: <span className="text-inksoft">{pedidosPer} pedidos · <Variacion v={variacion(vendido, vendidoAnt)} /></span> },
          ].map((k) => (
            <div key={k.t} className="bg-panelalt rounded-lg p-3">
              <div className="font-body text-[11px] text-inksoft uppercase tracking-wide">{k.t}</div>
              <div className={`font-display text-2xl font-bold ${k.color || 'text-ink'}`}>{k.v}</div>
              <div className="font-body text-[11px] mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {cargando ? <div className="font-body text-xs text-inksoft">Cargando…</div> : (
          <>
            {meses.length > 1 && <GraficoMeses datos={porMes} />}
            <div className="overflow-x-auto mt-3">
              <table className="w-full min-w-[560px] border-collapse font-body text-xs">
                <thead><tr className="text-left text-inksoft border-b border-line"><th className="p-1.5">Mes</th><th className="p-1.5 text-right">Ingresos</th><th className="p-1.5 text-right">Gastos</th><th className="p-1.5 text-right">Resultado</th><th className="p-1.5 text-right">Pedidos</th><th className="p-1.5 text-right">Vendido</th><th className="p-1.5 print:hidden" /></tr></thead>
                <tbody>
                  {porMes.map((r) => (
                    <tr key={r.mes} className="border-b border-line/60">
                      <td className="p-1.5 text-ink">{nombreMes(r.mes, true)}</td>
                      <td className="p-1.5 text-right">{bs(r.ingresos)}</td>
                      <td className="p-1.5 text-right">{bs(r.gastos)}</td>
                      <td className={`p-1.5 text-right font-semibold ${r.resultado >= 0 ? 'text-teal' : 'text-maroon'}`}>{r.resultado < 0 ? '−' : ''}{bs(Math.abs(r.resultado))}</td>
                      <td className="p-1.5 text-right">{ventas[r.mes]?.pedidos || 0}</td>
                      <td className="p-1.5 text-right">{bs(ventas[r.mes]?.vendido || 0)}</td>
                      <td className="p-1.5 text-right print:hidden">{(ventas[r.mes]?.envios || 0) > 0 && <button type="button" onClick={() => cargarEnviosComoIngreso(r.mes)} className="text-teal underline bg-transparent border-none p-0 text-[11px]" title="Prepara un ingreso con lo cobrado en envíos ese mes">+ envíos {bs(ventas[r.mes]!.envios)}</button>}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold"><td className="p-1.5">Total</td><td className="p-1.5 text-right">{bs(ing)}</td><td className="p-1.5 text-right">{bs(gas)}</td><td className={`p-1.5 text-right ${res >= 0 ? 'text-teal' : 'text-maroon'}`}>{res < 0 ? '−' : ''}{bs(Math.abs(res))}</td><td className="p-1.5 text-right">{pedidosPer}</td><td className="p-1.5 text-right">{bs(vendido)}</td><td /></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <BarrasCategoria titulo="¿De dónde entra la plata?" filas={porCategoria(delPeriodo, 'ingreso')} color={COLOR_INGRESO} />
        <BarrasCategoria titulo="¿En qué se va la plata?" filas={porCategoria(delPeriodo, 'gasto')} color={COLOR_GASTO} />
      </div>

      {/* Movimientos */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="font-body text-sm font-semibold text-ink mr-2">Movimientos ({lista.length})</div>
          {(['', 'ingreso', 'gasto'] as const).map((t) => (
            <button key={t || 'todos'} type="button" onClick={() => setFiltroTipo(t)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] print:hidden ${filtroTipo === t ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{t === '' ? 'Todos' : t === 'ingreso' ? 'Ingresos' : 'Gastos'}</button>
          ))}
        </div>
        {!lista.length ? <div className="font-body text-xs text-inksoft">Todavía no hay movimientos en este período.</div> : (
          <div className="grid gap-1">
            {lista.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 border-b border-line/60 py-1.5 font-body text-xs">
                <span className="text-inksoft w-[72px]">{m.fecha.split('-').reverse().join('/')}</span>
                <span className={`w-5 text-center ${m.tipo === 'ingreso' ? 'text-teal' : 'text-maroon'}`}>{m.tipo === 'ingreso' ? '➕' : '➖'}</span>
                <span className="flex-1 min-w-[160px] text-ink"><b>{m.categoria}</b>{m.descripcion ? ` · ${m.descripcion}` : ''}{m.recurrente ? ' · 🔁 fijo' : ''}{m.metodo ? <span className="text-inksoft"> · {m.metodo}</span> : null}</span>
                <span className={`font-semibold w-[100px] text-right ${m.tipo === 'ingreso' ? 'text-teal' : 'text-maroon'}`}>{m.tipo === 'gasto' ? '−' : '+'}{bs(m.monto)}</span>
                <span className="flex gap-2 print:hidden">
                  <button type="button" onClick={() => { setEditando(m.id); setForm({ tipo: m.tipo, monto: String(m.monto), categoria: m.categoria, descripcion: m.descripcion || '', fecha: m.fecha, metodo: m.metodo || 'Efectivo', recurrente: !!m.recurrente }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-teal underline bg-transparent border-none p-0">Editar</button>
                  <button type="button" onClick={() => borrar(m)} className="text-maroon underline bg-transparent border-none p-0">Borrar</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
