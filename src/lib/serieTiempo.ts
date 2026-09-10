import { diaBolivia, diaSemanaDesdeClave, ORDEN_DIAS_SEMANA } from './fechaBolivia'

// Un punto de la línea de tiempo. El campo `clave` es la fecha
// (YYYY-MM-DD a nivel día, YYYY-MM a nivel mes, YYYY a nivel año, o el
// nombre del día de semana en el agrupado por día de semana) — el
// nombre es genérico porque la misma forma de dato sirve para las
// cuatro vistas.
export type PuntoMetrica = {
  clave: string
  visitas: number
  vistasProductos: number
  vistasProfesionales: number
  clicsWhatsapp: number
  busquedasProductos: number
  busquedasServicios: number
  pedidos: number
  facturado: number
  productosPublicados: number
  profesionalesPublicados: number
}

const CAMPOS_NUMERICOS = [
  'visitas', 'vistasProductos', 'vistasProfesionales', 'clicsWhatsapp',
  'busquedasProductos', 'busquedasServicios', 'pedidos', 'facturado',
  'productosPublicados', 'profesionalesPublicados',
] as const

function puntoVacio(clave: string): PuntoMetrica {
  return {
    clave, visitas: 0, vistasProductos: 0, vistasProfesionales: 0, clicsWhatsapp: 0,
    busquedasProductos: 0, busquedasServicios: 0, pedidos: 0, facturado: 0,
    productosPublicados: 0, profesionalesPublicados: 0,
  }
}

// Arma el mapa fecha -> PuntoMetrica (día a día) combinando dos fuentes
// de datos bien distintas:
// - `metricas_diarias`: visitas, vistas y clics — solo tiene historia
//   desde que se agregó esta instrumentación, no hacia atrás.
// - pedidos, productos y profesionales, agrupados por su propio
//   `createdAt` — esto sí tiene historia completa desde el día 1, sin
//   esperar a acumular nada nuevo.
export function construirSerieDiaria(params: {
  metricasDiariasDocs: { id: string; data: any }[]
  pedidos: { createdAt?: string; total?: number }[]
  productos: { createdAt?: string }[]
  profesionales: { createdAt?: string }[]
}): PuntoMetrica[] {
  const mapa = new Map<string, PuntoMetrica>()
  const obtener = (clave: string) => {
    if (!mapa.has(clave)) mapa.set(clave, puntoVacio(clave))
    return mapa.get(clave)!
  }

  for (const doc of params.metricasDiariasDocs) {
    const p = obtener(doc.id)
    p.visitas = Number(doc.data?.visitas || 0)
    p.vistasProductos = Number(doc.data?.vistasProductos || 0)
    p.vistasProfesionales = Number(doc.data?.vistasProfesionales || 0)
    p.clicsWhatsapp = Number(doc.data?.clicsWhatsapp || 0)
    p.busquedasProductos = Number(doc.data?.busquedasProductos || 0)
    p.busquedasServicios = Number(doc.data?.busquedasServicios || 0)
  }

  for (const pedido of params.pedidos) {
    if (!pedido.createdAt) continue
    const p = obtener(diaBolivia(pedido.createdAt))
    p.pedidos += 1
    p.facturado += Number(pedido.total || 0)
  }

  for (const producto of params.productos) {
    if (!producto.createdAt) continue
    obtener(diaBolivia(producto.createdAt)).productosPublicados += 1
  }

  for (const profesional of params.profesionales) {
    if (!profesional.createdAt) continue
    obtener(diaBolivia(profesional.createdAt)).profesionalesPublicados += 1
  }

  return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave))
}

function restarDias(fechaISO: string, dias: number) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - dias)
  return dt.toISOString().slice(0, 10)
}

