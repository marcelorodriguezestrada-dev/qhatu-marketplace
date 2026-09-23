// No hay reparto los domingos — la moto no sale ese día. Toda fecha de
// entrega que el checkout le promete al comprador (la de "mañana" por
// default, el envío express de "hoy mismo", o el picker de "otro día")
// tiene que evitar caer domingo.

export function esDomingo(fecha: Date): boolean {
  return fecha.getDay() === 0
}

// Fecha de entrega por default: al día siguiente de `base` (normalmente
// el momento del pago) — si ese día siguiente cae domingo, se corre al
// lunes, porque ese día no hay reparto.
export function fechaEntregaDefault(base: Date = new Date()): Date {
  const entrega = new Date(base)
  entrega.setDate(entrega.getDate() + 1)
  if (esDomingo(entrega)) entrega.setDate(entrega.getDate() + 1)
  return entrega
}

// Envío express (entrega el mismo día en que se paga) no tiene sentido
// ofrecerlo un domingo — no hay reparto ese día.
export function hayEntregaHoy(ahora: Date = new Date()): boolean {
  return !esDomingo(ahora)
}

// Próximos días hábiles (sin domingo) para elegir en "otro día",
// empezando el día después de `desde` (normalmente la fecha de entrega
// por default, ya corrida si hacía falta).
export function proximosDiasHabiles(cantidad: number, desde: Date = fechaEntregaDefault()): { iso: string; label: string }[] {
  const dias: { iso: string; label: string }[] = []
  const cursor = new Date(desde)
  while (dias.length < cantidad) {
    cursor.setDate(cursor.getDate() + 1)
    if (esDomingo(cursor)) continue
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const label = cursor.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })
    dias.push({ iso, label })
  }
  return dias
}
