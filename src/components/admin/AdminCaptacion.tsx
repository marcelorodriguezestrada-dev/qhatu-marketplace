'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapaProspectos } from '@/components/admin/MapaProspectos'
import type { Caja, PuntoMapa } from '@/components/admin/MapaProspectosCliente'
import { CIUDADES } from '@/data/ciudades'
import {
  CAMPANA_DEFECTO,
  ESTADOS_PROSPECTO,
  cuposRestantes,
  linkWhatsapp,
  mensajeInicialBase,
  numeroWhatsapp,
  type Campana,
  type EstadoProspecto,
  type PlanCampana,
  type Prospecto,
  type TiendaMapa,
} from '@/lib/prospectos'

// Admin → 🎯 Captar tiendas:
// - Mapa de Potosí o La Paz con las tiendas que conoce OpenStreetMap
//   ("Buscar tiendas en esta zona") y tus prospectos de colores.
// - Cada tienda: WhatsApp con el mensaje de la campaña y "Guardar como
//   prospecto". También se cargan a mano (tocando el mapa para ubicarla).
// - Campaña: "1 año gratis a las 10 primeras" (editable); al marcar un
//   prospecto "Registrado" se le asigna un cupo mientras queden.
// - ✨ Estrategia con IA por prospecto (mensajes, argumentos, objeciones,
//   pasos) y 📋 plan general de la campaña.

const SITIO = typeof window !== 'undefined' ? `${window.location.origin}/vender` : 'https://clasiclick.ezeti.pro/vender'
const colorEstado = (e: EstadoProspecto) => ESTADOS_PROSPECTO.find((x) => x.id === e)?.color || '#6366f1'
const vacio = { nombre: '', rubro: '', whatsapp: '', contacto: '', direccion: '', redes: '', notas: '', lat: null as number | null, lng: null as number | null }

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {}) }} className="px-2 py-1 rounded-md border border-line bg-panel font-body text-[11px] text-ink">
      {ok ? '✓ Copiado' : '📋 Copiar'}
    </button>
  )
}

