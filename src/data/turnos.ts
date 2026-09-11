// Sistema de turnos para profesionales Premium.
//
// El horario NO es una única lista de horas iguales para todos los
// días: cada profesional puede tener "bloques" distintos — ej. Lunes a
// Viernes de 19:00 a 21:00, Sábados de 9:00 a 14:00, Domingos todo el
// día — cada uno con su propio rango horario y cada cuánto se puede
// sacar turno dentro de ese rango (cada 30 min, cada 60 min, etc.).

export type BloqueHorario = {
  id: string
  dias: number[]        // 0=domingo, 1=lunes, ... 6=sábado
  desde: string         // 'HH:MM'
  hasta: string         // 'HH:MM' (tiene que ser mayor a "desde")
  intervaloMin: number  // cada cuántos minutos hay un turno posible (30, 60...)
}

export type HorarioProfesional = { bloques: BloqueHorario[] }

export const HORARIO_VACIO: HorarioProfesional = { bloques: [] }

export const DIAS_SEMANA = [
  { id: 0, label: 'Domingo', corto: 'Dom' },
  { id: 1, label: 'Lunes', corto: 'Lun' },
  { id: 2, label: 'Martes', corto: 'Mar' },
  { id: 3, label: 'Miércoles', corto: 'Mié' },
  { id: 4, label: 'Jueves', corto: 'Jue' },
  { id: 5, label: 'Viernes', corto: 'Vie' },
  { id: 6, label: 'Sábado', corto: 'Sáb' },
]

export const INTERVALOS_TURNO = [
  { min: 30, label: 'Cada 30 min' },
  { min: 60, label: 'Cada 1 hora' },
  { min: 90, label: 'Cada 1h 30' },
  { min: 120, label: 'Cada 2 horas' },
]

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function minutosAHora(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Genera las horas reservables de un bloque, ej. desde=19:00 hasta=21:00
// intervaloMin=30 → ['19:00','19:30','20:00','20:30']. La última hora
// generada siempre queda antes de "hasta" (no se ofrece un turno que
// empiece justo cuando cierra).
export function generarHorasDeBloque(bloque: Pick<BloqueHorario, 'desde' | 'hasta' | 'intervaloMin'>): string[] {
  const inicio = minutosDesdeMedianoche(bloque.desde)
  const fin = minutosDesdeMedianoche(bloque.hasta)
  const horas: string[] = []
  if (fin <= inicio || bloque.intervaloMin <= 0) return horas
  for (let m = inicio; m < fin; m += bloque.intervaloMin) {
    horas.push(minutosAHora(m))
  }
  return horas
}

// Todos los días de la semana en los que el profesional tiene AL MENOS
// un bloque cargado (unión de todos los bloques).
export function diasConAgenda(horario: HorarioProfesional): number[] {
  const set = new Set<number>()
  for (const b of horario.bloques) for (const d of b.dias) set.add(d)
  return [...set].sort()
}

// Todas las horas reservables para un día de semana puntual (0-6),
// juntando los bloques que apliquen a ese día. Si dos bloques se
// pisaran (no debería pasar si se cargan bien), igual queda una lista
// sin duplicados.
export function horasDisponiblesDia(horario: HorarioProfesional, diaSemana: number): string[] {
  const set = new Set<string>()
  for (const b of horario.bloques) {
    if (b.dias.includes(diaSemana)) {
      for (const h of generarHorasDeBloque(b)) set.add(h)
    }
  }
  return [...set].sort()
}

export type DiaTurno = {
  iso: string   // '2026-07-28' — lo que se guarda en la base
  label: string // 'Lun 28' — lo que se muestra en la UI
}

// Genera los próximos días (a partir de mañana) que caigan en algún
// día con agenda cargada, hasta juntar `cantidad`.
export function getProximosDiasSegunHorario(horario: HorarioProfesional, cantidad = 10): DiaTurno[] {
  const diasPermitidos = diasConAgenda(horario)
  if (diasPermitidos.length === 0) return []
  const dias: DiaTurno[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1) // arrancamos mañana, no hoy
  let vueltas = 0

  while (dias.length < cantidad && vueltas < 60) {
    const diaSemana = cursor.getDay()
    if (diasPermitidos.includes(diaSemana)) {
      const iso = cursor.toISOString().slice(0, 10)
      const corto = DIAS_SEMANA[diaSemana].corto
      dias.push({ iso, label: `${corto} ${cursor.getDate()}` })
    }
    cursor.setDate(cursor.getDate() + 1)
    vueltas++
  }

  return dias
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export function validarBloque(b: any): b is BloqueHorario {
  return (
    b &&
    typeof b.id === 'string' &&
    Array.isArray(b.dias) &&
    b.dias.length > 0 &&
    b.dias.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    typeof b.desde === 'string' && HORA_REGEX.test(b.desde) &&
    typeof b.hasta === 'string' && HORA_REGEX.test(b.hasta) &&
    minutosDesdeMedianoche(b.hasta) > minutosDesdeMedianoche(b.desde) &&
    Number.isInteger(b.intervaloMin) && b.intervaloMin >= 10 && b.intervaloMin <= 240
  )
}

export function validarHorario(horario: any): horario is HorarioProfesional {
  return horario && Array.isArray(horario.bloques) && horario.bloques.every(validarBloque)
}