// Versión "continua" de los últimos N días de calendario: a diferencia
// de la serie completa (que solo tiene una entrada para los días con
// algún dato), esta rellena con ceros los días sin actividad — para
// que el gráfico de barras se vea con un día al lado del otro, sin
// huecos que lo hagan parecer más angosto o más ancho de lo que es.
export function ultimosDiasContinuos(serie: PuntoMetrica[], dias: number): PuntoMetrica[] {
  const mapa = new Map(serie.map((p) => [p.clave, p]))
  const hoy = diaBolivia()
  const resultado: PuntoMetrica[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = restarDias(hoy, i)
    resultado.push(mapa.get(fecha) || puntoVacio(fecha))
  }
  return resultado
}

// Reagrupa una serie diaria ya armada en buckets por mes (YYYY-MM) o
// por año (YYYY).
export function reagruparPor(serie: PuntoMetrica[], nivel: 'mes' | 'anio'): PuntoMetrica[] {
  const largoClave = nivel === 'mes' ? 7 : 4
  const mapa = new Map<string, PuntoMetrica>()
  for (const punto of serie) {
    const clave = punto.clave.slice(0, largoClave)
    const acumulado = mapa.has(clave) ? mapa.get(clave)! : mapa.set(clave, puntoVacio(clave)).get(clave)!
    for (const campo of CAMPOS_NUMERICOS) {
      acumulado[campo] += punto[campo]
    }
  }
  return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave))
}

// Agrupa toda la serie diaria por día de la semana (Lunes..Domingo) —
// para contestar directo "¿qué día se mueve más?", usando toda la
// historia disponible de una sola vez.
export function agruparPorDiaSemana(serie: PuntoMetrica[]): PuntoMetrica[] {
  const mapa = new Map<string, PuntoMetrica>()
  for (const dia of ORDEN_DIAS_SEMANA) mapa.set(dia, puntoVacio(dia))
  for (const punto of serie) {
    const dia = diaSemanaDesdeClave(punto.clave)
    const acumulado = mapa.get(dia)
    if (!acumulado) continue
    for (const campo of CAMPOS_NUMERICOS) {
      acumulado[campo] += punto[campo]
    }
  }
  return ORDEN_DIAS_SEMANA.map((dia) => mapa.get(dia)!)
}

// Suma las métricas de la serie diaria entre dos fechas (formato
// YYYY-MM-DD): desde "desdeExclusive" (sin incluir) hasta "hastaInclusive"
// (incluyendo). Como las claves son YYYY-MM-DD, la comparación de
// texto ya ordena cronológicamente sin tener que parsear cada fecha.
function sumarRangoFechas(serie: PuntoMetrica[], desdeExclusive: string, hastaInclusive: string) {
  const tramo = serie.filter((p) => p.clave > desdeExclusive && p.clave <= hastaInclusive)
  return {
    visitas: tramo.reduce((s, p) => s + p.visitas, 0),
    pedidos: tramo.reduce((s, p) => s + p.pedidos, 0),
    facturado: tramo.reduce((s, p) => s + p.facturado, 0),
  }
}

// Compara los últimos 7 días de calendario contra los 7 anteriores —
// para saber, de un vistazo, si esta semana viene mejor o peor que la
// pasada (visitas, pedidos, facturado). Usa fechas de calendario
// reales (no "los últimos 7 puntos de la serie"), porque la serie
// puede tener huecos en días sin ninguna actividad.
export function compararSemanas(serie: PuntoMetrica[]) {
  const hoy = diaBolivia()
  const hace7 = restarDias(hoy, 7)
  const hace14 = restarDias(hoy, 14)
  const estaSemana = sumarRangoFechas(serie, hace7, hoy)
  const semanaPasada = sumarRangoFechas(serie, hace14, hace7)
  function cambio(actual: number, anterior: number) {
    if (anterior === 0) return actual > 0 ? null : 0
    return Math.round(((actual - anterior) / anterior) * 100)
  }
  return {
    estaSemana,
    semanaPasada,
    cambioVisitas: cambio(estaSemana.visitas, semanaPasada.visitas),
    cambioPedidos: cambio(estaSemana.pedidos, semanaPasada.pedidos),
    cambioFacturado: cambio(estaSemana.facturado, semanaPasada.facturado),
  }
}
