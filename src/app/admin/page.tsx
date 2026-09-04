'use client'

import { useEffect, useState } from 'react'
import { ServiceIcon, RUBROS } from '@/components/ServiceIcon'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

const ESTADOS_LABEL: Record<string, { texto: string; color: string }> = {
  pendiente_pago: { texto: 'Esperando que pague', color: 'text-inksoft' },
  informado_pago: { texto: 'Dice que ya pagó — revisar', color: 'text-ochre' },
  pagado: { texto: 'Pagado', color: 'text-teal' },
}

const ICONOS_SERVICIO = ['contador', 'odontologo', 'pintor', 'plomero', 'electricista', 'profesor', 'otro']

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [tab, setTab] = useState<'pedidos' | 'servicios'>('pedidos')

  const [pedidos, setPedidos] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])

  // Formulario de alta de profesional
  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState(RUBROS[0].id)
  const [descripcion, setDescripcion] = useState('')
  const [zona, setZona] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [icono, setIcono] = useState(ICONOS_SERVICIO[0])
  const [plan, setPlan] = useState<'basico' | 'premium'>('basico')
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? localStorage.getItem('qhatu_admin_pw') : null
    if (guardada) {
      setPassword(guardada)
      entrar(guardada)
    }
  }, [])

  function entrar(pw: string) {
    setCargando(true)
    fetch('/api/pedidos', { headers: { 'x-admin-password': pw } })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Contraseña incorrecta.')
        return r.json()
      })
      .then((data) => {
        setPedidos(data.pedidos || [])
        setAutenticado(true)
        setError('')
        localStorage.setItem('qhatu_admin_pw', pw)
        cargarProfesionales()
      })
      .catch((e) => {
        setError(e.message)
        setAutenticado(false)
      })
      .finally(() => setCargando(false))
  }

  function cargarProfesionales() {
    fetch('/api/profesionales')
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
  }

  function confirmarPago(id: string) {
    fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado: 'pagado' }),
    }).then(() => entrar(password))
  }

  async function publicarProfesional(e: React.FormEvent) {
    e.preventDefault()
    setErrorForm('')
    if (!nombre.trim() || !whatsapp.trim()) {
      setErrorForm('Completá al menos el nombre y el WhatsApp.')
      return
    }
    setPublicando(true)
    try {
      const res = await fetch('/api/profesionales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          nombre, rubro, descripcion, zona,
          lat: lat || null, lng: lng || null,
          whatsapp, icono, plan,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorForm(data.error)
        return
      }
      setNombre(''); setDescripcion(''); setZona(''); setLat(''); setLng(''); setWhatsapp('')
      cargarProfesionales()
    } finally {
      setPublicando(false)
    }
  }

  function borrarProfesional(id: string) {
    fetch(`/api/profesionales/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    }).then(() => cargarProfesionales())
  }

  if (!autenticado) {
    return (
      <div className="max-w-[360px] mx-auto px-5 py-20">
        <div className="font-display text-xl font-bold text-ink mb-4">Panel de administración</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          onKeyDown={(e) => e.key === 'Enter' && entrar(password)}
        />
        <button
          onClick={() => entrar(password)}
          disabled={cargando}
          className="w-full py-2.5 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <div className="font-body text-xs text-maroon mt-3">{error}</div>}
      </div>
    )
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="flex gap-2 mb-6 border-b border-line">
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'pedidos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setTab('servicios')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'servicios' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Servicios profesionales
        </button>
      </div>

      {tab === 'pedidos' && (
        <div>
          {pedidos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay pedidos.</div>}
          {pedidos.map((p) => {
            const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
            return (
              <div key={p.id} className="bg-panel border border-line rounded-lg p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
                  <div className="font-body text-xs text-inksoft">{p.items?.length || 0} producto(s) · {bs(p.total)}</div>
                  <div className={`font-body text-xs font-semibold ${estado.color}`}>{estado.texto}</div>
                </div>
                {p.estado !== 'pagado' && (
                  <button
                    onClick={() => confirmarPago(p.id)}
                    className="px-3.5 py-2 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
                  >
                    Confirmar pago
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'servicios' && (
        <div>
          <form onSubmit={publicarProfesional} className="bg-panel border border-line rounded-xl p-5 mb-8">
            <div className="font-body text-sm font-semibold text-ink mb-3">Nuevo profesional</div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre o nombre del negocio"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
              >
                {RUBROS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as 'basico' | 'premium')}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
              >
                <option value="basico">Plan básico</option>
                <option value="premium">Plan premium (destacado)</option>
              </select>
            </div>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <input
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="Zona / barrio (ej: Sopocachi, La Paz)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitud (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Longitud (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
            </div>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="WhatsApp con código de país (ej: 59171234567)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="flex gap-2 mb-4 flex-wrap">
              {ICONOS_SERVICIO.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcono(i)}
                  className={`w-11 h-11 rounded-lg border flex items-center justify-center ${
                    icono === i ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'
                  }`}
                >
                  <ServiceIcon kind={i} size={20} />
                </button>
              ))}
            </div>
            {errorForm && <div className="font-body text-xs text-maroon mb-3">{errorForm}</div>}
            <button
              type="submit"
              disabled={publicando}
              className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
            >
              {publicando ? 'Publicando...' : 'Publicar profesional'}
            </button>
          </form>

          <div className="font-body text-sm font-semibold text-ink mb-3">
            Publicados ({profesionales.length})
          </div>
          {profesionales.map((p) => (
            <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0">
                <ServiceIcon kind={p.icono} size={20} />
              </div>
              <div className="flex-1">
                <div className="font-body text-sm font-medium text-ink">{p.nombre}</div>
                <div className="font-body text-xs text-inksoft">
                  {RUBROS.find((r) => r.id === p.rubro)?.label} · {p.zona} · {p.plan === 'premium' ? 'Premium' : 'Básico'}
                </div>
              </div>
              <button
                onClick={() => borrarProfesional(p.id)}
                className="font-body text-xs text-maroon underline shrink-0"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
