'use client'

import { useEffect, useState } from 'react'
import { TIPOS_CUPON, describirCupon, hoyBolivia, type Cupon, type TipoCupon } from '@/lib/cupones'

// Pestaña "Cupones" de /admin: crear campañas con código (envío gratis,
// % o Bs de descuento), pausarlas, ver cuántas veces se usaron y avisar
// por la campanita 🔔 a todos los usuarios o solo a los que elijas.

type Usuario = { uid: string; email: string | null; nombre: string | null; pausado?: boolean }

const FORM_VACIO = {
  codigo: '',
  campana: '',
  tipo: 'envio_gratis' as TipoCupon,
  valor: '',
  descuentoMaximo: '',
  compraMinima: '',
  desde: '',
  hasta: '',
  limiteUsos: '',
  unaVezPorUsuario: true,
  incluyeExpress: false,
}

function fechaLegible(iso: string) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

function estadoCupon(c: Cupon): { label: string; clase: string } {
  const hoy = hoyBolivia()
  if (!c.activo) return { label: 'Pausado', clase: 'bg-panelalt text-inksoft border-line' }
  if (c.hasta && hoy > c.hasta) return { label: 'Vencido', clase: 'bg-maroonsoft text-maroon border-maroon' }
  if (c.desde && hoy < c.desde) return { label: 'Programado', clase: 'bg-ochresoft text-ochre border-ochre' }
  if (c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos) return { label: 'Agotado', clase: 'bg-maroonsoft text-maroon border-maroon' }
  return { label: 'Activo', clase: 'bg-tealsoft text-teal border-teal' }
}

