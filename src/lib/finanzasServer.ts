// Validación de un movimiento de 💰 Finanzas (ver src/lib/finanzas.ts).
export function limpiarMovimiento(b: any, completo: boolean): { datos: Record<string, unknown> } | { error: string } {
  const d: Record<string, unknown> = {}
  if (completo || b.tipo !== undefined) {
    if (b.tipo !== 'ingreso' && b.tipo !== 'gasto') return { error: 'Elegí si es ingreso o gasto.' }
    d.tipo = b.tipo
  }
  if (completo || b.monto !== undefined) {
    const n = Math.round(Number(String(b.monto).replace(',', '.')) * 100) / 100
    if (!(n > 0) || n > 10_000_000) return { error: 'Poné un monto mayor a 0.' }
    d.monto = n
  }
  if (completo || b.fecha !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha || ''))) return { error: 'Falta la fecha.' }
    d.fecha = b.fecha
  }
  if (completo || b.categoria !== undefined) {
    const c = String(b.categoria || '').trim().slice(0, 60)
    if (!c) return { error: 'Elegí una categoría.' }
    d.categoria = c
  }
  if (completo || b.descripcion !== undefined) d.descripcion = String(b.descripcion || '').trim().slice(0, 200)
  if (completo || b.metodo !== undefined) d.metodo = String(b.metodo || '').trim().slice(0, 30)
  if (completo || b.recurrente !== undefined) d.recurrente = !!b.recurrente
  return { datos: d }
}
