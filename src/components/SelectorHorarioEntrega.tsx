'use client'

import { useState } from 'react'

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
  const [guardando, setGuardando] = useState(false)

  async function elegir(franja: '8-13' | '13-19', fecha?: string) {
    setGuardando(true)
    setFranjaHoraria(franja)
    try {
      await Promise.all(
        pedidoIds.map((id) =>
          fetch(`/api/pedidos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ franjaHoraria: franja, fechaEntrega: fecha || null }),
          })
        )
      )
      onGuardado?.({ franjaHoraria: franja, fechaEntrega: fecha || null })
    } finally {
      setGuardando(false)
    }
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
        </div>
        {franjaHoraria && !fechaElegida && !guardando && (
          <div className="font-body text-[11px] text-teal mt-2">✓ Guardado.</div>
        )}
        {!soloHoy && (
          <button
            type="button"
            onClick={() => setOtroDia(true)}
            className="w-full text-center font-body text-[12px] text-maroon underline mt-3"
          >
            No puedo ese día, quiero escoger otro
          </button>
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
            onClick={() => setFechaElegida(d.iso)}
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
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => elegir('8-13', fechaElegida)}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaHoraria === '8-13' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              8 a 13
            </button>
            <button
              type="button"
              onClick={() => elegir('13-19', fechaElegida)}
              disabled={guardando}
              className={`w-full py-3 rounded-full border font-body text-sm font-semibold ${
                franjaHoraria === '13-19' ? 'border-maroon bg-maroon text-white' : 'border-line bg-panel text-inksoft'
              }`}
            >
              13 a 19
            </button>
          </div>
          {franjaHoraria && !guardando && <div className="font-body text-[11px] text-teal mt-2">✓ Guardado.</div>}
        </>
      )}

      <button
        type="button"
        onClick={() => {
          setOtroDia(false)
          setFechaElegida('')
          // El resaltado de "mañana" refleja lo que está guardado de
          // verdad — si acá había elegido otro día, ya no vale mostrar
          // ese botón marcado hasta que confirme de nuevo.
          if (fechaElegida) setFranjaHoraria('')
        }}
        className="w-full text-center font-body text-[12px] text-inksoft underline mt-3"
      >
        Volver a las opciones de mañana
      </button>
    </div>
  )
}
