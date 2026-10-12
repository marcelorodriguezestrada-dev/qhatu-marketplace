// Cómo se reserva con un profesional — lo elige él con un checklist
// (Mi perfil, Publicar servicio, Admin → Servicios):
// - consultorio: calendario de turnos en su consultorio / local / oficina.
// - videollamada: calendario de reuniones online (Google Meet, Zoom…).
//   Si pegó su link de Meet, va ese; si no, armamos una sala de Jitsi
//   gratis para cada turno.
// Ninguna marcada = sin calendario, solo "Contactar por WhatsApp".
// Perfiles viejos (sin `reservas`): consultorio, como era antes.

export type ModalidadTurno = 'consultorio' | 'videollamada'

export type ReservasProfesional = { consultorio: boolean; videollamada: boolean }

export function reservasDe(p: { reservas?: any } | null | undefined): ReservasProfesional {
  const r = p?.reservas
  if (!r || typeof r !== 'object') return { consultorio: true, videollamada: false }
  return { consultorio: !!r.consultorio, videollamada: !!r.videollamada }
}

export function sanearReservas(v: any): ReservasProfesional {
  return { consultorio: !!v?.consultorio, videollamada: !!v?.videollamada }
}

export function modalidadesDe(p: { reservas?: any } | null | undefined): ModalidadTurno[] {
  const r = reservasDe(p)
  return [...(r.consultorio ? (['consultorio'] as const) : []), ...(r.videollamada ? (['videollamada'] as const) : [])]
}

// Solo links de videollamada reconocibles (Meet, Zoom, Teams, Jitsi, Whereby).
export function sanearLinkVideollamada(v: unknown): string {
  const t = String(v || '').trim().slice(0, 300)
  if (!t) return ''
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const host = new URL(url).hostname.toLowerCase()
    return /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.jit\.si|whereby\.com)$/.test(host) ? url : ''
  } catch {
    return ''
  }
}

// Sala de Jitsi propia del turno (gratis, sin cuenta).
export function salaJitsi(turnoId: string) {
  return `https://meet.jit.si/ClasiClick-${turnoId}`
}

export const LABEL_MODALIDAD: Record<ModalidadTurno, string> = {
  consultorio: '🏢 En el consultorio',
  videollamada: '🎥 Videollamada',
}
