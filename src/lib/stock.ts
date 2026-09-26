// Stock de productos. `stock` es opcional:
//  - null / sin cargar → sin control de stock (como hasta ahora).
//  - número → unidades disponibles. Se descuenta al crear el pedido y se
//    devuelve si el pedido se cancela o se anula.

export const UMBRAL_ULTIMAS = 3

export function sanearStock(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : null
}

export function tieneControlStock(p: { stock?: number | null }): p is { stock: number } {
  return typeof p.stock === 'number'
}

export function agotado(p: { stock?: number | null }): boolean {
  return tieneControlStock(p) && p.stock <= 0
}

// "¡Últimas N unidades!" cuando quedan pocas.
export function ultimasUnidades(p: { stock?: number | null }): number | null {
  return tieneControlStock(p) && p.stock > 0 && p.stock <= UMBRAL_ULTIMAS ? p.stock : null
}
