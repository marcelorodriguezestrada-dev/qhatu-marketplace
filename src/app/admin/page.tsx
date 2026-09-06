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
  en_preparacion: { texto: 'En preparación', color: 'text-indigo-600' },
  en_entrega: { texto: 'En entrega', color: 'text-amber-600' },
  entregado: { texto: 'Entregado', color: 'text-emerald-600' },
  cancelado: { texto: 'Cancelado', color: 'text-red-600' },
}

const ICONOS_SERVICIO = ['abogado', 'contador', 'electricista', 'enfermera', 'estilista', 'manicurista', 'medico', 'odontologo', 'oftalmologo', 'pintor', 'plomero', 'profesor', 'otro']

function BadgeRiesgoIA({ moderacionIA }: { moderacionIA: { riesgo: string; motivo: string } | null | undefined }) {
  if (!moderacionIA) return null
  const estilos: Record<string, string> = {
    alto: 'bg-maroonsoft text-maroon border-maroon',
    medio: 'bg-ochresoft text-ochre border-ochre',
    bajo: 'bg-tealsoft text-teal border-teal',
  }
  const clase = estilos[moderacionIA.riesgo] || 'bg-panelalt text-inksoft border-line'
  return (
    <div className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold font-body mt-1 ${clase}`} title={moderacionIA.motivo}>
      IA: riesgo {moderacionIA.riesgo}
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [tab, setTab] = useState<'pedidos' | 'productos' | 'servicios' | 'metricas'>('pedidos')

  const [pedidos, setPedidos] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [metricas, setMetricas] = useState<any>(null)
  const [cargandoMetricas, setCargandoMetricas] = useState(false)

  const resumen = {
    pedidosTotal: pedidos.length,
    pedidosPagados: pedidos.filter((p) => p.estado === 'pagado' || p.estado === 'en_preparacion' || p.estado === 'en_entrega' || p.estado === 'entregado').length,
    productosActivos: productos.filter((p) => p.estado === 'activo').length,
    productosPremium: productos.filter((p) => p.plan === 'premium').length,
    profesionalesTotal: profesionales.length,
  }

  // Formulario de alta de profesional
  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState(RUBROS[0].id)
  const [descripcion, setDescripcion] = useState('')
  const [zona, setZona] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [icono, setIcono] = useState(ICONOS_SERVICIO[0])
  const [imagenUrl, setImagenUrl] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [plan, setPlan] = useState<'basico' | 'premium'>('basico')
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? localStorage.getItem('clasiclick_admin_pw') : null
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
        localStorage.setItem('clasiclick_admin_pw', pw)
        // Importante: le pasamos "pw" explícito acá, no dependemos del
        // estado "password" — en el login automático (contraseña
        // guardada en localStorage), el estado todavía no se actualizó
        // en este mismo instante, y usar la versión vieja hacía que
        // estos pedidos salieran sin contraseña válida (mostrando la
        // vista pública filtrada en vez de la completa).
        cargarProfesionales(pw)
        cargarProductos(pw)
      })
      .catch((e) => {
        setError(e.message)
        setAutenticado(false)
      })
      .finally(() => setCargando(false))
  }

  function cargarProfesionales(pw?: string) {
    fetch('/api/profesionales', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
  }

  function cargarMetricas(pw?: string) {
    setCargandoMetricas(true)
    fetch('/api/admin/metricas', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setMetricas(data))
      .finally(() => setCargandoMetricas(false))
  }

  function cargarProductos(pw?: string) {
    fetch('/api/productos', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setProductos(data.productos || []))
  }

  function cambiarEstadoProducto(id: string, estado: 'activo' | 'pendiente' | 'rechazado' | 'oculto') {
    fetch(`/api/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado }),
    }).then(() => cargarProductos(password))
  }

  function cambiarEstadoPedido(id: string, estado: 'pagado' | 'en_preparacion' | 'en_entrega' | 'entregado' | 'cancelado') {
    fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado }),
    }).then(() => entrar(password))
  }

  function confirmarPago(id: string) {
    cambiarEstadoPedido(id, 'pagado')
  }

  // Mismo endpoint que usan los vendedores en /vender, pero acá nos
  // autenticamos con la contraseña de admin en vez de un login de
  // Firebase (este panel no usa ese sistema de cuentas).
  async function subirImagenProfesional(file: File | null) {
    if (!file) return
    setSubiendoImagen(true)
    setErrorForm('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImagenUrl(data.url)
    } catch (e: any) {
      setErrorForm('Error subiendo la imagen: ' + e.message)
    } finally {
      setSubiendoImagen(false)
    }
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
          whatsapp, instagram, icono, plan, imagenUrl,
          precio: precio || null,
          experiencia,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorForm(data.error)
        return
      }
      setNombre(''); setDescripcion(''); setZona(''); setLat(''); setLng(''); setWhatsapp('')
      setImagenUrl(''); setPrecio(''); setExperiencia(''); setInstagram('')
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

  function cambiarEstadoProfesional(id: string, estado: 'aprobado' | 'rechazado') {
    fetch(`/api/profesionales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado }),
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
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Pedidos</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.pedidosTotal}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">En proceso</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.pedidosPagados}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Productos activos</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.productosActivos}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Premium</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.productosPremium}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-line flex-wrap">
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'pedidos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setTab('productos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'productos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setTab('servicios')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'servicios' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Servicios profesionales
          {profesionales.filter((p) => p.estado === 'pendiente_revision').length > 0 && (
            <span className="ml-1.5 inline-block bg-ochre text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {profesionales.filter((p) => p.estado === 'pendiente_revision').length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('metricas'); if (!metricas) cargarMetricas() }}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'metricas' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Métricas
        </button>
      </div>

      {tab === 'pedidos' && (
        <div>
          {pedidos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay pedidos.</div>}
          {pedidos.map((p) => {
            const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
            return (
              <div key={p.id} className="bg-panel border border-line rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
                    <div className="font-body text-xs text-inksoft">{p.items?.length || 0} producto(s) · {bs(p.total)}</div>
                    <div className="font-body text-[11px] text-inksoft mt-1">
                      {p.zonaEntrega || 'Sin zona'} · {p.direccion ? `Entrega: ${p.direccion}` : 'Sin dirección'}
                    </div>
                    <div className={`font-body text-xs font-semibold ${estado.color}`}>{estado.texto}</div>
                  </div>
                  {p.estado !== 'pagado' && p.estado !== 'en_preparacion' && p.estado !== 'en_entrega' && p.estado !== 'entregado' && p.estado !== 'cancelado' && (
                    <button
                      onClick={() => confirmarPago(p.id)}
                      className="px-3.5 py-2 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
                    >
                      Confirmar pago
                    </button>
                  )}
                </div>

                {p.estado === 'pagado' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_preparacion')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">En preparación</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_entrega')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">En entrega</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'entregado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Entregado</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'cancelado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px] text-maroon">Cancelar</button>
                  </div>
                )}

                {p.estado === 'en_preparacion' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_entrega')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Enviar</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'cancelado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px] text-maroon">Cancelar</button>
                  </div>
                )}

                {p.estado === 'en_entrega' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'entregado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Marcar entregado</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'productos' && (
        <div>
          <div className="font-body text-sm font-semibold text-ink mb-3">Moderación de productos</div>
          {productos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay productos.</div>}
          {[...productos]
            .sort((a, b) => {
              const orden: Record<string, number> = { alto: 0, medio: 1, bajo: 2 }
              const oa = orden[a.moderacionIA?.riesgo] ?? 3
              const ob = orden[b.moderacionIA?.riesgo] ?? 3
              return oa - ob
            })
            .map((p) => (
            <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden shrink-0">
                {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" /> : <span className="font-body text-[10px] text-inksoft">IMG</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm font-medium text-ink truncate">{p.nombre}</div>
                <div className="font-body text-xs text-inksoft">{p.vendedor || 'Vendedor'} · {p.categoria} · Bs {Number(p.precio || 0).toLocaleString('es-BO')}</div>
                <div className="font-body text-[11px] text-inksoft mt-1">Estado: {p.estado || 'activo'}</div>
                <BadgeRiesgoIA moderacionIA={p.moderacionIA} />
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'activo')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Activo</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'pendiente')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Pendiente</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'oculto')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Ocultar</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'rechazado')} className="px-2 py-1 rounded-md border border-line font-body text-[11px] text-maroon">Rechazar</button>
              </div>
            </div>
          ))}
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

            <div className="mb-3">
              <div className="font-body text-xs text-inksoft mb-1.5">Foto (opcional)</div>
              <div className="flex items-center gap-3 flex-wrap">
                {imagenUrl && (
                  <img
                    src={imagenUrl}
                    alt="Vista previa"
                    className="w-14 h-14 object-cover rounded-lg border border-line"
                  />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => subirImagenProfesional(e.target.files?.[0] || null)}
                    disabled={subiendoImagen}
                    className="font-body text-xs"
                  />
                  {subiendoImagen && <div className="font-body text-xs text-maroon mt-1">Subiendo imagen...</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                type="number"
                placeholder="Precio en Bs (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
              <input
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                placeholder="Experiencia (ej: 20 años)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
            </div>
            <div className="font-body text-[11px] text-inksoft mb-3 -mt-2">
              Si dejás el precio vacío, se muestra "Precio a convenir".
            </div>

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
              placeholder="WhatsApp (ej: 71234567, sin +591)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram u otra red social (opcional)"
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
              disabled={publicando || subiendoImagen}
              className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
            >
              {publicando ? 'Publicando...' : 'Publicar profesional'}
            </button>
          </form>

          {profesionales.filter((p) => p.estado === 'pendiente_revision').length > 0 && (
            <div className="mb-8">
              <div className="font-body text-sm font-semibold text-ochre mb-3">
                Solicitudes pendientes de revisión ({profesionales.filter((p) => p.estado === 'pendiente_revision').length})
              </div>
              {[...profesionales]
                .filter((p) => p.estado === 'pendiente_revision')
                .sort((a, b) => {
                  const orden: Record<string, number> = { alto: 0, medio: 1, bajo: 2 }
                  const oa = orden[a.moderacionIA?.riesgo] ?? 3
                  const ob = orden[b.moderacionIA?.riesgo] ?? 3
                  return oa - ob
                })
                .map((p) => (
                <div key={p.id} className="bg-panel border border-ochre rounded-lg p-4 mb-3">
                  <div className="font-body text-sm font-medium text-ink mb-1">{p.nombre}</div>
                  <div className="font-body text-xs text-inksoft mb-1">
                    {RUBROS.find((r) => r.id === p.rubro)?.label} · {p.zona || 'sin zona'} · WhatsApp: {p.whatsapp}
                  </div>
                  {p.descripcion && <div className="font-body text-xs text-ink mb-2">{p.descripcion}</div>}
                  <div className="font-body text-[11px] text-inksoft mb-2">
                    {p.precio ? `Bs ${Number(p.precio).toLocaleString('es-BO')}` : 'Precio a convenir'}
                    {p.experiencia && ` · Experiencia: ${p.experiencia}`}
                  </div>
                  <BadgeRiesgoIA moderacionIA={p.moderacionIA} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => cambiarEstadoProfesional(p.id, 'aprobado')}
                      className="px-3.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold"
                    >
                      Aprobar y publicar
                    </button>
                    <button
                      onClick={() => cambiarEstadoProfesional(p.id, 'rechazado')}
                      className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-maroon"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="font-body text-sm font-semibold text-ink mb-3">
            Publicados ({profesionales.filter((p) => !p.estado || p.estado === 'aprobado').length})
          </div>
          {profesionales.filter((p) => !p.estado || p.estado === 'aprobado').map((p) => (
            <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden">
                {p.imagenUrl ? (
                  <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                ) : (
                  <ServiceIcon kind={p.icono} size={20} />
                )}
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

      {tab === 'metricas' && (
        <div>
          {cargandoMetricas && <div className="font-body text-sm text-inksoft">Cargando métricas...</div>}
          {!cargandoMetricas && metricas && !metricas.error && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Usuarios registrados</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {metricas.usuariosTotal != null ? metricas.usuariosTotal : '—'}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Total facturado</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    Bs {Number(metricas.pedidos?.totalFacturado || 0).toLocaleString('es-BO')}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Pedidos totales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.pedidos?.total ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Productos publicados</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.productos?.total ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Profesionales aprobados</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {metricas.profesionales?.porEstado?.aprobado ?? 0}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Reseñas totales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalResenas ?? 0}</div>
                </div>
              </div>

              <div className="font-body text-sm font-semibold text-ink mb-3">Pedidos por estado</div>
              <div className="flex flex-wrap gap-2 mb-8">
                {Object.entries(metricas.pedidos?.porEstado || {}).map(([estado, cant]) => (
                  <div key={estado} className="bg-panelalt border border-line rounded-lg px-3 py-2">
                    <div className="font-body text-[11px] text-inksoft">{ESTADOS_LABEL[estado]?.texto || estado}</div>
                    <div className="font-display text-lg font-bold text-ink">{cant as number}</div>
                  </div>
                ))}
              </div>

              <div className="font-body text-sm font-semibold text-ink mb-3">Productos por estado</div>
              <div className="flex flex-wrap gap-2 mb-8">
                {Object.entries(metricas.productos?.porEstado || {}).map(([estado, cant]) => (
                  <div key={estado} className="bg-panelalt border border-line rounded-lg px-3 py-2">
                    <div className="font-body text-[11px] text-inksoft capitalize">{estado}</div>
                    <div className="font-display text-lg font-bold text-ink">{cant as number}</div>
                  </div>
                ))}
                <div className="bg-ochresoft border border-ochre rounded-lg px-3 py-2">
                  <div className="font-body text-[11px] text-inksoft">premium</div>
                  <div className="font-display text-lg font-bold text-ink">{metricas.productos?.premium ?? 0}</div>
                </div>
              </div>

              {metricas.productosMasVistos?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-3">Productos más vistos</div>
                  <div className="mb-8">
                    {metricas.productosMasVistos.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-line">
                        <span className="font-body text-sm text-ink">{i + 1}. {p.nombre}</span>
                        <span className="font-body text-xs text-inksoft">{p.vistas} vistas</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Vistas de perfiles profesionales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalVistas ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Clics a WhatsApp (profesionales)</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalClicsWhatsapp ?? 0}</div>
                </div>
              </div>

              {metricas.profesionalesMasClicWhatsapp?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-3">Profesionales con más contactos por WhatsApp</div>
                  <div className="mb-4">
                    {metricas.profesionalesMasClicWhatsapp.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-line">
                        <span className="font-body text-sm text-ink">{i + 1}. {p.nombre}</span>
                        <span className="font-body text-xs text-inksoft">{p.clicsWhatsapp} clics · {p.vistas} vistas</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="font-body text-[11px] text-inksoft mt-4">
                Todos estos números salen de datos reales de Firestore y Firebase Auth — no hay estimaciones ni cifras infladas.
              </div>
            </div>
          )}
          {!cargandoMetricas && metricas?.error && (
            <div className="font-body text-sm text-maroon">{metricas.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
