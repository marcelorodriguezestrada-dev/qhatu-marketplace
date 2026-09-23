'use client'

import { useEffect, useRef, useState } from 'react'
import { fechaEntregaDefault, proximosDiasHabiles, franjasDisponibles, type ClaveFranja } from '@/lib/entregaDias'

export type Franja = '' | ClaveFranja

export const FRANJA_LABEL: Record<string, string> = {
  '9-13': '9 a 13',
  // La moto sale a las 8:00 y a las 14:00 entre semana (ver
  // src/lib/reparto.ts) — el rango de la tarde arranca ahí, no a las 13.
  '14-19': 'de 14 a 19',
  // Sábado tiene un horario de reparto distinto al resto de la semana.
  '10-13': '10 a 13',
  '14-16': '14 a 16',
  // Claves viejas, de antes de separar el horario de sábado del resto
  // — se mantienen para poder seguir mostrando bien pedidos ya
  // guardados con esos valores (ya no se ofrecen como opción nueva).
  '8-13': '8 a 13',
  '13-19': 'de 14 a 19',
}

function parsearIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// yyyy-mm-dd → "viernes, 26 de septiembre", para el mensaje final de confirmación.
function formatearFechaLarga(iso: string): string {
  return parsearIso(iso).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// El día por default (mañana, salvo que caiga domingo — ver
// fechaEntregaDefault) formateado largo para el mensaje final.
function formatearDefault(): string {
  return fechaEntregaDefault().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
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

  // Franjas válidas para el día que se está por confirmar — cambian
  // según sea sábado (10 a 13 / 14 a 16) o el resto de la semana
  // (9 a 13 / de 14 a 19). Domingo nunca llega acá (ver hayEntregaHoy
  // en /checkout y proximosDiasHabiles, que ya lo excluyen).
  const diaParaFranjas = soloHoy ? new Date() : fechaElegida ? parsearIso(fechaElegida) : fechaEntregaDefault()
  const franjasHoy = franjasDisponibles(diaParaFranjas)

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
    const fechaTexto = fechaElegida ? formatearFechaLarga(fechaElegida) : soloHoy ? 'hoy' : formatearDefault()
    return (
      <div className="text-center">
        <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
        <div className="font-body text-sm text-ink mb-2">
          Su compra se ha realizado con éxito. Usted estará recibiendo su pedido el {fechaTexto}, en el horario de{' '}
          {FRANJA_LABEL[franjaConfirmada]}.
        </div>
        <div className="font-display text-lg font-bold text-teal mb-3">Gracias por su compra.</div>
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
          {franjasHoy.map((clave) => (
            <button
              key={clave}
              type="button"
              onClick={() => setFranjaSeleccion(clave)}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaSeleccion === clave ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {FRANJA_LABEL[clave]}
            </button>
          ))}
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
        {proximosDiasHabiles(7).map((d) => (
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
            {franjasHoy.map((clave) => (
              <button
                key={clave}
                type="button"
                onClick={() => setFranjaSeleccion(clave)}
                disabled={guardando}
                className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                  franjaSeleccion === clave ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
                }`}
              >
                {FRANJA_LABEL[clave]}
              </button>
            ))}
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
