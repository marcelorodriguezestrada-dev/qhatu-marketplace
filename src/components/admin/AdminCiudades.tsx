'use client'

import { useEffect, useState } from 'react'
import { cargarCiudades } from '@/lib/ciudad'
import type { EstadoCiudad } from '@/data/ciudades'
import { banderaDe, type PaisMercado } from '@/data/paisesMercado'
import type { CiudadInfo } from '@/lib/ciudadesServer'
import { subirFotoAdmin } from '@/lib/subirFotoAdmin'

// Admin → Inicio → "🌎 Países y ciudades".
// - Cada ciudad: Abierta (todos la ven) / En prueba (solo las cuentas de
//   prueba: así se arma y se prueba antes de abrirla) / Cerrada, y si
//   tiene envío propio de Clasi Click (si no, envía cada tienda).
// - "➕ Agregar ciudad": de cualquier país; se ubica sola en el mapa.
// - Países: moneda, teléfono, zona horaria y formas de pago (QR y/o
//   transferencia). El checkout los va a usar al habilitar cada país.
// Las cuentas de prueba de cada ciudad se crean en Admin → Usuarios.

const ESTADOS: { id: EstadoCiudad; label: string }[] = [
  { id: 'abierta', label: '🟢 Abierta' },
  { id: 'prueba', label: '🧪 En prueba' },
  { id: 'cerrada', label: '⚪ Cerrada' },
]

const PAIS_VACIO: PaisMercado = {
  id: '',
  nombre: '',
  bandera: '',
  moneda: '',
  simboloMoneda: '$',
  prefijoTel: '',
  digitosTel: 10,
  zonaHoraria: '',
  pagos: { qr: true, transferencia: false, qrUrl: '', linkPago: '', alias: '', cuenta: '', titular: '', banco: '' },
}

const input = 'w-full px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-xs'
const etiqueta = 'block font-body text-[11px] text-inksoft mb-0.5'

