'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCarrito, ItemCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

type Etapa = 'entrega' | 'creando' | 'pagando' | 'resumen' | 'error'

const COSTOS_ENVIO: Record<string, number> = {
  'Centro La Paz': 25,
  'Sopocachi': 30,
  'El Alto': 35,
  'Villa Fátima': 40,
  'Fuera de la ciudad': 60,
}

// QR/cuenta de la plataforma — se usa como respaldo para los items sin
// vendedor identificado (datos de ejemplo) o para vendedores que
// todavía no configuraron su propio QR/CBU en /vender.
const QR_PLATAFORMA = process.env.NEXT_PUBLIC_QR_IMAGE_URL || ''
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME || ''
const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || ''
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || ''

type SubPedido = {
  vendedorId: string | null
  vendedorNombre: string
  items: ItemCarrito[]
  subtotal: number
  costoEnvio: number
  total: number
  qrImageUrl: string
  cbu: string
  cobroPropio: boolean
  pedidoId: string | null
  declarado: boolean
  estadoActual: string
}

// Reparte el costo de envío proporcional al subtotal de cada vendedor,
// asegurando que la suma dé exacto (el "sobrante" de redondear para
// abajo se lo llevan los grupos con la parte decimal más alta).
function repartirEnvio(subtotales: number[], costoEnvioTotal: number): number[] {
  const totalSubtotal = subtotales.reduce((s, x) => s + x, 0)
  if (totalSubtotal === 0 || costoEnvioTotal === 0) return subtotales.map(() => 0)
  const partes = subtotales.map((st) => (st / totalSubtotal) * costoEnvioTotal)
  const redondeadas = partes.map((p) => Math.floor(p))
  let sobrante = Math.round(costoEnvioTotal - redondeadas.reduce((s, x) => s + x, 0))
  const ordenDecimales = partes
    .map((p, i) => ({ i, dec: p - Math.floor(p) }))
    .sort((a, b) => b.dec - a.dec)
  for (let k = 0; k < sobrante; k++) {
    redondeadas[ordenDecimales[k % ordenDecimales.length].i] += 1
  }
  return redondeadas
}

