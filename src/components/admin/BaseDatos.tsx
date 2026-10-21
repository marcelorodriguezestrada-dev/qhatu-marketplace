'use client'

import { useEffect, useState } from 'react'

// Admin → Configuración → "🗄️ Base de datos": explorar, buscar, editar y
// borrar documentos de Firestore (ver /api/admin/base). Lo borrado pasa a la
// papelera y se puede restaurar. Solo con la contraseña principal.

type Doc = { id: string; datos: Record<string, any> }
type Filtro = { campo: string; op: string; valor: string }

const PAPELERA = 'papeleraAdmin'

// Qué es cada colección (las que no están se muestran con su nombre).
const QUE_ES: Record<string, string> = {
  pedidos: '🧾 Pedidos y ventas',
  productos: '📦 Productos',
  vendedores: '🏪 Tiendas',
  usuarios: '👤 Usuarios',
  anuncios: '📢 Anuncios',
  profesionales: '🧑‍🔧 Servicios profesionales',
  cupones: '🎟️ Cupones',
  notificaciones: '🔔 Notificaciones',
  campanas: '📣 Campañas',
  publicacionesMarketing: '📅 Publicaciones de marketing',
  prospectos: '🎯 Prospectos',
  whatsappSesiones: '💬 Bot WhatsApp: conversaciones',
  whatsappMensajes: '💬 Bot WhatsApp: mensajes recibidos',
  consumoFirestore: '🔋 Consumo de la base',
  config: '⚙️ Configuración',
  configuracion: '⚙️ Configuración de pagos',
  estadisticasUsuarios: '📈 Estadísticas por tienda',
  comprasFueraHorario: '🌙 Compras fuera de horario',
  [PAPELERA]: '🗑️ Papelera',
}

// Atajos para depurar.
const ATAJOS: Record<string, { label: string; filtro: Filtro }[]> = {
  pedidos: [
    { label: 'De prueba', filtro: { campo: 'esPrueba', op: '==', valor: 'true' } },
    { label: 'Cancelados', filtro: { campo: 'estado', op: '==', valor: 'cancelado' } },
    { label: 'Rechazados', filtro: { campo: 'estado', op: '==', valor: 'rechazado' } },
    { label: 'Esperando pago', filtro: { campo: 'estado', op: '==', valor: 'pendiente_pago' } },
    { label: 'Antes de… (fecha)', filtro: { campo: 'createdAt', op: '<', valor: new Date().toISOString().slice(0, 10) } },
  ],
  productos: [
    { label: 'Pendientes', filtro: { campo: 'estado', op: '==', valor: 'pendiente' } },
    { label: 'Rechazados', filtro: { campo: 'estado', op: '==', valor: 'rechazado' } },
    { label: 'Ocultos', filtro: { campo: 'estado', op: '==', valor: 'oculto' } },
    { label: 'De prueba', filtro: { campo: 'esPrueba', op: '==', valor: 'true' } },
  ],
  whatsappMensajes: [{ label: 'Antes de… (fecha)', filtro: { campo: 'at', op: '<', valor: new Date().toISOString().slice(0, 10) } }],
  notificaciones: [{ label: 'Leídas', filtro: { campo: 'leida', op: '==', valor: 'true' } }],
}

// Una línea que resume el documento (nombre, estado, total, fecha…).
function resumen(d: Record<string, any>) {
  const partes = [
    d.nombre || d.nombreNegocio || d.titulo || d.nombreComprador || d.email || d.codigo || d.coleccion,
    d.estado,
    typeof d.total === 'number' ? `total ${d.total.toLocaleString('es-BO')}` : typeof d.precio === 'number' ? `precio ${d.precio.toLocaleString('es-BO')}` : '',
    d.vendedorNombre || d.tiendaNombre,
    d.esPrueba ? 'PRUEBA' : '',
    String(d.createdAt || d.borradoAt || d.updatedAt || d.at || '').slice(0, 10),
  ].filter(Boolean)
  return partes.join(' · ') || Object.keys(d).slice(0, 5).join(', ')
}

