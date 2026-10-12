'use client'

import { sanearLinkVideollamada, type ReservasProfesional } from '@/lib/reservas'

// Checklist "¿Cómo te reservan?": calendario de turnos en el consultorio,
// reuniones por videollamada, las dos, o ninguna (solo WhatsApp).
export default function CampoReservas({
  valor,
  onChange,
  link,
  onLink,
  premium,
  className = '',
}: {
  valor: ReservasProfesional
  onChange: (v: ReservasProfesional) => void
  link: string
  onLink: (v: string) => void
  premium?: boolean
  className?: string
}) {
  const linkInvalido = !!link.trim() && !sanearLinkVideollamada(link)
  return (
    <div className={`bg-panelalt border border-line rounded-lg p-3 ${className}`}>
      <div className="font-body text-xs font-semibold text-ink mb-0.5">📅 ¿Cómo te reservan?</div>
      <div className="font-body text-[11px] text-inksoft mb-2">
        Marcá solo lo que usás. Si no marcás nada, en tu perfil queda solo el botón de WhatsApp.
        {premium === false && ' El calendario de reservas se activa con Premium.'}
      </div>
      <label className="flex items-start gap-2 font-body text-sm text-ink mb-1.5 cursor-pointer">
        <input type="checkbox" checked={valor.consultorio} onChange={(e) => onChange({ ...valor, consultorio: e.target.checked })} className="accent-teal mt-1" />
        <span>🏢 Turnos en mi consultorio, local u oficina <span className="block text-[11px] text-inksoft">Ej: médico, dentista, peluquería, abogado con estudio.</span></span>
      </label>
      <label className="flex items-start gap-2 font-body text-sm text-ink cursor-pointer">
        <input type="checkbox" checked={valor.videollamada} onChange={(e) => onChange({ ...valor, videollamada: e.target.checked })} className="accent-teal mt-1" />
        <span>🎥 Reuniones por videollamada (Google Meet, Zoom) <span className="block text-[11px] text-inksoft">Ej: consultoría, clases, asesoría, psicología online.</span></span>
      </label>
      {valor.videollamada && (
        <div className="mt-2 pl-6">
          <input
            value={link}
            onChange={(e) => onLink(e.target.value)}
            placeholder="Tu link de Meet o Zoom (ej: meet.google.com/abc-defg-hij)"
            className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
          />
          <div className={`font-body text-[11px] mt-1 ${linkInvalido ? 'text-maroon' : 'text-inksoft'}`}>
            {linkInvalido ? 'Ese link no parece de Meet, Zoom, Teams o Jitsi.' : 'Opcional: si lo dejás vacío, creamos una sala de videollamada gratis (Jitsi) para cada turno.'}
          </div>
        </div>
      )}
    </div>
  )
}