export default function CheckoutPage() {
  const { items, vaciar } = useCarrito()
  const { usuario, cargando: authCargando } = useAuth()
  const router = useRouter()

  const [etapa, setEtapa] = useState<Etapa>('entrega')
  const [zonaEntrega, setZonaEntrega] = useState('Centro La Paz')
  const [direccion, setDireccion] = useState('')
  const [subPedidos, setSubPedidos] = useState<SubPedido[]>([])
  const [pasoActual, setPasoActual] = useState(0)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const costoEnvio = COSTOS_ENVIO[zonaEntrega] ?? 0
  const subtotalCarrito = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  async function confirmarEntregaYCrearPedidos() {
    setEtapa('creando')
    setError('')

    const grupos = new Map<string, ItemCarrito[]>()
    for (const item of items) {
      const clave = item.vendedorId || 'plataforma'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave)!.push(item)
    }

    const clavesVendedor = Array.from(grupos.keys())
    const subtotales = clavesVendedor.map((k) => grupos.get(k)!.reduce((s, i) => s + i.precio * i.cantidad, 0))
    const enviosRepartidos = repartirEnvio(subtotales, costoEnvio)

    try {
      const nuevos: SubPedido[] = []
      for (let i = 0; i < clavesVendedor.length; i++) {
        const clave = clavesVendedor[i]
        const grupoItems = grupos.get(clave)!
        const vendedorId = clave === 'plataforma' ? null : clave
        const subtotal = subtotales[i]
        const envioGrupo = enviosRepartidos[i]
        const totalGrupo = subtotal + envioGrupo

        let qrImageUrl = QR_PLATAFORMA
        let cbu = BANK_ACCOUNT_NUMBER
        let cobroPropio = false
        let vendedorNombre = clave === 'plataforma' ? 'Clasi Click' : grupoItems[0]?.vendedor || 'Vendedor'

        if (vendedorId) {
          try {
            const res = await fetch(`/api/vendedores/${vendedorId}`)
            const data = await res.json()
            if (data.configurado) {
              qrImageUrl = data.qrImageUrl || QR_PLATAFORMA
              cbu = data.cbu || BANK_ACCOUNT_NUMBER
              cobroPropio = true
              if (data.nombreNegocio) vendedorNombre = data.nombreNegocio
            }
          } catch {
            // si falla la consulta, seguimos con el QR de la plataforma como respaldo
          }
        }

        const resPedido = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: grupoItems,
            total: totalGrupo,
            comprador: usuario?.email || null,
            vendedorId,
            zonaEntrega,
            direccion,
            costoEnvio: envioGrupo,
            metodoEntrega: 'delivery',
          }),
        })
        const dataPedido = await resPedido.json()
        if (dataPedido.error) throw new Error(dataPedido.error)

        nuevos.push({
          vendedorId,
          vendedorNombre,
          items: grupoItems,
          subtotal,
          costoEnvio: envioGrupo,
          total: totalGrupo,
          qrImageUrl,
          cbu,
          cobroPropio,
          pedidoId: dataPedido.id,
          declarado: false,
          estadoActual: 'pendiente_pago',
        })
      }

      setSubPedidos(nuevos)
      setPasoActual(0)
      setEtapa('pagando')
    } catch (e: any) {
      setError(e.message || 'No se pudieron crear los pedidos.')
      setEtapa('error')
    }
  }

  function declararPagoActual() {
    const sub = subPedidos[pasoActual]
    if (!sub.pedidoId) return
    fetch(`/api/pedidos/${sub.pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'informado_pago' }),
    }).then(() => {
      setSubPedidos((prev) => prev.map((s, i) => (i === pasoActual ? { ...s, declarado: true, estadoActual: 'informado_pago' } : s)))
      if (pasoActual < subPedidos.length - 1) {
        setPasoActual(pasoActual + 1)
      } else {
        setEtapa('resumen')
      }
    })
  }

  useEffect(() => {
    if (etapa !== 'resumen') return
    pollRef.current = setInterval(async () => {
      const actualizados = await Promise.all(
        subPedidos.map(async (s) => {
          if (!s.pedidoId || s.estadoActual === 'pagado') return s
          const res = await fetch(`/api/pedidos/${s.pedidoId}`)
          const data = await res.json()
          return { ...s, estadoActual: data.estado || s.estadoActual }
        })
      )
      setSubPedidos(actualizados)
      if (actualizados.every((s) => s.estadoActual === 'pagado')) {
        if (pollRef.current) clearInterval(pollRef.current)
        vaciar()
      }
    }, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa])

  if (items.length === 0 && etapa !== 'resumen') {
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

      {etapa === 'entrega' && (
        <div className="bg-panel border border-line rounded-xl p-6">
          <div className="font-display text-lg font-bold text-ink mb-4">Datos de entrega</div>
          <label className="block text-left mb-3">
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
          <label className="block text-left mb-4">
            <span className="font-body text-[11px] text-inksoft block mb-1">Dirección</span>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle, número, barrio"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel font-body text-sm"
            />
          </label>
          <div className="font-body text-[12px] text-inksoft mb-1">Subtotal: {bs(subtotalCarrito)}</div>
          <div className="font-body text-[12px] text-inksoft mb-3">Envío: {bs(costoEnvio)}</div>
          <div className="font-display text-xl font-bold text-ink mb-4">{bs(subtotalCarrito + costoEnvio)}</div>
          <button
            onClick={confirmarEntregaYCrearPedidos}
            disabled={authCargando}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
          >
            Continuar al pago
          </button>
        </div>
      )}

      {etapa === 'creando' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center font-body text-sm text-inksoft">
          Preparando tu pedido...
        </div>
      )}

      {etapa === 'error' && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          <div className="font-body text-sm text-maroon">{error}</div>
        </div>
      )}

      {etapa === 'pagando' && subPedidos[pasoActual] && (
        <div className="bg-panel border border-line rounded-xl p-7 text-center">
          {subPedidos.length > 1 && (
            <div className="font-body text-[11px] text-inksoft mb-2">
              Pago {pasoActual + 1} de {subPedidos.length}
            </div>
          )}
          <div className="font-display text-lg font-bold text-ink mb-1.5">
            Pagale a {subPedidos[pasoActual].vendedorNombre}
          </div>
          <div className="font-body text-[13px] text-inksoft mb-5">
            {subPedidos[pasoActual].cobroPropio
              ? 'Este vendedor cobra directo — el pago va a su cuenta, no a Clasi Click'
              : 'Este vendedor todavía no configuró su cobro — usá el QR general por ahora'}
          </div>

          {subPedidos[pasoActual].qrImageUrl ? (
            <img src={subPedidos[pasoActual].qrImageUrl} alt="Código QR de pago" className="mx-auto w-48 rounded-lg border border-line" />
          ) : (
            <div className="text-left bg-panelalt border border-line rounded-lg p-4 font-body text-[13px] text-ink">
              {subPedidos[pasoActual].cbu ? (
                <div><strong>Cuenta / CBU:</strong> {subPedidos[pasoActual].cbu}</div>
              ) : (
                <>
                  {BANK_NAME && <div><strong>Banco:</strong> {BANK_NAME}</div>}
                  {BANK_ACCOUNT_NAME && <div><strong>Titular:</strong> {BANK_ACCOUNT_NAME}</div>}
                  {!BANK_NAME && <span className="text-inksoft">No hay datos de cobro configurados todavía.</span>}
                </>
              )}
            </div>
          )}

          <div className="font-display text-2xl font-bold text-ink mt-4 mb-1">{bs(subPedidos[pasoActual].total)}</div>
          {subPedidos[pasoActual].pedidoId && (
            <div className="font-body text-xs text-inksoft mb-5">
              Incluí la referencia <strong>#{subPedidos[pasoActual].pedidoId!.slice(0, 6)}</strong> en el pago si tu banco lo permite
            </div>
          )}

          <button
            onClick={declararPagoActual}
            className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
          >
            Ya pagué
          </button>
        </div>
      )}

      {etapa === 'resumen' && (
        <div>
          {subPedidos.every((s) => s.estadoActual === 'pagado') ? (
            <div className="bg-tealsoft border border-teal rounded-xl p-7 text-center mb-4">
              <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
              <div className="font-display text-lg font-bold text-ink mb-1.5">Todos los pagos confirmados</div>
              <div className="font-body text-[13px] text-inksoft">Los vendedores ya pueden preparar tu pedido.</div>
            </div>
          ) : (
            <div className="font-body text-sm text-inksoft mb-4 text-center">
              Avisamos a cada vendedor. Esto se actualiza solo a medida que van confirmando.
            </div>
          )}
          {subPedidos.map((s, i) => (
            <div key={i} className="bg-panel border border-line rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-body text-sm font-medium text-ink">{s.vendedorNombre}</span>
                <span className={`font-body text-[11px] font-semibold ${s.estadoActual === 'pagado' ? 'text-teal' : 'text-ochre'}`}>
                  {s.estadoActual === 'pagado' ? 'Pagado' : 'Esperando confirmación'}
                </span>
              </div>
              <div className="font-body text-xs text-inksoft">{bs(s.total)} · {s.items.length} producto(s)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
