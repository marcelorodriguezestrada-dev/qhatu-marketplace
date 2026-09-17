'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fechaLegibleBolivia } from '@/lib/fechaBolivia'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// Los 4 pasos que ve el comprador. El backend solo tiene estos 4 estados
// de "operación" (ver estadosValidos en /api/pedidos/[id]) — "recibió la
// moto" y "en camino" son, en los hechos, el mismo momento (el
// repartidor confirma la entrega en /admin recién cuando sale con el
// pedido), así que van juntos en el mismo paso "En camino".
const PASOS = [
  { key: 'pagado', label: 'Confirmado', detalle: 'Ya confirmamos tu pago.' },
  { key: 'en_preparacion', label: 'Preparando', detalle: 'El vendedor está armando tu pedido.' },
  { key: 'en_entrega', label: 'En camino', detalle: '🛵 La moto ya recogió tu pedido y está en camino.' },
  { key: 'entregado', label: 'Entregado', detalle: 'Tu pedido ya fue entregado. ¡Gracias por comprar!' },
]

const ESTADOS_PREVIOS: Record<string, string> = {
  verificando_stock: 'El vendedor está confirmando que tiene stock disponible.',
  pendiente_pago: 'Esperando que se confirme tu pago.',
  informado_pago: 'Avisaste que ya pagaste — estamos confirmándolo.',
}

// Igual que en el checkout: la entrega es al día siguiente del pago,
// horario todavía sin confirmar — no una franja horaria del mismo día.
function fechaEntregaTexto(pagadoAt?: string): string {
  const base = pagadoAt ? new Date(pagadoAt) : new Date()
  const manana = new Date(base)
  manana.setDate(manana.getDate() + 1)
  return `mañana, ${manana.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}`
}

export default function SeguimientoPedidoPage() {
  const { id } = useParams<{ id: string }>()
  const [pedido, setPedido] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await fetch(`/api/pedidos/${id}`)
        const data = await res.json()
        if (!activo) return
        if (data.error) {
          setError(data.error)
        } else {
          setPedido(data)
        }
      } catch {
        if (activo) setError('No se pudo cargar el pedido.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    // El estado puede cambiar del lado del vendedor (en /vender o
    // /admin) mientras el comprador tiene esta pantalla abierta — un
    // sondeo simple cada 15s alcanza para que se vea "solo", sin tener
    // que refrescar a mano, y sin necesitar nada en tiempo real.
    const intervalo = setInterval(cargar, 15000)
    return () => {
      activo = false
      clearInterval(intervalo)
    }
  }, [id])

  if (cargando) {
    return <div className="max-w-[560px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando tu pedido...</div>
  }

  if (error || !pedido) {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-16 text-center">
        <div className="font-display text-xl font-bold text-ink mb-3">No encontramos ese pedido</div>
        <div className="font-body text-sm text-inksoft mb-5">{error || 'Revisá el link de seguimiento.'}</div>
        <Link href="/mis-pedidos" className="inline-block px-4 py-2.5 rounded-lg bg-maroon text-white font-body text-sm font-semibold">
          Ver mis pedidos
        </Link>
      </div>
    )
  }

  const esEnvio = pedido.metodoEntrega === 'envio'
  const cancelado = pedido.estado === 'cancelado'
  const estadoPrevio = ESTADOS_PREVIOS[pedido.estado]
  const pasoActualIdx = PASOS.findIndex((p) => p.key === pedido.estado)

  return (
    <div className="max-w-[560px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-display text-xl font-bold text-ink">Pedido #{pedido.id?.slice(0, 6)}</div>
          <div className="font-body text-[13px] text-inksoft">{bs(pedido.total || 0)} · {(pedido.items || []).length} producto(s)</div>
          {pedido.createdAt && (
            <div className="font-body text-[11px] text-inksoft">{fechaLegibleBolivia(pedido.createdAt)}</div>
          )}
        </div>
        <Link href="/mis-pedidos" className="font-body text-sm text-maroon underline">Mis pedidos</Link>
      </div>

      {cancelado && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center mb-5">
          <div className="font-display text-lg font-bold text-red-700 mb-1">Pedido cancelado</div>
          <div className="font-body text-[13px] text-red-700/80">Si ya habías pagado y no te devolvieron la plata, escribinos.</div>
        </div>
      )}

      {!cancelado && estadoPrevio && (
        <div className="bg-panelalt border border-line rounded-xl p-5 text-center mb-5">
          <div className="font-display text-base font-bold text-ink mb-1">Todavía no está confirmado</div>
          <div className="font-body text-[13px] text-inksoft">{estadoPrevio}</div>
        </div>
      )}

      {!cancelado && pasoActualIdx >= 0 && (
        <>
          {esEnvio && pedido.estado !== 'entregado' && (
            <div className="bg-tealsoft border border-teal rounded-xl p-4 mb-5 text-center">
              <div className="font-body text-[13px] text-ink">
                Estarás recibiendo el pedido {fechaEntregaTexto(pedido.pagadoAt)}, horario a confirmar. Entregamos en <span className="font-semibold">{pedido.direccion || 'la dirección que diste'}</span>.
              </div>
            </div>
          )}

          <div className="bg-panel border border-line rounded-xl p-5 mb-5">
            {PASOS.map((paso, i) => {
              const completado = i <= pasoActualIdx
              const esActual = i === pasoActualIdx
              return (
                <div key={paso.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-body text-xs font-bold shrink-0 ${
                        completado ? 'bg-teal text-white' : 'bg-panelalt text-inksoft border border-line'
                      }`}
                    >
                      {completado ? '✓' : i + 1}
                    </div>
                    {i < PASOS.length - 1 && <div className={`w-0.5 flex-1 min-h-[28px] ${i < pasoActualIdx ? 'bg-teal' : 'bg-line'}`} />}
                  </div>
                  <div className={`pb-5 ${i === PASOS.length - 1 ? 'pb-0' : ''}`}>
                    <div className={`font-body text-sm font-semibold ${completado ? 'text-ink' : 'text-inksoft'}`}>{paso.label}</div>
                    {esActual && <div className="font-body text-[12px] text-inksoft mt-0.5">{paso.detalle}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="font-body text-sm font-semibold text-ink mb-3">Detalle del pedido</div>
        <div className="space-y-2">
          {(pedido.items || []).map((item: any, i: number) => (
            <div key={`${item.id}-${i}`} className="flex items-center gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
              <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden shrink-0">
                {item.thumbUrl || item.imagenUrl ? (
                  <img src={item.thumbUrl || item.imagenUrl} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-body text-[9px] text-inksoft">IMG</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm text-ink truncate">{item.nombre}</div>
                <div className="font-body text-[11px] text-inksoft">{item.cantidad} x {bs(item.precio || 0)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="font-body text-[11px] text-inksoft mt-3 pt-3 border-t border-line">
          {esEnvio ? `Envío: ${pedido.zonaEntrega || 'Sin zona'} · ${pedido.direccion || 'Sin dirección'}${pedido.entreCalles ? ` (${pedido.entreCalles})` : ''}` : 'Retiro en tienda'}
        </div>
      </div>
    </div>
  )
}
