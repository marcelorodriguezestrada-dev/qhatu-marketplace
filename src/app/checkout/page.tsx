'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

type Paso = 'creando' | 'esperando_qr' | 'esperando_confirmacion' | 'pagado' | 'error'

const COSTOS_ENVIO: Record<string, number> = {
  'Centro La Paz': 25,
  'Sopocachi': 30,
  'El Alto': 35,
  'Villa Fátima': 40,
  'Fuera de la ciudad': 60,
}

// Datos de tu cuenta bancaria/QR, configurables sin tocar código —ver
// .env.example. Si no cargás la imagen del QR, igual mostramos los
// datos de la cuenta en texto para que el comprador transfiera a mano.
const QR_IMAGE_URL = process.env.NEXT_PUBLIC_QR_IMAGE_URL || ''
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME || ''
const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || ''
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || ''

export default function CheckoutPage() {
  const { items, total, vaciar } = useCarrito()
  const { usuario, cargando: authCargando } = useAuth()
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('creando')
  const [pedidoId, setPedidoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zonaEntrega, setZonaEntrega] = useState('Centro La Paz')
  const [direccion, setDireccion] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const costoEnvio = COSTOS_ENVIO[zonaEntrega] ?? 0
  const totalPedido = total + costoEnvio

  // Al entrar al checkout, creamos el pedido en Firestore como
  // "pendiente_pago". Todavía no hay QR dinámico — mostramos el QR fijo
  // de tu cuenta, configurado por variable de entorno. Si el comprador
  // está logueado, el pedido queda asociado a su email — no es
  // obligatorio estar logueado para comprar. Esperamos a que termine de
  // resolverse el estado de sesión (authCargando) antes de crear el
  // pedido, para no perder el dato del comprador por una carrera de
  // timing.
  useEffect(() => {
    if (items.length === 0 || authCargando || pedidoId) return
    fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        total: totalPedido,
        comprador: usuario?.email || null,
        zonaEntrega,
        direccion,
        costoEnvio,
        metodoEntrega: 'delivery',
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setPaso('error')
          setError(data.error)
          return
        }
        setPedidoId(data.id)
        setPaso('esperando_qr')
      })
      .catch(() => {
        setPaso('error')
        setError('No se pudo conectar con el servidor.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authCargando])

  function declararPago() {
    if (!pedidoId) return
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'informado_pago' }),
    }).then(() => setPaso('esperando_confirmacion'))
  }

  // Mientras esperamos que vos confirmes el pago desde /admin, sondeamos
  // cada 4 segundos.
  useEffect(() => {
    if (paso !== 'esperando_confirmacion' || !pedidoId) return
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/pedidos/${pedidoId}`)
      const data = await res.json()
      if (data.estado === 'pagado') {
        setPaso('pagado')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [paso, pedidoId])

  useEffect(() => {
    if (paso === 'pagado') vaciar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso])

  if (items.length === 0 && paso !== 'pagado') {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-16 text-center">
        <p className="font-body text-sm text-inksoft mb-4">Tu carrito está vacío.</p>
        <button onClick={() => router.push('/')} className="font-body text-sm text-maroon underline">
          Volver a la tienda
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[420px] mx-auto px-5 py-10">
      <button onClick={() => router.push('/')} className="border-none bg-transparent text-inksoft font-body text-[13px] mb-5 p-0">
        ← Volver a la tienda
      </button>

      {paso === 'pagado' ? (
        <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center">
          <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
          <div className="font-display text-lg font-bold text-ink mb-1.5">Pago confirmado</div>
          <div className="font-body text-[13px] text-inksoft">
            Tu pedido por {bs(total)} está confirmado. El vendedor ya puede prepararlo.
          </div>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          <div className="font-display text-lg font-bold text-ink mb-1.5">Pagá con QR</div>
          <div className="font-body text-[13px] text-inksoft mb-5">
            Escaneá desde la app de tu banco o Yape
          </div>

          {QR_IMAGE_URL ? (
            <img src={QR_IMAGE_URL} alt="Código QR de pago" className="mx-auto w-48 rounded-lg border border-line" />
          ) : (
            <div className="text-left bg-panelalt border border-line rounded-lg p-4 font-body text-[13px] text-ink">
              {BANK_NAME && <div><strong>Banco:</strong> {BANK_NAME}</div>}
              {BANK_ACCOUNT_NAME && <div><strong>Titular:</strong> {BANK_ACCOUNT_NAME}</div>}
              {BANK_ACCOUNT_NUMBER && <div><strong>Cuenta:</strong> {BANK_ACCOUNT_NUMBER}</div>}
              {!BANK_NAME && !BANK_ACCOUNT_NUMBER && (
                <span className="text-inksoft">Configurá NEXT_PUBLIC_QR_IMAGE_URL o los datos bancarios en las variables de entorno.</span>
              )}
            </div>
          )}

          <div className="bg-panelalt border border-line rounded-lg p-3 text-left mb-4">
            <div className="font-body text-[11px] text-inksoft mb-2">Entrega</div>
            <label className="block text-left mb-2">
              <span className="font-body text-[11px] text-inksoft block mb-1">Zona</span>
              <select
                value={zonaEntrega}
                onChange={(e) => setZonaEntrega(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
              >
                {Object.keys(COSTOS_ENVIO).map((zona) => (
                  <option key={zona} value={zona}>{zona} · {bs(COSTOS_ENVIO[zona])}</option>
                ))}
              </select>
            </label>
            <label className="block text-left">
              <span className="font-body text-[11px] text-inksoft block mb-1">Dirección</span>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, barrio"
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
              />
            </label>
          </div>

          <div className="font-body text-[12px] text-inksoft mb-1">Subtotal: {bs(total)}</div>
          <div className="font-body text-[12px] text-inksoft mb-1">Envío: {bs(costoEnvio)}</div>
          <div className="font-display text-2xl font-bold text-ink mt-2 mb-1">{bs(totalPedido)}</div>
          {pedidoId && (
            <div className="font-body text-xs text-inksoft mb-5">
              Incluí la referencia <strong>#{pedidoId.slice(0, 6)}</strong> en el pago si tu banco lo permite
            </div>
          )}

          {paso === 'esperando_qr' && (
            <button
              onClick={declararPago}
              className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
            >
              Ya pagué
            </button>
          )}

          {paso === 'esperando_confirmacion' && (
            <div className="font-body text-xs text-inksoft mt-2">
              Avisamos al vendedor. En cuanto confirme tu pago, esto se actualiza solo.
            </div>
          )}

          {paso === 'error' && (
            <div className="font-body text-xs text-maroon mt-2">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}