export default function AdminCiudades({ password }: { password: string }) {
  const [ciudades, setCiudades] = useState<CiudadInfo[] | null>(null)
  const [paises, setPaises] = useState<PaisMercado[]>([])
  const [guardando, setGuardando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [nueva, setNueva] = useState<{ pais: string; nombre: string; departamento: string; lugar: string; zonas: string } | null>(null)
  const [ubicada, setUbicada] = useState<{ lat: number; lng: number; nombre: string } | null>(null)
  const [paisEditado, setPaisEditado] = useState<{ datos: PaisMercado; nuevo: boolean } | null>(null)

  async function llamar(body: any, clave: string, ok = 'Guardado ✓ (en el sitio se ve en 1–2 minutos)') {
    setGuardando(clave)
    setMensaje('')
    try {
      const res = await fetch('/api/admin/ciudades', {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar.')
      if (d.ciudades) {
        setCiudades(d.ciudades)
        setPaises(d.paises || [])
        cargarCiudades(true)
      }
      if (body) setMensaje(ok)
      return d
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
      return null
    } finally {
      setGuardando(null)
    }
  }

  useEffect(() => {
    llamar(null, 'cargar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiarEstado(c: CiudadInfo, estado: EstadoCiudad) {
    if (estado === 'abierta' && !confirm(`¿Abrir ${c.nombre} para todos? A los compradores les va a aparecer en el selector de ciudad.`)) return
    llamar({ accion: 'estado', id: c.id, estado }, c.id + 'estado')
  }

  async function ubicar() {
    if (!nueva) return
    setUbicada(null)
    const q = nueva.lugar.trim() || `${nueva.nombre}, ${paises.find((p) => p.id === nueva.pais)?.nombre || ''}`
    const d = await llamar({ accion: 'ubicar', q, pais: nueva.pais }, 'ubicar', '📍 Encontrado en el mapa')
    if (d && typeof d.lat === 'number') setUbicada(d)
  }

  async function guardarCiudad() {
    if (!nueva || !ubicada) return
    const zonas = nueva.zonas.split('\n').map((z) => z.trim()).filter(Boolean).map((nombre) => ({ nombre }))
    const d = await llamar(
      { accion: 'agregar', ciudad: { nombre: nueva.nombre, pais: nueva.pais, departamento: nueva.departamento, centro: { lat: ubicada.lat, lng: ubicada.lng, nombre: nueva.lugar.trim() || ubicada.nombre }, zonas } },
      'agregar',
      `✓ ${nueva.nombre} agregada EN PRUEBA: solo la ven las cuentas de prueba. Creá una en Admin → Usuarios → "🧪 Crear usuario de prueba".`,
    )
    if (d) { setNueva(null); setUbicada(null) }
  }

  async function guardarPais() {
    if (!paisEditado) return
    const d = await llamar({ accion: 'pais', pais: paisEditado.datos }, 'pais')
    if (d) setPaisEditado(null)
  }

  const porPais = paises
    .map((p) => ({ pais: p, ciudades: (ciudades || []).filter((c) => c.pais === p.id) }))
    .concat(
      Array.from(new Set((ciudades || []).map((c) => c.pais)))
        .filter((id) => !paises.some((p) => p.id === id))
        .map((id) => ({ pais: { ...PAIS_VACIO, id, nombre: id, bandera: banderaDe(id) }, ciudades: (ciudades || []).filter((c) => c.pais === id) })),
    )
  const pe = paisEditado?.datos
  const setPe = (cambios: Partial<PaisMercado>) => setPaisEditado((x) => (x ? { ...x, datos: { ...x.datos, ...cambios } } : x))
  const setPago = (cambios: Partial<PaisMercado['pagos']>) => setPaisEditado((x) => (x ? { ...x, datos: { ...x.datos, pagos: { ...x.datos.pagos, ...cambios } } } : x))

  return (
    <div className="bg-panel border border-line rounded-xl p-4 mb-6">
      <div className="font-body text-sm font-semibold text-ink mb-1">🌎 Países y ciudades</div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        Una ciudad nueva arranca <b>🧪 En prueba</b>: solo la ven las cuentas de prueba (Admin → Usuarios → “🧪 Crear usuario de prueba”). Cuando esté lista, pasala a <b>🟢 Abierta</b>. Con una sola ciudad abierta, el sitio se ve igual que siempre.
      </div>

      {!ciudades ? (
        <div className="font-body text-xs text-inksoft">Cargando...</div>
      ) : (
        <div className="grid gap-3">
          {porPais.map(({ pais, ciudades: lista }) => (
            <div key={pais.id} className="rounded-lg border border-line">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-panelalt rounded-t-lg">
                <div className="font-body text-sm font-semibold text-ink">
                  {pais.bandera} {pais.nombre}
                  <span className="font-normal text-[11px] text-inksoft"> · {pais.simboloMoneda} ({pais.moneda}) · +{pais.prefijoTel} · {[pais.pagos.qr && 'QR', pais.pagos.transferencia && 'Transferencia'].filter(Boolean).join(' + ') || 'sin forma de pago'}</span>
                </div>
                <button type="button" onClick={() => setPaisEditado({ datos: pais, nuevo: false })} className="shrink-0 font-body text-[11px] text-teal underline">Editar país</button>
              </div>
              {lista.length === 0 && <div className="px-3 py-2 font-body text-[11px] text-inksoft">Sin ciudades todavía.</div>}
              {lista.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 border-t border-line font-body text-sm text-ink">
                  <span className="font-semibold min-w-[7rem]">{c.nombre}{c.departamento && c.departamento !== c.nombre ? <span className="font-normal text-[11px] text-inksoft"> · {c.departamento}</span> : null}</span>
                  <select
                    value={c.estado}
                    disabled={c.id === 'potosi' || guardando === c.id + 'estado'}
                    onChange={(e) => cambiarEstado(c, e.target.value as EstadoCiudad)}
                    className="px-2 py-1 rounded-md border border-line bg-panel font-body text-xs"
                    aria-label={`Estado de ${c.nombre}`}
                  >
                    {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Envío propio de Clasi Click. Si no, envía cada tienda (o retiro en tienda).">
                    <input
                      type="checkbox"
                      checked={c.envioClasiClick}
                      disabled={guardando === c.id + 'envio'}
                      onChange={(e) => llamar({ accion: 'estado', id: c.id, envioClasiClick: e.target.checked }, c.id + 'envio')}
                      className="accent-teal"
                    />
                    Envío Clasi Click
                  </label>
                  {c.pais !== 'BO' && c.envioClasiClick && <span className="text-[10px] text-maroon">las tarifas de envío todavía son las de Potosí</span>}
                  {c.id === 'potosi' && <span className="text-[11px] text-inksoft">(siempre abierta)</span>}
                  {c.extra && (
                    <button
                      type="button"
                      onClick={() => confirm(`¿Borrar ${c.nombre}? Las tiendas o productos que ya tengan esa ciudad van a aparecer como de Potosí.`) && llamar({ accion: 'borrar', id: c.id }, c.id + 'borrar', 'Ciudad borrada.')}
                      className="ml-auto font-body text-[11px] text-maroon underline"
                    >
                      borrar
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {!nueva && (
          <button type="button" onClick={() => { setNueva({ pais: paises.find((p) => p.id === 'AR') ? 'AR' : paises[0]?.id || 'BO', nombre: '', departamento: '', lugar: '', zonas: '' }); setUbicada(null) }} className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold">
            ➕ Agregar ciudad
          </button>
        )}
        {!paisEditado && (
          <button type="button" onClick={() => setPaisEditado({ datos: { ...PAIS_VACIO }, nuevo: true })} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs font-semibold text-ink">
            ➕ Agregar país
          </button>
        )}
      </div>

      {nueva && (
        <div className="mt-3 rounded-lg border border-teal p-3 grid gap-2">
          <div className="font-body text-xs font-semibold text-ink">➕ Nueva ciudad</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={etiqueta}>País</span>
              <select value={nueva.pais} onChange={(e) => { setNueva({ ...nueva, pais: e.target.value }); setUbicada(null) }} className={input}>
                {paises.map((p) => <option key={p.id} value={p.id}>{p.bandera} {p.nombre}</option>)}
              </select>
            </label>
            <label>
              <span className={etiqueta}>Ciudad</span>
              <input value={nueva.nombre} onChange={(e) => { setNueva({ ...nueva, nombre: e.target.value }); setUbicada(null) }} placeholder="Ej: Buenos Aires" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Provincia / departamento (opcional)</span>
              <input value={nueva.departamento} onChange={(e) => setNueva({ ...nueva, departamento: e.target.value })} placeholder="Ej: CABA" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Lugar central (para el mapa)</span>
              <input value={nueva.lugar} onChange={(e) => { setNueva({ ...nueva, lugar: e.target.value }); setUbicada(null) }} placeholder="Ej: Plaza de Mayo, Buenos Aires" className={input} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={ubicar} disabled={!nueva.nombre.trim() || guardando === 'ubicar'} className="px-3 py-1.5 rounded-md border border-teal bg-tealsoft text-teal font-body text-xs font-semibold disabled:opacity-50">
              {guardando === 'ubicar' ? 'Buscando...' : '📍 Ubicar en el mapa'}
            </button>
            {ubicada && (
              <a href={`https://www.openstreetmap.org/?mlat=${ubicada.lat}&mlon=${ubicada.lng}#map=14/${ubicada.lat}/${ubicada.lng}`} target="_blank" rel="noreferrer" className="font-body text-[11px] text-teal underline">
                ✓ {ubicada.nombre} ({ubicada.lat.toFixed(4)}, {ubicada.lng.toFixed(4)}) — ver en el mapa
              </a>
            )}
          </div>
          <label>
            <span className={etiqueta}>Barrios / zonas (opcional, uno por línea)</span>
            <textarea value={nueva.zonas} onChange={(e) => setNueva({ ...nueva, zonas: e.target.value })} rows={3} placeholder={'Palermo\nRecoleta\nBelgrano'} className={input} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={guardarCiudad} disabled={!ubicada || !nueva.nombre.trim() || guardando === 'agregar'} className="px-3 py-1.5 rounded-md border-none bg-ink text-white font-body text-xs font-semibold disabled:opacity-40">
              {guardando === 'agregar' ? 'Guardando...' : 'Guardar (queda en prueba)'}
            </button>
            <button type="button" onClick={() => { setNueva(null); setUbicada(null) }} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {pe && (
        <div className="mt-3 rounded-lg border border-teal p-3 grid gap-2">
          <div className="font-body text-xs font-semibold text-ink">{paisEditado?.nuevo ? '➕ Nuevo país' : `✏️ ${pe.bandera} ${pe.nombre}`}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {paisEditado?.nuevo && (
              <label>
                <span className={etiqueta}>Código (2 letras)</span>
                <input value={pe.id} onChange={(e) => setPe({ id: e.target.value.toUpperCase().slice(0, 2) })} placeholder="PE" className={input} />
              </label>
            )}
            <label>
              <span className={etiqueta}>Nombre</span>
              <input value={pe.nombre} onChange={(e) => setPe({ nombre: e.target.value })} placeholder="Perú" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Moneda (código)</span>
              <input value={pe.moneda} onChange={(e) => setPe({ moneda: e.target.value.toUpperCase().slice(0, 3) })} placeholder="PEN" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Símbolo</span>
              <input value={pe.simboloMoneda} onChange={(e) => setPe({ simboloMoneda: e.target.value.slice(0, 4) })} placeholder="S/" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Prefijo teléfono</span>
              <input value={pe.prefijoTel} onChange={(e) => setPe({ prefijoTel: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="51" className={input} />
            </label>
            <label>
              <span className={etiqueta}>Dígitos del celular</span>
              <input type="number" value={pe.digitosTel} onChange={(e) => setPe({ digitosTel: Number(e.target.value) })} className={input} />
            </label>
            <label className="col-span-2">
              <span className={etiqueta}>Zona horaria</span>
              <input value={pe.zonaHoraria} onChange={(e) => setPe({ zonaHoraria: e.target.value })} placeholder="America/Lima" className={input} />
            </label>
          </div>
          <div className="font-body text-xs font-semibold text-ink mt-1">Formas de pago</div>
          <label className="flex items-center gap-1.5 font-body text-xs text-ink cursor-pointer">
            <input type="checkbox" checked={pe.pagos.qr} onChange={(e) => setPago({ qr: e.target.checked })} className="accent-teal" />
            QR (en Argentina: el QR de Mercado Pago)
          </label>
          {pe.pagos.qr && pe.id !== 'BO' && (
            <div className="flex items-center gap-3 pl-5">
              {pe.pagos.qrUrl ? <img src={pe.pagos.qrUrl} alt="QR" className="w-20 h-20 object-contain border border-line rounded bg-white" /> : <span className="font-body text-[11px] text-maroon">Falta subir la imagen del QR</span>}
              <label className="px-3 py-1.5 rounded-md border border-teal bg-tealsoft text-teal font-body text-xs font-semibold cursor-pointer">
                {guardando === 'qr' ? 'Subiendo...' : pe.pagos.qrUrl ? 'Cambiar QR' : '👆 Subir QR'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setGuardando('qr')
                    try { setPago({ qrUrl: (await subirFotoAdmin(password, f, false)).url }) } catch (err: any) { setMensaje(err?.message || 'No se pudo subir el QR.') } finally { setGuardando(null) }
                  }}
                />
              </label>
            </div>
          )}
          {pe.id === 'BO' && <div className="pl-5 font-body text-[10px] text-inksoft">En Bolivia se usa el QR de siempre (configuración de pagos).</div>}
          <label className="flex items-center gap-1.5 font-body text-xs text-ink cursor-pointer">
            <input type="checkbox" checked={pe.pagos.transferencia} onChange={(e) => setPago({ transferencia: e.target.checked })} className="accent-teal" />
            Transferencia (alias / CVU / CBU)
          </label>
          {pe.pagos.transferencia && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={etiqueta}>Alias</span>
                <input value={pe.pagos.alias} onChange={(e) => setPago({ alias: e.target.value })} placeholder="clasiclick.mp" className={input} />
              </label>
              <label>
                <span className={etiqueta}>CVU / CBU / cuenta</span>
                <input value={pe.pagos.cuenta} onChange={(e) => setPago({ cuenta: e.target.value })} className={input} />
              </label>
              <label>
                <span className={etiqueta}>Titular</span>
                <input value={pe.pagos.titular} onChange={(e) => setPago({ titular: e.target.value })} className={input} />
              </label>
              <label>
                <span className={etiqueta}>Banco / billetera</span>
                <input value={pe.pagos.banco} onChange={(e) => setPago({ banco: e.target.value })} placeholder="Mercado Pago" className={input} />
              </label>
            </div>
          )}
          <label>
            <span className={etiqueta}>Link de pago (opcional, ej. Mercado Pago)</span>
            <input value={pe.pagos.linkPago} onChange={(e) => setPago({ linkPago: e.target.value })} placeholder="https://link.mercadopago.com.ar/..." className={input} />
          </label>
          <div className="font-body text-[10px] text-inksoft">En el checkout de este país se muestran el QR, los datos de transferencia (con botón para copiar) y el link de pago. Fuera de Bolivia el comprobante no se lee solo: lo revisás vos en Admin → Pedidos.</div>
          <div className="flex gap-2">
            <button type="button" onClick={guardarPais} disabled={guardando === 'pais' || !pe.nombre.trim() || (paisEditado?.nuevo && pe.id.length !== 2)} className="px-3 py-1.5 rounded-md border-none bg-ink text-white font-body text-xs font-semibold disabled:opacity-40">
              {guardando === 'pais' ? 'Guardando...' : 'Guardar país'}
            </button>
            <button type="button" onClick={() => setPaisEditado(null)} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {mensaje && <div className="font-body text-xs text-teal mt-2">{mensaje}</div>}
    </div>
  )
}
