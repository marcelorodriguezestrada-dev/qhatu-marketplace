'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'

// ── Bloqueo total mientras hay un pago esperando validación ─────────
// El checkout (ver /checkout) ya guarda en localStorage, bajo una
// clave por tienda (`clasiclick_checkout_espera_*`), los subpedidos
// que quedaron en 'informado_pago' esperando que el vendedor/admin
// confirme. Ese estado, sin embargo, solo se mostraba DENTRO de
// /checkout — si el comprador salía a otra pantalla (la home, un link
// directo, "atrás" del navegador) quedaba libre para seguir navegando
// y comprando con el pago anterior todavía sin validar.
//
// Este gate se monta una sola vez en layout.tsx, como VerificacionGate,
// y tapa TODA la app con una pantalla que no se puede cerrar mientras
// exista al menos un subpedido en esa situación para el usuario
// logueado — recién se libera cuando el vendedor/admin lo marca
// 'pagado', o lo cancela.
const PREFIJO_CLAVE_ESPERA = 'clasiclick_checkout_espera_'
const VIGENCIA_MS = 48 * 60 * 60 * 1000
const INTERVALO_CONSULTA_MS = 4000

type SubPedidoGuardado = {
  pedidoId: string | null
  estadoActual: string
  vendedorNombre: string
}

type EsperaGuardada = {
  uid: string
  guardadoAt: number
  subPedidos: SubPedidoGuardado[]
}

function leerEsperasDelUsuario(uid: string): SubPedidoGuardado[] {
  const subPedidos: SubPedidoGuardado[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const clave = localStorage.key(i)
    if (!clave || !clave.startsWith(PREFIJO_CLAVE_ESPERA)) continue
    try {
      const datos = JSON.parse(localStorage.getItem(clave) || '') as EsperaGuardada
      if (datos?.uid !== uid) continue
      if (typeof datos.guardadoAt !== 'number' || Date.now() - datos.guardadoAt >= VIGENCIA_MS) continue
      if (Array.isArray(datos.subPedidos)) subPedidos.push(...datos.subPedidos)
    } catch {
      // Entrada corrupta: se ignora, no bloquea nada.
    }
  }
  return subPedidos
}

export default function PagoPendienteGate() {
  const { usuario } = useAuth()
  const [pendientes, setPendientes] = useState<SubPedidoGuardado[]>(() => {
    if (typeof window === 'undefined') return []
    return usuario ? leerEsperasDelUsuario(usuario.uid).filter((s) => s.estadoActual !== 'pagado' && s.estadoActual !== 'cancelado') : []
  })

  const consultar = useCallback(async () => {
    if (!usuario) {
      setPendientes([])
      return
    }
    const guardados = leerEsperasDelUsuario(usuario.uid)
    if (guardados.length === 0) {
      setPendientes([])
      return
    }
    // El admin (o el vendedor) puede haber validado el pago mientras el
    // comprador andaba en otra pantalla — por eso siempre se consulta
    // el estado más fresco de cada pedido, nunca el que quedó guardado.
    const actualizados = await Promise.all(
      guardados.map(async (s) => {
        if (!s.pedidoId || s.estadoActual === 'pagado' || s.estadoActual === 'cancelado') return s
        try {
          const res = await fetch(`/api/pedidos/${s.pedidoId}`)
          const data = await res.json()
          return { ...s, estadoActual: data.estado || s.estadoActual }
        } catch {
          // Un fallo de red puntual no libera el bloqueo ni lo endurece:
          // se reintenta en la próxima consulta.
          return s
        }
      })
    )
    setPendientes(actualizados.filter((s) => s.estadoActual !== 'pagado' && s.estadoActual !== 'cancelado'))
  }, [usuario])

  useEffect(() => {
    consultar()
    const id = setInterval(consultar, INTERVALO_CONSULTA_MS)
    return () => clearInterval(id)
  }, [consultar])

  if (pendientes.length === 0) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-[380px] bg-panel border border-line rounded-xl p-7 text-center">
        <div className="w-11 h-11 rounded-full bg-ochre text-white flex items-center justify-center mx-auto mb-3.5 text-xl animate-pulse">
          ⏳
        </div>
        <div className="font-display text-lg font-bold text-ink mb-1.5">Esperando la confirmación del pago</div>
        <div className="font-body text-[13px] text-inksoft mb-4">
          Ya recibimos tu comprobante. Hasta que {pendientes.length > 1 ? 'los vendedores lo revisen' : 'el vendedor lo revise'} no
          podés seguir navegando ni hacer otra compra — esta pantalla se actualiza sola apenas se confirme.
        </div>
        {pendientes.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-2 border-t border-line">
            <span className="font-body text-xs text-ink truncate">{s.vendedorNombre}</span>
            <span className="font-body text-[11px] font-semibold shrink-0 text-ochre">Revisando...</span>
          </div>
        ))}
      </div>
    </div>
  )
}