export default function BaseDatos({ password }: { password: string }) {
  const [colecciones, setColecciones] = useState<{ id: string; total: number | null }[] | null>(null)
  const [col, setCol] = useState('')
  const [filtro, setFiltro] = useState<Filtro>({ campo: '', op: '==', valor: '' })
  const [aplicado, setAplicado] = useState<Filtro | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [siguiente, setSiguiente] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<{ id: string; texto: string; nuevo?: boolean } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const h = { 'x-admin-password': password }
  const post = (body: any) => fetch('/api/admin/base', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

  const cargarColecciones = () =>
    fetch('/api/admin/base?accion=colecciones', { headers: h })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setColecciones(d.colecciones)))
      .catch(() => setError('No se pudo leer la base.'))

  useEffect(() => {
    if (password) cargarColecciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  async function cargar(c = col, f = aplicado, despues: string | null = null) {
    if (!c) return
    setCargando(true)
    setError('')
    const qs = new URLSearchParams({ coleccion: c, ...(f?.campo ? { campo: f.campo, op: f.op, valor: f.valor } : {}), ...(despues ? { despues } : {}) })
    try {
      const d = await fetch(`/api/admin/base?${qs}`, { headers: h }).then((r) => r.json())
      if (d.error) return setError(d.error)
      setDocs((prev) => (despues ? [...prev, ...d.docs] : d.docs))
      setSiguiente(d.siguiente)
      if (!despues) {
        setTotal(d.total)
        setElegidos(new Set())
      }
    } finally {
      setCargando(false)
    }
  }

  function abrir(c: string) {
    setCol(c)
    setAplicado(null)
    setFiltro({ campo: '', op: '==', valor: '' })
    setDocs([])
    setAviso('')
    cargar(c, null)
  }

  function filtrar(f: Filtro | null) {
    setAplicado(f)
    if (f) setFiltro(f)
    cargar(col, f)
  }

  const alternar = (id: string) => setElegidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function borrarElegidos() {
    const ids = Array.from(elegidos)
    if (!ids.length || !confirm(`¿Eliminar ${ids.length} documento(s) de "${col}"?\n\nVan a la papelera: los podés restaurar desde 🗑️ Papelera.`)) return
    setCargando(true)
    const d = await post({ accion: 'borrar', coleccion: col, ids }).finally(() => setCargando(false))
    if (d.error) return setError(d.error)
    setAviso(`🗑️ ${d.borrados} a la papelera.`)
    cargar()
    cargarColecciones()
  }

  async function borrarTodosDelFiltro() {
    const cuantos = total ?? docs.length
    const que = aplicado?.campo ? `que cumplen "${aplicado.campo} ${aplicado.op} ${aplicado.valor}"` : 'de TODA la colección'
    const escrito = prompt(`Vas a eliminar ${cuantos} documento(s) de "${col}" ${que}.\nVan a la papelera (se pueden restaurar).\n\nEscribí ELIMINAR para confirmar:`)
    if (escrito?.trim().toUpperCase() !== 'ELIMINAR') return
    setCargando(true)
    let n = 0
    try {
      for (let vuelta = 0; vuelta < 100; vuelta++) {
        const d = await post({ accion: 'borrarFiltro', coleccion: col, filtro: aplicado })
        if (d.error) { setError(d.error); break }
        n += d.borrados
        setAviso(`🗑️ Eliminando… ${n}`)
        if (!d.quedan) break
      }
    } finally {
      setCargando(false)
    }
    setAviso(`🗑️ ${n} a la papelera.`)
    cargar()
    cargarColecciones()
  }

  async function guardar() {
    if (!editando) return
    let datos: any
    try {
      datos = JSON.parse(editando.texto)
    } catch (e: any) {
      return setError(`El JSON tiene un error: ${e.message}`)
    }
    if (!editando.id.trim()) return setError('Poné un id para el documento.')
    setCargando(true)
    const d = await post({ accion: 'guardar', coleccion: col, id: editando.id.trim(), datos }).finally(() => setCargando(false))
    if (d.error) return setError(d.error)
    setEditando(null)
    setAviso('✅ Guardado (la versión anterior quedó en la papelera).')
    cargar()
  }

  async function restaurar(ids: string[]) {
    setCargando(true)
    const d = await post({ accion: 'restaurar', ids }).finally(() => setCargando(false))
    if (d.error) return setError(d.error)
    setAviso(`↩️ ${d.restaurados} restaurado(s).`)
    cargar()
    cargarColecciones()
  }

  async function vaciar(ids?: string[]) {
    const escrito = prompt(ids ? `¿Borrar PARA SIEMPRE ${ids.length} de la papelera? Escribí BORRAR:` : 'Vas a vaciar TODA la papelera: lo que hay ahí se borra PARA SIEMPRE.\n\nEscribí BORRAR para confirmar:')
    if (escrito?.trim().toUpperCase() !== 'BORRAR') return
    setCargando(true)
    let n = 0
    try {
      for (let vuelta = 0; vuelta < 100; vuelta++) {
        const d = await post({ accion: 'vaciarPapelera', ...(ids ? { ids } : {}) })
        if (d.error) { setError(d.error); break }
        n += d.borrados
        if (!d.quedan) break
      }
    } finally {
      setCargando(false)
    }
    setAviso(`Borrados para siempre: ${n}.`)
    cargar()
    cargarColecciones()
  }

  const enPapelera = col === PAPELERA
  const atajos = ATAJOS[col] || []

  return (
    <div className="bg-panel border border-line rounded-xl p-5 mb-5">
      <div className="font-display text-lg font-bold text-ink">🗄️ Base de datos</div>
      <div className="font-body text-xs text-inksoft mb-4">
        Ver, buscar, editar y eliminar cualquier dato. Lo que elimines va a la <b>papelera</b> y lo podés restaurar; recién al vaciarla se borra para siempre. Solo con la contraseña principal.
      </div>

      {error && <div className="font-body text-sm text-maroon bg-panelalt border border-line rounded-lg p-3 mb-3">{error}</div>}
      {aviso && <div className="font-body text-sm text-teal bg-tealsoft border border-teal/30 rounded-lg p-3 mb-3">{aviso}</div>}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {!colecciones && !error && <span className="font-body text-sm text-inksoft">Cargando colecciones…</span>}
        {colecciones?.map((c) => (
          <button
            key={c.id}
            onClick={() => abrir(c.id)}
            className={`font-body text-xs px-2.5 py-1.5 rounded-lg border ${col === c.id ? 'border-ink bg-ink text-white' : 'border-line bg-panelalt text-ink'}`}
            title={c.id}
          >
            {QUE_ES[c.id] || c.id} <span className={col === c.id ? 'text-white/70' : 'text-inksoft'}>({c.total ?? '?'})</span>
          </button>
        ))}
      </div>

      {col && (
        <>
          {!enPapelera && (
            <div className="bg-panelalt border border-line rounded-lg p-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-body text-xs text-inksoft">Filtrar:</span>
                <input value={filtro.campo} onChange={(e) => setFiltro({ ...filtro, campo: e.target.value })} placeholder="campo (ej. estado)" className="font-body text-xs border border-line rounded-md px-2 py-1.5 w-36 bg-panel" />
                <select value={filtro.op} onChange={(e) => setFiltro({ ...filtro, op: e.target.value })} className="font-body text-xs border border-line rounded-md px-2 py-1.5 bg-panel">
                  {['==', '!=', '<', '<=', '>', '>=', 'array-contains'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input value={filtro.valor} onChange={(e) => setFiltro({ ...filtro, valor: e.target.value })} placeholder="valor (ej. cancelado)" className="font-body text-xs border border-line rounded-md px-2 py-1.5 w-40 bg-panel" onKeyDown={(e) => e.key === 'Enter' && filtrar(filtro.campo ? filtro : null)} />
                <button onClick={() => filtrar(filtro.campo ? filtro : null)} className="font-body text-xs px-3 py-1.5 rounded-md bg-ink text-white border-none">Buscar</button>
                {aplicado && <button onClick={() => { setFiltro({ campo: '', op: '==', valor: '' }); filtrar(null) }} className="font-body text-xs underline text-inksoft">quitar filtro</button>}
              </div>
              {atajos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="font-body text-[11px] text-inksoft self-center">Atajos:</span>
                  {atajos.map((a) => (
                    <button key={a.label} onClick={() => filtrar(a.filtro)} className="font-body text-[11px] px-2 py-1 rounded-md border border-line bg-panel text-ink">{a.label}</button>
                  ))}
                </div>
              )}
              <div className="font-body text-[10px] text-inksoft mt-1.5">Números, true/false y null se buscan como tales; fechas como texto (ej. createdAt &lt; 2026-10-01).</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-body text-sm text-ink font-semibold">{total ?? docs.length} documento(s){aplicado?.campo ? ' con el filtro' : ''}</span>
            <span className="flex-1" />
            {enPapelera ? (
              <>
                <button disabled={!elegidos.size || cargando} onClick={() => restaurar(Array.from(elegidos))} className="font-body text-xs px-3 py-1.5 rounded-md border border-teal text-teal bg-tealsoft disabled:opacity-40">↩️ Restaurar ({elegidos.size})</button>
                <button disabled={!elegidos.size || cargando} onClick={() => vaciar(Array.from(elegidos))} className="font-body text-xs px-3 py-1.5 rounded-md border border-maroon text-maroon bg-panel disabled:opacity-40">Borrar para siempre ({elegidos.size})</button>
                <button disabled={!docs.length || cargando} onClick={() => vaciar()} className="font-body text-xs px-3 py-1.5 rounded-md bg-maroon text-white border-none disabled:opacity-40">Vaciar papelera</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditando({ id: '', texto: '{\n  \n}', nuevo: true })} className="font-body text-xs px-3 py-1.5 rounded-md border border-line bg-panel text-ink">＋ Nuevo</button>
                <button disabled={!elegidos.size || cargando} onClick={borrarElegidos} className="font-body text-xs px-3 py-1.5 rounded-md border border-maroon text-maroon bg-panel disabled:opacity-40">🗑️ Eliminar elegidos ({elegidos.size})</button>
                <button disabled={!docs.length || cargando} onClick={borrarTodosDelFiltro} className="font-body text-xs px-3 py-1.5 rounded-md bg-maroon text-white border-none disabled:opacity-40">
                  🗑️ Eliminar {aplicado?.campo ? 'todos los del filtro' : 'toda la colección'}
                </button>
              </>
            )}
          </div>

          <div className="border border-line rounded-lg overflow-hidden">
            {docs.length > 0 && (
              <label className="flex items-center gap-2 px-3 py-2 bg-panelalt border-b border-line font-body text-xs text-inksoft">
                <input type="checkbox" checked={docs.every((d) => elegidos.has(d.id))} onChange={(e) => setElegidos(e.target.checked ? new Set(docs.map((d) => d.id)) : new Set())} />
                Elegir los {docs.length} de esta página
              </label>
            )}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0">
                <input type="checkbox" checked={elegidos.has(d.id)} onChange={() => alternar(d.id)} aria-label={`Elegir ${d.id}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-body text-sm text-ink truncate">{enPapelera ? `${QUE_ES[d.datos.coleccion] || d.datos.coleccion} → ${resumen(d.datos.datos || {})}` : resumen(d.datos)}</div>
                  <div className="font-body text-[10px] text-inksoft truncate">{enPapelera ? `${d.datos.docId} · borrado ${String(d.datos.borradoAt || '').slice(0, 16).replace('T', ' ')}${d.datos.motivo ? ` · ${d.datos.motivo}` : ''}` : d.id}</div>
                </div>
                <button onClick={() => setEditando({ id: d.id, texto: JSON.stringify(enPapelera ? d.datos.datos : d.datos, null, 2) })} className="font-body text-xs px-2.5 py-1 rounded-md border border-line bg-panel text-ink shrink-0">
                  {enPapelera ? 'Ver' : 'Ver / editar'}
                </button>
              </div>
            ))}
            {!docs.length && !cargando && <div className="font-body text-sm text-inksoft p-4 text-center">Nada para mostrar.</div>}
            {cargando && <div className="font-body text-sm text-inksoft p-3 text-center">Cargando…</div>}
          </div>
          {siguiente && !cargando && (
            <button onClick={() => cargar(col, aplicado, siguiente)} className="font-body text-xs px-3 py-1.5 rounded-md border border-line bg-panelalt text-ink mt-2">Cargar más</button>
          )}
        </>
      )}

      {editando && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <div className="bg-panel rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col p-4" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-base font-bold text-ink mb-2">
              {enPapelera ? 'En la papelera' : editando.nuevo ? `Nuevo documento en ${col}` : `Editar ${col}`}
            </div>
            {editando.nuevo ? (
              <input value={editando.id} onChange={(e) => setEditando({ ...editando, id: e.target.value })} placeholder="id del documento" className="font-body text-xs border border-line rounded-md px-2 py-1.5 mb-2" />
            ) : (
              <div className="font-body text-[11px] text-inksoft mb-2 break-all">id: {editando.id}</div>
            )}
            <textarea
              value={editando.texto}
              onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
              readOnly={enPapelera}
              spellCheck={false}
              className="flex-1 min-h-[320px] font-mono text-xs border border-line rounded-md p-2 bg-panelalt text-ink"
            />
            {!enPapelera && <div className="font-body text-[10px] text-inksoft mt-1">Se guarda el documento entero tal como está acá. La versión anterior queda en la papelera.</div>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditando(null)} className="font-body text-xs px-3 py-1.5 rounded-md border border-line bg-panel text-ink">Cerrar</button>
              {!enPapelera && <button disabled={cargando} onClick={guardar} className="font-body text-xs px-3 py-1.5 rounded-md bg-ink text-white border-none">Guardar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
