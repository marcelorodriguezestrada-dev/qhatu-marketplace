'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type Franja = '' | '8-13' | '13-19'

export const FRANJA_LABEL: Record<'8-13' | '13-19', string> = {
  '8-13': '8 a 13',
  // La moto sale a las 8:00 y a las 14:00 (ver src/lib/reparto.ts) — el
  // rango de la tarde arranca ahí, no a las 13.
  '13-19': 'de 14 a 19',
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

// yyyy-mm-dd → "viernes, 26 de septiembre", para el mensaje final de confirmación.
function formatearFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatearManana(): string {
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  return manana.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Reusado por /checkout, justo después de confirmar el pago (con
// envío) — deja elegir el horario de mañana, o un día distinto dentro
// de la semana, y recién guarda cuando se toca "Continuar".
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
  // Selección todavía no guardada — se confirma recién al tocar
  // "Continuar", tanto para las franjas de mañana como para un día
  // elegido aparte.
  const [franjaSeleccion, setFranjaSeleccion] = useState<Franja>('')
  const [guardando, setGuardando] = useState(false)
  // Si ya venía confirmado (franjaInicial ya cargado, por ejemplo
  // porque el componente se volvió a renderizar en la misma sesión sin
  // desmontarse) arrancamos directo mostrando el mensaje final.
  const [confirmado, setConfirmado] = useState(!!franjaInicial)
  const [franjaConfirmada, setFranjaConfirmada] = useState<Franja>(franjaInicial)
  // Si empujamos una entrada al historial al entrar a "otro día", para
  // que el botón atrás del navegador/celular vuelva acá adentro en vez
  // de sacar a la persona de la pantalla entera.
  const pushedHistoryRef = useRef(false)

  useEffect(() => {
    if (!otroDia) return
    function onPopState() {
      pushedHistoryRef.current = false
      setOtroDia(false)
      setFranjaSeleccion('')
      setFechaElegida('')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [otroDia])

  function abrirOtroDia() {
    setOtroDia(true)
    setFranjaSeleccion('')
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
      setFranjaSeleccion('')
      setFechaElegida('')
    }
  }

  async function confirmar() {
    if (!franjaSeleccion) return
    setGuardando(true)
    try {
      await Promise.all(
        pedidoIds.map((id) =>
          fetch(`/api/pedidos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ franjaHoraria: franjaSeleccion, fechaEntrega: fechaElegida || null }),
          })
        )
      )
      onGuardado?.({ franjaHoraria: franjaSeleccion, fechaEntrega: fechaElegida || null })
      setFranjaConfirmada(franjaSeleccion)
      setConfirmado(true)
    } finally {
      setGuardando(false)
    }
  }

  if (confirmado && franjaConfirmada) {
    const fechaTexto = fechaElegida ? formatearFechaLarga(fechaElegida) : soloHoy ? 'hoy' : formatearManana()
    return (
      <div className="text-center">
        <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
        <div className="font-body text-sm text-ink mb-3">
          Su compra se ha realizado con éxito. Usted está recibiendo su pedido el {fechaTexto}, en el horario de{' '}
          {FRANJA_LABEL[franjaConfirmada as '8-13' | '13-19']}. Gracias por su compra.
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
        <div className="flex flex-col gap-2.5 mb-3">
          <button
            type="button"
            onClick={() => setFranjaSeleccion('8-13')}
            disabled={guardando}
            className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
              franjaSeleccion === '8-13' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
            }`}
          >
            8 a 13
          </button>
          <button
            type="button"
            onClick={() => setFranjaSeleccion('13-19')}
            disabled={guardando}
            className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
              franjaSeleccion === '13-19' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
            }`}
          >
            {FRANJA_LABEL['13-19']}
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
        <button
          type="button"
          onClick={confirmar}
          disabled={!franjaSeleccion || guardando}
          className="w-full py-3 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-40"
        >
          {guardando ? 'Guardando...' : 'Continuar'}
        </button>
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
              setFranjaSeleccion('')
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
              onClick={() => setFranjaSeleccion('8-13')}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaSeleccion === '8-13' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              8 a 13
            </button>
            <button
              type="button"
              onClick={() => setFranjaSeleccion('13-19')}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaSeleccion === '13-19' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {FRANJA_LABEL['13-19']}
            </button>
          </div>
          <button
            type="button"
            onClick={confirmar}
            disabled={!franjaSeleccion || guardando}
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
