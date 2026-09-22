'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type Franja = '' | '8-13' | '13-19'

export const FRANJA_LABEL: Record<'8-13' | '13-19', string> = {
  '8-13': '8 a 13',
  '13-19': '13 a 19',
}

// Opciones de día para quien no puede recibir el pedido mañana —
// arranca en pasado mañana (mañana ya está cubierto por las dos
// franjas de siempre) y ofrece una semana completa de ahí en más.
// `iso` es lo que se manda a guardar (yyyy-mm-dd); `label` es lo que
// ve el comprador, ej: "vie 26 sep".
export function proximosDias(cantidad: number): { iso: string; label: string }[] {
  const dias: { iso: string; label: string }[] = []
  for (let i = 2; i < 2 + cantidad; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })
    dias.push({ iso, label })
  }
  return dias
}

// yyyy-mm-dd → "viernes, 26 de septiembre", para el mensaje final de
// confirmación (más completo que el label corto de proximosDias).
function formatearFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Reusado por /checkout (justo después de confirmar el pago) y por
// /mis-pedidos/[id] (para modificar la preferencia ya guardada, hasta
// el corte de las 22hs — ver puedeModificarHorario en ese archivo).
// pedidoIds: a veces es un solo pedido (mis-pedidos), a veces varios
// (checkout, cuando el carrito se repartió entre varios vendedores y
// comparten el mismo horario de entrega).
export default function SelectorHorarioEntrega({
  pedidoIds,
  franjaInicial,
  fechaInicial,
  soloHoy,
  onGuardado,
}: {
  pedidoIds: string[]
  franjaInicial: Franja
  fechaInicial: string | null
  // Envío express: la entrega es hoy, no tiene sentido ofrecer "elegir otro día".
  soloHoy?: boolean
  onGuardado?: (v: { franjaHoraria: Franja; fechaEntrega: string | null }) => void
}) {
  const [otroDia, setOtroDia] = useState(!!fechaInicial)
  const [fechaElegida, setFechaElegida] = useState(fechaInicial || '')
  const [franjaHoraria, setFranjaHoraria] = useState<Franja>(franjaInicial)
  // Selección DENTRO del flujo "otro día", todavía no confirmada — se
  // guarda recién al tocar "Continuar" (a diferencia del flujo de
  // mañana, que guarda apenas se toca 8 a 13 / 13 a 19).
  const [franjaOtroDia, setFranjaOtroDia] = useState<Franja>('')
  const [guardando, setGuardando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  // Si empujamos una entrada al historial al entrar a "otro día", para
  // que el botón atrás del navegador/celular vuelva acá adentro en vez
  // de sacar a la persona de la pantalla entera.
  const pushedHistoryRef = useRef(false)

  useEffect(() => {
    if (!otroDia) return
    function onPopState() {
      pushedHistoryRef.current = false
      setOtroDia(false)
      setConfirmado(false)
      setFranjaOtroDia('')
      setFechaElegida('')
      if (fechaElegida) setFranjaHoraria('')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otroDia, fechaElegida])

  function abrirOtroDia() {
    setOtroDia(true)
    setConfirmado(false)
    if (typeof window !== 'undefined') {
      window.history.pushState({ selectorOtroDia: true }, '')
      pushedHistoryRef.current = true
    }
  }

  function volverAManana() {
    if (pushedHistoryRef.current && typeof window !== 'undefined') {
      // El listener de arriba hace el reset de verdad, disparado por el popstate.
      window.history.back()
    } else {
      setOtroDia(false)
      setConfirmado(false)
      setFranjaOtroDia('')
      setFechaElegida('')
      if (fechaElegida) setFranjaHoraria('')
    }
  }

  async function elegir(franja: '8-13' | '13-19') {
    setGuardando(true)
    setFranjaHoraria(franja)
    try {
      await Promise.all(
        pedidoIds.map((id) =>
          fetch(`/api/pedidos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ franjaHoraria: franja, fechaEntrega: null }),
          })
        )
      )
      onGuardado?.({ franjaHoraria: franja, fechaEntrega: null })
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarOtroDia() {
    if (!franjaOtroDia || !fechaElegida) return
    setGuardando(true)
    try {
      await Promise.all(
        pedidoIds.map((id) =>
          fetch(`/api/pedidos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ franjaHoraria: franjaOtroDia, fechaEntrega: fechaElegida }),
          })
        )
      )
      setFranjaHoraria(franjaOtroDia)
      onGuardado?.({ franjaHoraria: franjaOtroDia, fechaEntrega: fechaElegida })
      setConfirmado(true)
    } finally {
      setGuardando(false)
    }
  }

  if (otroDia && confirmado && franjaOtroDia) {
    return (
      <div className="text-center">
        <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
        <div className="font-body text-sm text-ink mb-3">
          Su compra se ha realizado con éxito. Usted está recibiendo su pedido el {formatearFechaLarga(fechaElegida)}, en el
          horario de {FRANJA_LABEL[franjaOtroDia as '8-13' | '13-19']}. Gracias por su compra.
        </div>
        {pedidoIds.length === 1 && (
          <Link href={`/mis-pedidos/${pedidoIds[0]}`} className="font-body text-[11px] text-maroon underline">
            Ver seguimiento del pedido
          </Link>
        )}
      </div>
    )
  }

  if (!otroDia) {
    return (
      <div>
        <div className="font-body text-sm font-medium text-ink mb-2.5">
          {soloHoy ? '¿En qué horario de hoy prefiere recibirlo?' : '¿En qué horario prefiere recibirlo?'}
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => elegir('8-13')}
            disabled={guardando}
            className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
              franjaHoraria === '8-13' && !fechaElegida ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
            }`}
          >
            8 a 13
          </button>
          <button
            type="button"
            onClick={() => elegir('13-19')}
            disabled={guardando}
            className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
              franjaHoraria === '13-19' && !fechaElegida ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
            }`}
          >
            13 a 19
          </button>
          {!soloHoy && (
            <button
              type="button"
              onClick={abrirOtroDia}
              className="w-full py-3 rounded-full border border-line bg-panel font-body text-sm font-semibold text-inksoft"
            >
              Otro día
            </button>
          )}
        </div>
        {franjaHoraria && !fechaElegida && !guardando && (
          <div className="font-body text-[11px] text-teal mt-2">✓ Guardado.</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="font-body text-sm font-medium text-ink mb-2.5">Seleccioná el día que querés recibir tu pedido</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {proximosDias(7).map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => {
              setFechaElegida(d.iso)
              setFranjaOtroDia('')
            }}
            className={`py-2.5 rounded-full border font-body text-[13px] font-semibold capitalize ${
              fechaElegida === d.iso ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {fechaElegida && (
        <>
          <div className="font-body text-sm font-medium text-ink mb-2.5">¿En qué horario preferís recibirlo?</div>
          <div className="flex flex-col gap-2.5 mb-3">
            <button
              type="button"
              onClick={() => setFranjaOtroDia('8-13')}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaOtroDia === '8-13' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              8 a 13
            </button>
            <button
              type="button"
              onClick={() => setFranjaOtroDia('13-19')}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaOtroDia === '13-19' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              13 a 19
            </button>
          </div>
          <button
            type="button"
            onClick={confirmarOtroDia}
            disabled={!franjaOtroDia || guardando}
            className="w-full py-3 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-40 mb-3"
          >
            {guardando ? 'Guardando...' : 'Continuar'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={volverAManana}
        className="w-full text-center font-body text-[12px] text-inksoft underline"
      >
        Volver a las opciones de mañana
      </button>
    </div>
  )
}
