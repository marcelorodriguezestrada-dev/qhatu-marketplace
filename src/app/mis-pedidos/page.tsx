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
        return (
          <div key={p.id} className="bg-panel border border-line rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
              <div className={`font-body text-[11px] font-semibold ${estado.color}`}>{estado.texto}</div>
            </div>
            <div className="font-body text-xs text-inksoft mb-3">{(p.items || []).length} producto(s) · {bs(p.total || 0)}</div>
            <div className="space-y-2">
              {(p.items || []).map((item: any) => (
                <div key={`${p.id}-${item.id}`} className="flex items-center gap-3 border-t border-line pt-2">
                  <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden shrink-0">
                    {item.imagenUrl ? <img src={item.imagenUrl} alt={item.nombre} className="w-full h-full object-cover" /> : <span className="font-body text-[9px] text-inksoft">IMG</span>}
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