export default function AdminCupones({ password }: { password: string }) {
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(FORM_VACIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Aviso por campanita
  const [avisandoId, setAvisandoId] = useState<string | null>(null)
  const [destino, setDestino] = useState<'todos' | 'seleccion'>('todos')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultadoAviso, setResultadoAviso] = useState('')

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  function cargar() {
    setCargando(true)
    fetch('/api/admin/cupones', { headers })
      .then((r) => r.json())
      .then((d) => setCupones(d.cupones || []))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function campo<K extends keyof typeof FORM_VACIO>(k: K, v: (typeof FORM_VACIO)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(editandoId ? `/api/admin/cupones/${editandoId}` : '/api/admin/cupones', {
        method: editandoId ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setForm(FORM_VACIO)
      setEditandoId(null)
      cargar()
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el cupón.')
    } finally {
      setGuardando(false)
    }
  }

  function editar(c: Cupon) {
    setEditandoId(c.id)
    setError('')
    setForm({
      codigo: c.codigo,
      campana: c.campana || '',
      tipo: c.tipo,
      valor: c.valor ? String(c.valor) : '',
      descuentoMaximo: c.descuentoMaximo ? String(c.descuentoMaximo) : '',
      compraMinima: c.compraMinima ? String(c.compraMinima) : '',
      desde: c.desde || '',
      hasta: c.hasta || '',
      limiteUsos: c.limiteUsos ? String(c.limiteUsos) : '',
      unaVezPorUsuario: !!c.unaVezPorUsuario,
      incluyeExpress: !!c.incluyeExpress,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cambiarActivo(c: Cupon) {
    await fetch(`/api/admin/cupones/${c.id}`, { method: 'PATCH', headers, body: JSON.stringify({ activo: !c.activo }) })
    cargar()
  }

  async function borrar(c: Cupon) {
    if (!confirm(`¿Borrar el cupón ${c.codigo}? Los pedidos que ya lo usaron no cambian.`)) return
    await fetch(`/api/admin/cupones/${c.id}`, { method: 'DELETE', headers })
    cargar()
  }

  function abrirAviso(c: Cupon) {
    setAvisandoId(c.id)
    setDestino('todos')
    setSeleccion(new Set())
    setBusquedaUsuario('')
    setResultadoAviso('')
    const hasta = c.hasta ? ` Válido hasta el ${fechaLegible(c.hasta)}.` : ''
    setMensaje(`🎁 ${c.campana ? `${c.campana}: ` : ''}${describirCupon(c)} con el cupón ${c.codigo}.${hasta} Usalo al finalizar tu compra.`)
    if (usuarios.length === 0) {
      fetch('/api/admin/usuarios', { headers })
        .then((r) => r.json())
        .then((d) => setUsuarios((d.usuarios || []).filter((u: Usuario) => !u.pausado)))
    }
  }

  async function enviarAviso() {
    if (!avisandoId) return
    if (destino === 'seleccion' && seleccion.size === 0) {
      setResultadoAviso('Elegí al menos un usuario.')
      return
    }
    if (destino === 'todos' && !confirm('¿Mandar el aviso a TODOS los usuarios registrados?')) return
    setEnviando(true)
    setResultadoAviso('')
    try {
      const res = await fetch(`/api/admin/cupones/${avisandoId}/notificar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ destino, uids: Array.from(seleccion), mensaje }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResultadoAviso(`✓ Aviso enviado a ${data.enviados} usuario${data.enviados === 1 ? '' : 's'}.`)
      cargar()
    } catch (err: any) {
      setResultadoAviso(err?.message || 'No se pudo enviar el aviso.')
    } finally {
      setEnviando(false)
    }
  }

  const q = busquedaUsuario.trim().toLowerCase()
  const usuariosFiltrados = usuarios.filter(
    (u) => !q || (u.email || '').toLowerCase().includes(q) || (u.nombre || '').toLowerCase().includes(q)
  )
  const input = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'
  const etiqueta = 'block font-body text-[11px] font-semibold text-inksoft mb-1'

  return (
    <div>
      {/* --- Formulario --- */}
      <form onSubmit={guardar} className="bg-panel border border-line rounded-xl p-4 mb-6">
        <div className="font-body text-sm font-semibold text-ink mb-3">{editandoId ? `Editar cupón ${form.codigo}` : 'Nuevo cupón'}</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label>
            <span className={etiqueta}>Código (lo que escribe el cliente)</span>
            <input
              value={form.codigo}
              onChange={(e) => campo('codigo', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="ENVIOGRATIS"
              className={`${input} uppercase`}
              required
            />
          </label>
          <label>
            <span className={etiqueta}>Campaña (opcional)</span>
            <input value={form.campana} onChange={(e) => campo('campana', e.target.value)} placeholder="Fiestas de agosto" className={input} />
          </label>
        </div>

        <div className="flex gap-1 p-1 mb-3 bg-panelalt rounded-full">
          {TIPOS_CUPON.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => campo('tipo', t.id)}
              className={`flex-1 py-2 rounded-full font-body text-xs font-semibold ${form.tipo === t.id ? 'bg-maroon text-white' : 'text-inksoft'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {form.tipo !== 'envio_gratis' && (
            <label>
              <span className={etiqueta}>{form.tipo === 'porcentaje' ? 'Descuento %' : 'Descuento Bs'}</span>
              <input type="number" min="1" max={form.tipo === 'porcentaje' ? 100 : undefined} value={form.valor} onChange={(e) => campo('valor', e.target.value)} className={input} required />
            </label>
          )}
          {form.tipo === 'porcentaje' && (
            <label>
              <span className={etiqueta}>Tope Bs (opcional)</span>
              <input type="number" min="0" value={form.descuentoMaximo} onChange={(e) => campo('descuentoMaximo', e.target.value)} className={input} />
            </label>
          )}
          <label>
            <span className={etiqueta}>Compra mínima Bs</span>
            <input type="number" min="0" value={form.compraMinima} onChange={(e) => campo('compraMinima', e.target.value)} placeholder="Sin mínimo" className={input} />
          </label>
          <label>
            <span className={etiqueta}>Límite de usos</span>
            <input type="number" min="0" value={form.limiteUsos} onChange={(e) => campo('limiteUsos', e.target.value)} placeholder="Sin límite" className={input} />
          </label>
          <label>
            <span className={etiqueta}>Desde</span>
            <input type="date" value={form.desde} onChange={(e) => campo('desde', e.target.value)} className={input} />
          </label>
          <label>
            <span className={etiqueta}>Hasta</span>
            <input type="date" value={form.hasta} onChange={(e) => campo('hasta', e.target.value)} className={input} />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <label className="flex items-center gap-2 font-body text-xs text-ink cursor-pointer">
            <input type="checkbox" checked={form.unaVezPorUsuario} onChange={(e) => campo('unaVezPorUsuario', e.target.checked)} className="accent-teal" />
            Una sola vez por cliente
          </label>
          {form.tipo === 'envio_gratis' && (
            <label className="flex items-center gap-2 font-body text-xs text-ink cursor-pointer">
              <input type="checkbox" checked={form.incluyeExpress} onChange={(e) => campo('incluyeExpress', e.target.checked)} className="accent-teal" />
              También cubre el extra del envío express (si no, el cliente paga solo el extra)
            </label>
          )}
        </div>

        <div className="font-body text-[11px] text-inksoft mb-3">
          El descuento lo absorbe Clasi Click: al vendedor se le liquida igual que siempre. Cada pedido queda marcado con el cupón que usó.
        </div>

        {error && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-3">{error}</div>}

        <div className="flex gap-2">
          <button type="submit" disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60">
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear cupón'}
          </button>
          {editandoId && (
            <button type="button" onClick={() => { setEditandoId(null); setForm(FORM_VACIO); setError('') }} className="px-4 py-2 rounded-lg border border-line font-body text-sm text-inksoft">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* --- Lista --- */}
      <div className="font-body text-sm font-semibold text-ink mb-3">Cupones ({cupones.length})</div>
      {cargando && <div className="font-body text-sm text-inksoft">Cargando...</div>}
      {!cargando && cupones.length === 0 && (
        <div className="bg-panel border border-line rounded-xl p-5 text-center font-body text-sm text-inksoft">Todavía no creaste ningún cupón.</div>
      )}

      {cupones.map((c) => {
        const estado = estadoCupon(c)
        const vigencia = [c.desde && `desde ${fechaLegible(c.desde)}`, c.hasta && `hasta ${fechaLegible(c.hasta)}`].filter(Boolean).join(' ')
        return (
          <div key={c.id} className="bg-panel border border-line rounded-lg p-4 mb-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-display text-base font-bold text-ink tracking-wide">🎟️ {c.codigo}</span>
              <span className={`border rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${estado.clase}`}>{estado.label}</span>
              {c.campana && <span className="font-body text-xs text-inksoft">· {c.campana}</span>}
            </div>
            <div className="font-body text-xs text-ink">
              {describirCupon(c)}
              {c.tipo === 'envio_gratis' && c.incluyeExpress && ' (incluye express)'}
            </div>
            <div className="font-body text-[11px] text-inksoft mt-0.5">
              Usado {c.usosCount || 0}{c.limiteUsos > 0 ? ` de ${c.limiteUsos}` : ''} {c.usosCount === 1 ? 'vez' : 'veces'}
              {vigencia && ` · ${vigencia}`}
              {c.unaVezPorUsuario && ' · 1 por cliente'}
              {(c as any).ultimoAviso && ` · Último aviso: ${(c as any).ultimoAviso.cantidad} usuarios`}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={() => abrirAviso(c)} className="px-3 py-1.5 rounded-md border border-indigo-200 font-body text-xs text-indigo-600">
                🔔 Avisar a usuarios
              </button>
              <button type="button" onClick={() => editar(c)} className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-teal">Editar</button>
              <button type="button" onClick={() => cambiarActivo(c)} className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">
                {c.activo ? 'Pausar' : 'Reactivar'}
              </button>
              <button type="button" onClick={() => borrar(c)} className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-maroon">Borrar</button>
            </div>

            {avisandoId === c.id && (
              <div className="mt-3 border border-indigo-200 bg-indigo-50/50 rounded-lg p-3">
                <div className="font-body text-xs font-semibold text-ink mb-2">Avisar por la campanita 🔔</div>
                <label className="block mb-2">
                  <span className={etiqueta}>Mensaje</span>
                  <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} maxLength={300} className={`${input} text-xs`} />
                </label>

                <div className="flex gap-1 p-1 mb-2 bg-panel rounded-full border border-line">
                  <button type="button" onClick={() => setDestino('todos')} className={`flex-1 py-1.5 rounded-full font-body text-xs font-semibold ${destino === 'todos' ? 'bg-indigo-600 text-white' : 'text-inksoft'}`}>
                    Todos los usuarios
                  </button>
                  <button type="button" onClick={() => setDestino('seleccion')} className={`flex-1 py-1.5 rounded-full font-body text-xs font-semibold ${destino === 'seleccion' ? 'bg-indigo-600 text-white' : 'text-inksoft'}`}>
                    Elegir usuarios{seleccion.size > 0 ? ` (${seleccion.size})` : ''}
                  </button>
                </div>

                {destino === 'seleccion' && (
                  <div className="mb-2">
                    <div className="flex gap-2 mb-1.5">
                      <input value={busquedaUsuario} onChange={(e) => setBusquedaUsuario(e.target.value)} placeholder="Buscar por email o nombre..." className={`${input} text-xs`} />
                      <button
                        type="button"
                        onClick={() => setSeleccion((prev) => {
                          const todosMarcados = usuariosFiltrados.length > 0 && usuariosFiltrados.every((u) => prev.has(u.uid))
                          const nuevo = new Set(prev)
                          usuariosFiltrados.forEach((u) => (todosMarcados ? nuevo.delete(u.uid) : nuevo.add(u.uid)))
                          return nuevo
                        })}
                        className="shrink-0 px-2.5 rounded-lg border border-line bg-panel font-body text-[11px] text-inksoft"
                      >
                        {usuariosFiltrados.length > 0 && usuariosFiltrados.every((u) => seleccion.has(u.uid)) ? 'Desmarcar' : 'Marcar'} {q ? 'resultados' : 'todos'}
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto bg-panel border border-line rounded-lg">
                      {usuarios.length === 0 && <div className="font-body text-xs text-inksoft p-2.5">Cargando usuarios...</div>}
                      {usuariosFiltrados.map((u) => (
                        <label key={u.uid} className="flex items-center gap-2 px-2.5 py-1.5 border-b border-line last:border-b-0 font-body text-xs text-ink cursor-pointer hover:bg-panelalt">
                          <input
                            type="checkbox"
                            checked={seleccion.has(u.uid)}
                            onChange={(e) => setSeleccion((prev) => {
                              const nuevo = new Set(prev)
                              if (e.target.checked) nuevo.add(u.uid)
                              else nuevo.delete(u.uid)
                              return nuevo
                            })}
                            className="accent-indigo-600"
                          />
                          <span className="truncate">{u.email || u.uid}</span>
                          {u.nombre && <span className="text-inksoft truncate">· {u.nombre}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={enviarAviso} disabled={enviando} className="px-3.5 py-1.5 rounded-md border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-60">
                    {enviando ? 'Enviando...' : destino === 'todos' ? 'Enviar a todos' : `Enviar a ${seleccion.size} usuario${seleccion.size === 1 ? '' : 's'}`}
                  </button>
                  <button type="button" onClick={() => setAvisandoId(null)} className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">Cerrar</button>
                  {resultadoAviso && <span className="font-body text-xs text-ink">{resultadoAviso}</span>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
