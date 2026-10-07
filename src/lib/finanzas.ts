// Admin → 💰 Finanzas: ingresos y gastos de Clasi Click (colección
// `finanzas`) y las cuentas del reporte. Los montos son en Bs.

export type TipoMovimiento = 'ingreso' | 'gasto'
export type Movimiento = {
  id: string
  tipo: TipoMovimiento
  fecha: string // YYYY-MM-DD (Bolivia)
  monto: number
  categoria: string
  descripcion: string
  metodo: string
  recurrente: boolean
  origenRecurrente?: string | null
  createdAt: string
}

export const CATEGORIAS_INGRESO = ['Comisión por ventas', 'Envíos cobrados', 'Plan Premium / destacados', 'Publicidad y banners', 'Servicios a tiendas', 'Aporte / inversión', 'Otros ingresos']
export const CATEGORIAS_GASTO = ['Delivery / motos', 'Publicidad (Facebook, TikTok…)', 'Hosting, dominio y software', 'Sueldos y pagos a personas', 'Comisiones bancarias / QR', 'Volantes e impresiones', 'Transporte', 'Internet y teléfono', 'Alquiler', 'Impuestos', 'Otros gastos']
export const METODOS = ['Efectivo', 'QR', 'Transferencia', 'Tarjeta']

export const mesDe = (fecha: string) => fecha.slice(0, 7)
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const nombreMes = (mes: string, largo = false) => {
  const [y, m] = mes.split('-').map(Number)
  const n = MESES[m - 1]
  return largo ? `${n} ${y}` : `${n} ${String(y).slice(2)}`
}
// Lista de meses YYYY-MM desde `desde` hasta `hasta` inclusive.
export function rangoMeses(desde: string, hasta: string) {
  const out: string[] = []
  let [y, m] = desde.split('-').map(Number)
  const [hy, hm] = hasta.split('-').map(Number)
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}
export function sumarMeses(mes: string, n: number) {
  let [y, m] = mes.split('-').map(Number)
  m += n
  while (m > 12) { m -= 12; y++ }
  while (m < 1) { m += 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}`
}

export type ResumenMes = { mes: string; ingresos: number; gastos: number; resultado: number }
export function resumenPorMes(movs: Movimiento[], meses: string[]): ResumenMes[] {
  return meses.map((mes) => {
    const del = movs.filter((x) => mesDe(x.fecha) === mes)
    const ingresos = del.filter((x) => x.tipo === 'ingreso').reduce((s, x) => s + x.monto, 0)
    const gastos = del.filter((x) => x.tipo === 'gasto').reduce((s, x) => s + x.monto, 0)
    return { mes, ingresos, gastos, resultado: ingresos - gastos }
  })
}

export function porCategoria(movs: Movimiento[], tipo: TipoMovimiento) {
  const m: Record<string, number> = {}
  for (const x of movs) if (x.tipo === tipo) m[x.categoria || 'Sin categoría'] = (m[x.categoria || 'Sin categoría'] || 0) + x.monto
  return Object.entries(m).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto)
}

// Variación % (null si no hay base para comparar).
export const variacion = (actual: number, anterior: number) => (anterior ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)

export const bs = (n: number) => `Bs ${Math.round(n).toLocaleString('es-BO')}`
