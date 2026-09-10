// Bolivia está en UTC-4 todo el año (no tiene horario de verano). Los
// timestamps que guarda el proyecto (createdAt, ids de
// metricas_diarias) están en UTC — sin este ajuste, un pedido hecho a
// las 21:00 en Potosí quedaría contado como "del día siguiente" en
// cualquier reporte agrupado por día, y la comparación "qué día se
// vende más" saldría corrida.
const OFFSET_MS = 4 * 60 * 60 * 1000

function aFechaBolivia(fecha: Date | string) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Date(d.getTime() - OFFSET_MS)
}

// YYYY-MM-DD en hora boliviana. Se usa como id de documento en
// metricas_diarias, y para agrupar por día cualquier otro timestamp
// (createdAt de pedidos, productos, profesionales).
export function diaBolivia(fecha: Date | string = new Date()) {
  return aFechaBolivia(fecha).toISOString().slice(0, 10)
}

// YYYY-MM, para la vista "por mes".
export function mesBolivia(fecha: Date | string = new Date()) {
  return aFechaBolivia(fecha).toISOString().slice(0, 7)
}

// YYYY, para la vista "por año".
export function anioBolivia(fecha: Date | string = new Date()) {
  return aFechaBolivia(fecha).toISOString().slice(0, 4)
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Día de la semana a partir de una clave YYYY-MM-DD ya calculada con
// diaBolivia (no de un timestamp crudo) — la clave ya representa el
// día calendario boliviano, así que acá se parsea como UTC puro para
// no correrla de nuevo.
export function diaSemanaDesdeClave(claveFecha: string) {
  const [y, m, d] = claveFecha.split('-').map(Number)
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export const ORDEN_DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