function Mensaje({ titulo, texto, whatsapp }: { titulo: string; texto: string; whatsapp: string }) {
  return (
    <div className="bg-panelalt rounded-lg p-3">
      <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">{titulo}</div>
      <div className="font-body text-xs text-ink whitespace-pre-wrap">{texto}</div>
      <div className="flex gap-2 mt-2">
        <a href={linkWhatsapp(whatsapp, texto)} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-md bg-[#25D366] text-white font-body text-[11px] font-semibold no-underline">💬 Enviar por WhatsApp</a>
        <Copiar texto={texto} />
      </div>
    </div>
  )
}

export default function AdminCaptacion({ password }: { password: string }) {
  const [ciudad, setCiudad] = useState<'potosi' | 'la-paz'>('potosi')
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [campana, setCampana] = useState<Campana>(CAMPANA_DEFECTO)
  const [editandoCampana, setEditandoCampana] = useState(false)
  const [borradorCampana, setBorradorCampana] = useState<Campana>(CAMPANA_DEFECTO)
  const [tiendas, setTiendas] = useState<TiendaMapa[]>([])
  const [caja, setCaja] = useState<Caja | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [filtroRubro, setFiltroRubro] = useState('')
  const [soloConTelefono, setSoloConTelefono] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProspecto | ''>('')
  const [form, setForm] = useState(vacio)
  const [formAbierto, setFormAbierto] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [generando, setGenerando] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanCampana | null>(null)
  const [centro, setCentro] = useState<[number, number]>([CIUDADES[0].centro.lat, CIUDADES[0].centro.lng])

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  async function cargar() {
    const d = await fetch('/api/admin/prospectos', { headers }).then((r) => r.json()).catch(() => ({}))
    if (d.error) { setMensaje(d.error); return }
    setProspectos(d.prospectos || [])
    if (d.campana) { setCampana(d.campana); setBorradorCampana(d.campana) }
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function cambiarCiudad(c: 'potosi' | 'la-paz') {
    setCiudad(c)
    const x = CIUDADES.find((y) => y.id === c)!
    setCentro([x.centro.lat, x.centro.lng])
    setTiendas([])
  }

  const quedan = cuposRestantes(campana, prospectos)
  const deCiudad = prospectos.filter((p) => (p.ciudad || 'potosi') === ciudad)
  const porOsm = useMemo(() => new Map(prospectos.filter((p) => p.osmId).map((p) => [p.osmId!, p])), [prospectos])

  async function buscarTiendas() {
    if (!caja) return
    setBuscando(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/prospectos/tiendas-mapa', { method: 'POST', headers, body: JSON.stringify(caja) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setTiendas(d.tiendas || [])
      setMensaje(d.tiendas?.length ? `${d.tiendas.length} tiendas en esta zona del mapa (${d.tiendas.filter((t: TiendaMapa) => t.telefono).length} con teléfono). Tocá un punto para escribirle o guardarla.` : 'OpenStreetMap no tiene tiendas cargadas en esta zona. Agregalas a mano.')
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudieron buscar las tiendas.')
    } finally {
      setBuscando(false)
    }
  }

  async function guardarProspecto(datos: Partial<Prospecto> & { osmId?: string; origen?: 'mapa' | 'manual' }) {
    setGuardando(true)
    setMensaje('')
    try {
      const d = await fetch('/api/admin/prospectos', { method: 'POST', headers, body: JSON.stringify({ ciudad, ...datos }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setProspectos((prev) => [d.prospecto, ...prev])
      setMensaje(`✓ ${d.prospecto.nombre} agregado a tus prospectos.`)
      return d.prospecto as Prospecto
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
      return null
    } finally {
      setGuardando(false)
    }
  }

  async function actualizar(id: string, cambios: Partial<Prospecto>) {
    const d = await fetch(`/api/admin/prospectos/${id}`, { method: 'PATCH', headers, body: JSON.stringify(cambios) }).then((r) => r.json()).catch(() => ({ error: 'No se pudo guardar.' }))
    if (d.error) { setMensaje(d.error); return }
    setProspectos((prev) => prev.map((p) => (p.id === id ? { ...p, ...d.prospecto } : p)))
    if (cambios.estado === 'registrado') setMensaje(d.prospecto.beneficio ? `🎁 ${d.prospecto.nombre} tiene su cupo: ${campana.oferta}.` : `${d.prospecto.nombre} quedó registrado (ya no quedaban cupos de la promo).`)
  }

  async function borrar(p: Prospecto) {
    if (!confirm(`¿Borrar a ${p.nombre} de tus prospectos?`)) return
    await fetch(`/api/admin/prospectos/${p.id}`, { method: 'DELETE', headers })
    setProspectos((prev) => prev.filter((x) => x.id !== p.id))
  }

  async function generarEstrategia(p: Prospecto) {
    setGenerando(p.id)
    setAbierto(p.id)
    try {
      const d = await fetch('/api/admin/prospectos/estrategia', { method: 'POST', headers, body: JSON.stringify({ id: p.id }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setProspectos((prev) => prev.map((x) => (x.id === p.id ? { ...x, estrategia: d.estrategia } : x)))
      if (!d.ia) setMensaje('La IA no respondió: te dejé una estrategia armada con la plantilla (la podés regenerar más tarde).')
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la estrategia.')
    } finally {
      setGenerando(null)
    }
  }

  async function generarPlan() {
    setGenerando('plan')
    try {
      const d = await fetch('/api/admin/prospectos/estrategia', { method: 'POST', headers, body: JSON.stringify({ campana: true }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setPlan(d.plan)
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el plan.')
    } finally {
      setGenerando(null)
    }
  }

  async function guardarCampana() {
    const d = await fetch('/api/admin/prospectos', { method: 'PUT', headers, body: JSON.stringify({ campana: borradorCampana }) }).then((r) => r.json()).catch(() => ({}))
    if (d.campana) { setCampana(d.campana); setEditandoCampana(false) }
  }

  // Puntos del mapa: tiendas de OSM (las que no son prospecto) + prospectos.
  const rubrosMapa = Array.from(new Set(tiendas.map((t) => t.rubro))).sort()
  const tiendasVisibles = tiendas.filter((t) => !porOsm.has(t.osmId) && (!filtroRubro || t.rubro === filtroRubro) && (!soloConTelefono || t.telefono))
  const puntos: PuntoMapa[] = [
    ...tiendasVisibles.map((t) => ({
      id: t.osmId,
      lat: t.lat,
      lng: t.lng,
      color: t.telefono ? '#2563eb' : '#93c5fd',
      titulo: `${t.nombre} · ${t.rubro}`,
      popup: (
        <div className="font-body text-xs grid gap-1.5">
          <div className="font-semibold text-sm text-ink">{t.nombre}</div>
          <div className="text-inksoft">{t.rubro}{t.direccion ? ` · ${t.direccion}` : ''}</div>
          {t.telefono ? <div>📞 {t.telefono}</div> : <div className="text-inksoft">Sin teléfono en el mapa</div>}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {numeroWhatsapp(t.telefono) && (
              <a href={linkWhatsapp(t.telefono, mensajeInicialBase({ ...t, ciudad, contacto: '' }, campana, quedan, SITIO))} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-[#25D366] !text-white font-semibold no-underline">💬 WhatsApp</a>
            )}
            <button type="button" disabled={guardando} onClick={() => guardarProspecto({ nombre: t.nombre, rubro: t.rubro, whatsapp: numeroWhatsapp(t.telefono) ? t.telefono : '', direccion: t.direccion, lat: t.lat, lng: t.lng, redes: t.web, osmId: t.osmId, origen: 'mapa' })} className="px-2 py-1 rounded border border-teal bg-white text-teal font-semibold">➕ Guardar prospecto</button>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.nombre} ${ciudad === 'la-paz' ? 'La Paz' : 'Potosí'} Bolivia`)}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded border border-line bg-white text-ink no-underline">🔎 Ver en Google</a>
          </div>
        </div>
      ),
    })),
    ...deCiudad.filter((p) => p.lat != null && p.lng != null).map((p) => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      color: colorEstado(p.estado),
      grande: true,
      titulo: `${p.nombre} · ${ESTADOS_PROSPECTO.find((e) => e.id === p.estado)?.label}`,
      popup: (
        <div className="font-body text-xs grid gap-1.5">
          <div className="font-semibold text-sm text-ink">{p.nombre}{p.beneficio ? ' 🎁' : ''}</div>
          <div className="text-inksoft">{p.rubro} · {ESTADOS_PROSPECTO.find((e) => e.id === p.estado)?.label}</div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <a href={linkWhatsapp(p.whatsapp, p.estrategia?.mensajeInicial || mensajeInicialBase(p, campana, quedan, SITIO))} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-[#25D366] !text-white font-semibold no-underline">💬 WhatsApp</a>
            <button type="button" onClick={() => { setAbierto(p.id); document.getElementById(`prospecto-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} className="px-2 py-1 rounded border border-line bg-white text-ink">Ver ficha</button>
          </div>
        </div>
      ),
    })),
    ...(form.lat != null && form.lng != null ? [{ id: 'nuevo', lat: form.lat, lng: form.lng, color: '#dc2626', grande: true, titulo: 'Nuevo prospecto', popup: <div className="font-body text-xs">Ubicación del prospecto nuevo</div> }] : []),
  ]

  const lista = deCiudad.filter((p) => !filtroEstado || p.estado === filtroEstado)
  const cuenta = (e: EstadoProspecto) => deCiudad.filter((p) => p.estado === e).length
  const inp = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'

  return (
    <div className="grid gap-4">
      {/* Campaña */}
      <div className="bg-panel border border-teal rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg font-bold text-ink">🎯 Captar tiendas</div>
            <div className="font-body text-xs text-inksoft">Buscá tiendas en el mapa, escribiles por WhatsApp y seguí cada prospecto hasta que se registre.</div>
          </div>
          <div className="flex gap-1 bg-panelalt rounded-lg p-1">
            {CIUDADES.map((c) => (
              <button key={c.id} type="button" onClick={() => cambiarCiudad(c.id as any)} className={`px-3 py-1.5 rounded-md border-none font-body text-xs font-semibold ${ciudad === c.id ? 'bg-ink text-white' : 'bg-transparent text-ink'}`}>{c.nombre}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-amber-50 border border-ochre px-3 py-2.5 flex flex-wrap items-center gap-3">
          <div className="font-body text-sm text-ink flex-1 min-w-[200px]">
            🎁 <b>{campana.oferta}</b> para las <b>{campana.cupos} primeras tiendas</b> ·{' '}
            <span className={quedan ? 'text-teal font-semibold' : 'text-maroon font-semibold'}>{quedan ? `quedan ${quedan} cupos` : 'cupos agotados'}</span>
            <div className="h-1.5 rounded-full bg-white mt-1.5 overflow-hidden"><div className="h-full bg-teal" style={{ width: `${((campana.cupos - quedan) / campana.cupos) * 100}%` }} /></div>
          </div>
          <button type="button" onClick={() => setEditandoCampana((v) => !v)} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink">✏️ Editar campaña</button>
          <button type="button" onClick={generarPlan} disabled={generando === 'plan'} className="px-3 py-1.5 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-50">{generando === 'plan' ? 'Pensando…' : '📋 Plan de campaña con IA'}</button>
        </div>
        {editandoCampana && (
          <div className="mt-3 grid sm:grid-cols-[1fr_120px] gap-2">
            <label className="font-body text-xs text-ink">Oferta<input value={borradorCampana.oferta} onChange={(e) => setBorradorCampana({ ...borradorCampana, oferta: e.target.value })} className={inp} placeholder="1 año gratis de tienda en Clasi Click" /></label>
            <label className="font-body text-xs text-ink">Cupos<input type="number" min={1} value={borradorCampana.cupos} onChange={(e) => setBorradorCampana({ ...borradorCampana, cupos: Number(e.target.value) })} className={inp} /></label>
            <label className="font-body text-xs text-ink sm:col-span-2">Tono o datos extra para la IA (opcional)<textarea value={borradorCampana.mensajeBase} onChange={(e) => setBorradorCampana({ ...borradorCampana, mensajeBase: e.target.value })} rows={2} className={inp} placeholder="Ej: somos de Potosí, el envío es gratis el primer mes, ofrecemos fotos profesionales…" /></label>
            <div className="sm:col-span-2 flex gap-2"><button type="button" onClick={guardarCampana} className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold">Guardar campaña</button><button type="button" onClick={() => setEditandoCampana(false)} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs">Cancelar</button></div>
          </div>
        )}
        {plan && (
          <div className="mt-3 grid gap-3 border-t border-line pt-3">
            <div className="flex justify-between items-start gap-2"><div className="font-body text-sm text-ink">{plan.resumen}</div><button type="button" onClick={() => setPlan(null)} className="font-body text-xs text-inksoft underline bg-transparent border-none">Cerrar</button></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {plan.fases.map((f, i) => (
                <div key={i} className="bg-panelalt rounded-lg p-3">
                  <div className="font-body text-[11px] font-semibold text-indigo-700 uppercase">{f.cuando}</div>
                  <div className="font-body text-sm font-semibold text-ink mb-1">{f.nombre}</div>
                  <ul className="font-body text-xs text-ink pl-4 m-0 grid gap-0.5">{f.acciones.map((a, j) => <li key={j}>{a}</li>)}</ul>
                </div>
              ))}
            </div>
            <Mensaje titulo="Mensaje para cualquier tienda" texto={plan.mensajeGeneral} whatsapp="" />
            <div className="bg-panelalt rounded-lg p-3">
              <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Publicación para redes</div>
              <div className="font-body text-xs text-ink whitespace-pre-wrap">{plan.publicacion}</div>
              <div className="mt-2"><Copiar texto={plan.publicacion} /></div>
            </div>
            {plan.metas.length > 0 && <div className="font-body text-xs text-ink">🎯 Metas: {plan.metas.join(' · ')}</div>}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button type="button" onClick={buscarTiendas} disabled={buscando || !caja} className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-50">{buscando ? 'Buscando…' : '🔎 Buscar tiendas en esta zona'}</button>
          {tiendas.length > 0 && (
            <>
              <select value={filtroRubro} onChange={(e) => setFiltroRubro(e.target.value)} className="px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs">
                <option value="">Todos los rubros ({tiendas.length})</option>
                {rubrosMapa.map((r) => <option key={r} value={r}>{r} ({tiendas.filter((t) => t.rubro === r).length})</option>)}
              </select>
              <label className="font-body text-xs text-ink flex items-center gap-1.5"><input type="checkbox" checked={soloConTelefono} onChange={(e) => setSoloConTelefono(e.target.checked)} className="accent-teal" /> Solo con teléfono</label>
            </>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => { setFormAbierto(true); setMarcando(true) }} className="px-3 py-2 rounded-lg border border-teal bg-panel text-teal font-body text-xs font-semibold">➕ Agregar a mano</button>
        </div>
        {marcando && <div className="font-body text-xs text-teal font-semibold mb-2">📍 Tocá en el mapa dónde está la tienda.</div>}
        <MapaProspectos
          centro={centro}
          puntos={puntos}
          onMover={setCaja}
          marcando={marcando}
          onTocar={marcando ? (lat, lng) => { setForm((f) => ({ ...f, lat, lng })); setMarcando(false) } : undefined}
        />
        <div className="flex flex-wrap gap-3 mt-2 font-body text-[11px] text-inksoft">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2563eb] mr-1" />Tienda con teléfono</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#93c5fd] mr-1" />Tienda sin teléfono</span>
          {ESTADOS_PROSPECTO.map((e) => <span key={e.id}><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: e.color }} />{e.label}</span>)}
        </div>
        {mensaje && <div className="font-body text-xs text-ink mt-2">{mensaje}</div>}

        {formAbierto && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="font-body text-sm font-semibold text-ink mb-2">➕ Nuevo prospecto ({ciudad === 'la-paz' ? 'La Paz' : 'Potosí'})</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la tienda *" className={inp} />
              <input value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value })} placeholder="Rubro (ej. Ropa, Calzado)" className={inp} />
              <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp (ej. 71234567)" inputMode="tel" className={inp} />
              <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Persona de contacto" className={inp} />
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección" className={inp} />
              <input value={form.redes} onChange={(e) => setForm({ ...form, redes: e.target.value })} placeholder="Facebook / Instagram / TikTok" className={inp} />
              <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Notas (qué vende, horario, cómo te atendió…)" rows={2} className={`${inp} sm:col-span-2`} />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="font-body text-xs text-inksoft">{form.lat != null ? '📍 Ubicación marcada en el mapa' : 'Sin ubicación'}</span>
              <button type="button" onClick={() => setMarcando(true)} className="font-body text-xs text-teal underline bg-transparent border-none">{form.lat != null ? 'Cambiar' : 'Marcar en el mapa'}</button>
              <span className="flex-1" />
              <button type="button" onClick={() => { setFormAbierto(false); setMarcando(false); setForm(vacio) }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs">Cancelar</button>
              <button type="button" disabled={guardando || form.nombre.trim().length < 2} onClick={async () => { const p = await guardarProspecto({ ...form, origen: 'manual' }); if (p) { setForm(vacio); setFormAbierto(false); setMarcando(false) } }} className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar prospecto'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Prospectos */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="font-body text-sm font-semibold text-ink mr-2">Prospectos ({deCiudad.length})</div>
          <button type="button" onClick={() => setFiltroEstado('')} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${!filtroEstado ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>Todos</button>
          {ESTADOS_PROSPECTO.map((e) => (
            <button key={e.id} type="button" onClick={() => setFiltroEstado(e.id)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${filtroEstado === e.id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{e.label} {cuenta(e.id)}</button>
          ))}
        </div>
        {lista.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay prospectos{filtroEstado ? ' en este estado' : ''}. Buscá tiendas en el mapa o agregalas a mano.</div>}
        <div className="grid gap-2">
          {lista.map((p) => {
            const msg = p.estrategia?.mensajeInicial || mensajeInicialBase(p, campana, quedan, SITIO)
            const abiertoEste = abierto === p.id
            return (
              <div key={p.id} id={`prospecto-${p.id}`} className="border border-line rounded-lg">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorEstado(p.estado) }} />
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-body text-sm font-semibold text-ink">{p.nombre}{p.beneficio && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-[10px] text-amber-800">🎁 Cupo</span>}</div>
                    <div className="font-body text-[11px] text-inksoft">{[p.rubro, p.contacto, p.whatsapp && `📱 ${p.whatsapp}`, p.direccion].filter(Boolean).join(' · ') || 'Sin datos'}</div>
                  </div>
                  <select value={p.estado} onChange={(e) => actualizar(p.id, { estado: e.target.value as EstadoProspecto })} className="px-2 py-1.5 rounded-lg border border-line bg-panel font-body text-xs">
                    {ESTADOS_PROSPECTO.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                  <a href={linkWhatsapp(p.whatsapp, msg)} target="_blank" rel="noopener noreferrer" onClick={() => { if (p.estado === 'nuevo') actualizar(p.id, { estado: 'contactado' }) }} className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white font-body text-xs font-semibold no-underline" title={p.whatsapp ? '' : 'Sin número: elegís el contacto en WhatsApp'}>💬 WhatsApp</a>
                  <button type="button" onClick={() => setAbierto(abiertoEste ? null : p.id)} className="px-2.5 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink">{abiertoEste ? 'Cerrar' : 'Ficha y estrategia'}</button>
                </div>
                {abiertoEste && (
                  <div className="border-t border-line p-3 grid gap-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(['nombre', 'rubro', 'whatsapp', 'contacto', 'direccion', 'redes'] as const).map((k) => (
                        <label key={k} className="font-body text-[11px] text-inksoft capitalize">{k === 'whatsapp' ? 'WhatsApp' : k}
                          <input defaultValue={(p as any)[k] || ''} onBlur={(e) => { if (e.target.value !== ((p as any)[k] || '')) actualizar(p.id, { [k]: e.target.value } as any) }} className={inp} />
                        </label>
                      ))}
                      <label className="font-body text-[11px] text-inksoft sm:col-span-2">Notas
                        <textarea defaultValue={p.notas || ''} onBlur={(e) => { if (e.target.value !== (p.notas || '')) actualizar(p.id, { notas: e.target.value }) }} rows={2} className={inp} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button type="button" onClick={() => generarEstrategia(p)} disabled={generando === p.id} className="px-3.5 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-50">{generando === p.id ? 'Pensando la estrategia…' : p.estrategia ? '✨ Regenerar estrategia' : '✨ Generar estrategia de marketing'}</button>
                      {p.lat != null && <button type="button" onClick={() => { setCentro([p.lat!, p.lng!]); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink">📍 Ver en el mapa</button>}
                      <span className="flex-1" />
                      <button type="button" onClick={() => borrar(p)} className="font-body text-xs text-maroon underline bg-transparent border-none">Borrar</button>
                    </div>
                    {p.estrategia && (
                      <div className="grid gap-2">
                        <div className="font-body text-sm text-ink bg-indigo-50 border border-indigo-100 rounded-lg p-3">🧭 {p.estrategia.resumen}</div>
                        <Mensaje titulo="1. Primer mensaje" texto={p.estrategia.mensajeInicial} whatsapp={p.whatsapp} />
                        <Mensaje titulo="2. Seguimiento (a los 2 días)" texto={p.estrategia.seguimiento1} whatsapp={p.whatsapp} />
                        <Mensaje titulo="3. Cierre" texto={p.estrategia.seguimiento2} whatsapp={p.whatsapp} />
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div className="bg-panelalt rounded-lg p-3">
                            <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Argumentos</div>
                            <ul className="font-body text-xs text-ink pl-4 m-0 grid gap-0.5">{p.estrategia.argumentos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                          </div>
                          <div className="bg-panelalt rounded-lg p-3">
                            <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Plan</div>
                            <ol className="font-body text-xs text-ink pl-4 m-0 grid gap-0.5">{p.estrategia.pasos.map((a, i) => <li key={i}>{a}</li>)}</ol>
                          </div>
                        </div>
                        <div className="bg-panelalt rounded-lg p-3">
                          <div className="font-body text-[11px] font-semibold text-inksoft uppercase tracking-wide mb-1">Si te dice…</div>
                          <div className="grid gap-1.5">{p.estrategia.objeciones.map((o, i) => <div key={i} className="font-body text-xs"><b className="text-ink">“{o.objecion}”</b><div className="text-inksoft">→ {o.respuesta}</div></div>)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
