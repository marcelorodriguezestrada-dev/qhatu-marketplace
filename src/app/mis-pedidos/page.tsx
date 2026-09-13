'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

const ESTADOS_LABEL: Record<string, { texto: string; color: string }> = {
  pendiente_pago: { texto: 'Esperando pago', color: 'text-inksoft' },
  informado_pago: { texto: 'Pago avisado', color: 'text-ochre' },
  pagado: { texto: 'Pagado', color: 'text-teal' },
  en_preparacion: { texto: 'En preparación', color: 'text-indigo-600' },
  en_entrega: { texto: 'En entrega', color: 'text-amber-600' },
  entregado: { texto: 'Entregado', color: 'text-emerald-600' },
  cancelado: { texto: 'Cancelado', color: 'text-red-600' },
}

// Pasos del seguimiento visual. pendiente_pago/informado_pago todavía
// no entran acá (no hay nada que "seguir" hasta que el pago esté
// confirmado) — para esos se muestra el label de arriba nomás.
const PASOS_SEGUIMIENTO = [
  { estado: 'pagado', label: 'Pagado' },
  { estado: 'en_preparacion', label: 'En preparación' },
  { estado: 'en_entrega', label: 'En camino' },
  { estado: 'entregado', label: 'Entregado' },
]

function Seguimiento({ estado }: { estado: string }) {
  const pasoActual = PASOS_SEGUIMIENTO.findIndex((p) => p.estado === estado)
  if (pasoActual === -1) return null
  return (
    <div className="flex items-center mb-3">
      {PASOS_SEGUIMIENTO.map((p, i) => (
        <div key={p.estado} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i <= pasoActual ? 'bg-teal text-white' : 'bg-panelalt text-inksoft border border-line'
              }`}
            >
              {i < pasoActual ? '✓' : i + 1}
            </div>
            <span className={`font-body text-[9px] text-center leading-tight w-14 ${i <= pasoActual ? 'text-ink font-medium' : 'text-inksoft'}`}>
              {p.label}
            </span>
          </div>
          {i < PASOS_SEGUIMIENTO.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < pasoActual ? 'bg-teal' : 'bg-line'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export default function MisPedidosPage() {
  const { usuario, cargando, obtenerToken } = useAuth()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [cargandoPedidos, setCargandoPedidos] = useState(true)

  useEffect(() => {
    if (cargando) return
    if (!usuario) return

    async function cargar() {
      const token = await obtenerToken()
      if (!token) return
      const res = await fetch('/api/pedidos', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setCargandoPedidos(false)
    }

    cargar()
  }, [cargando, usuario, obtenerToken])

  // Mientras haya algún pedido todavía no entregado ni cancelado,
  // refrescamos solos cada 15s — así el comprador ve el seguimiento
  // avanzar sin tener que recargar la página a mano.
  useEffect(() => {
    if (cargando || !usuario) return
    const hayActivos = pedidos.some((p) => p.estado !== 'entregado' && p.estado !== 'cancelado')
    if (!hayActivos) return
    const intervalo = setInterval(async () => {
      const token = await obtenerToken()
      if (!token) return
      const res = await fetch('/api/pedidos', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPedidos(data.pedidos || [])
    }, 15000)
    return () => clearInterval(intervalo)
  }, [cargando, usuario, pedidos, obtenerToken])

  if (cargando || cargandoPedidos) {
    return <div className="max-w-[640px] mx-auto px-5 py-16 font-body text-sm text-inksoft">Cargando tus pedidos...</div>
  }

  if (!usuario) {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-16 text-center">
        <div className="font-display text-xl font-bold text-ink mb-3">Iniciá sesión</div>
        <div className="font-body text-sm text-inksoft mb-5">Necesitás una cuenta para ver tus compras.</div>
        <Link href="/login" className="inline-block px-4 py-2.5 rounded-lg bg-maroon text-white font-body text-sm font-semibold">
          Ir al login
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-display text-xl font-bold text-ink">Mis pedidos</div>
          <div className="font-body text-[13px] text-inksoft">{usuario.email}</div>
        </div>
        <Link href="/" className="font-body text-sm text-maroon underline">Volver</Link>
      </div>

      {pedidos.length === 0 && (
        <div className="bg-panel border border-line rounded-xl p-5 font-body text-sm text-inksoft">
          Todavía no hiciste compras.
        </div>
      )}

      {pedidos.map((p) => {
        const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
        const enSeguimiento = PASOS_SEGUIMIENTO.some((s) => s.estado === p.estado)
        return (
          <div key={p.id} className="bg-panel border border-line rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
              {!enSeguimiento && <div className={`font-body text-[11px] font-semibold ${estado.color}`}>{estado.texto}</div>}
            </div>
            {enSeguimiento && <Seguimiento estado={p.estado} />}
            <div className="font-body text-xs text-inksoft mb-1">{(p.items || []).length} producto(s) · {bs(p.total || 0)}</div>
            <div className="font-body text-[11px] text-inksoft mb-3">
              Envío: {p.zonaEntrega || 'Sin zona'} · {p.direccion || 'Sin dirección'}
              {p.franjaHoraria && <> · Horario: {p.franjaHoraria}</>}
            </div>
            <div className="space-y-2">
              {(p.items || []).map((item: any) => (
                <div key={`${p.id}-${item.id}`} className="flex items-center gap-3 border-t border-line pt-2">
                  <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden shrink-0">
                    {item.thumbUrl || item.imagenUrl ? <img src={item.thumbUrl || item.imagenUrl} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span className="font-body text-[9px] text-inksoft">IMG</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm text-ink truncate">{item.nombre}</div>
                    <div className="font-body text-[11px] text-inksoft">{item.cantidad} x {bs(item.precio || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
