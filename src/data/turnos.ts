// Sistema de turnos para profesionales Premium. A diferencia del
// consultorio original (un horario fijo en el código, igual para
// todos los días), acá cada profesional carga SU propio horario:
// qué días de la semana atiende y a qué horas — ver
// /api/profesionales/[id]/horarios.

export type HorarioProfesional = {
  dias: number[] // 0=domingo, 1=lunes, ... 6=sábado
  horas: string[] // ['09:00', '10:30', ...] en el orden que las cargó
}

export const HORARIO_VACIO: HorarioProfesional = { dias: [], horas: [] }

export const DIAS_SEMANA = [
  { id: 0, label: 'Domingo', corto: 'Dom' },
  { id: 1, label: 'Lunes', corto: 'Lun' },
  { id: 2, label: 'Martes', corto: 'Mar' },
  { id: 3, label: 'Miércoles', corto: 'Mié' },
  { id: 4, label: 'Jueves', corto: 'Jue' },
  { id: 5, label: 'Viernes', corto: 'Vie' },
  { id: 6, label: 'Sábado', corto: 'Sáb' },
]

export type DiaTurno = {
  iso: string   // '2026-07-28' — lo que se guarda en la base
  label: string // 'Lun 28' — lo que se muestra en la UI
}

// Genera los próximos días (a partir de mañana) que caigan en alguno
// de los `diasSemanaPermitidos` del profesional, hasta juntar
// `cantidad`. Si el profesional no cargó ningún día, devuelve [].
export function getProximosDiasSegunHorario(diasSemanaPermitidos: number[], cantidad = 10): DiaTurno[] {
  if (!diasSemanaPermitidos || diasSemanaPermitidos.length === 0) return []
  const dias: DiaTurno[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1) // arrancamos mañana, no hoy
  let vueltas = 0

  while (dias.length < cantidad && vueltas < 60) {
    const diaSemana = cursor.getDay()
    if (diasSemanaPermitidos.includes(diaSemana)) {
      const iso = cursor.toISOString().slice(0, 10)
      const corto = DIAS_SEMANA[diaSemana].corto
      dias.push({ iso, label: `${corto} ${cursor.getDate()}` })
    }
    cursor.setDate(cursor.getDate() + 1)
    vueltas++
  }

  return dias
}

export function validarHorario(horario: any): horario is HorarioProfesional {
  return (
    horario &&
    Array.isArray(horario.dias) &&
    horario.dias.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Array.isArray(horario.horas) &&
    horario.horas.every((h: any) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h))
  )
}
