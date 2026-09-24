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

// El express se toma solo en compras hechas antes de las 17:00 — más
// tarde ya no hay margen para prepararlo y entregarlo el mismo día.
// Desde esa hora el botón queda deshabilitado en el checkout (y la API
// de pedidos también lo rechaza, con la hora de Bolivia).
export const HORA_CORTE_EXPRESS = 17

export function envioExpressDisponible(ahora: Date = new Date()): boolean {
  return hayEntregaHoy(ahora) && ahora.getHours() < HORA_CORTE_EXPRESS
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

// Horario de atención: 8:00 a 20:00. Fuera de ese rango no se puede
// avanzar al pago — no hay nadie para confirmar el comprobante ni
// preparar el pedido hasta que vuelva a abrir.
export function tiendaAbierta(ahora: Date = new Date()): boolean {
  const hora = ahora.getHours()
  return hora >= 8 && hora < 20
}

export function mensajeTiendaCerrada(ahora: Date = new Date()): string {
  // Entre medianoche y las 8 todavía es "hoy" que abre; de 20 en
  // adelante ya hay que esperar al día siguiente.
  return ahora.getHours() < 8 ? 'La tienda está cerrada, abre hoy a las 8 am.' : 'La tienda está cerrada, abre mañana a las 8 am.'
}

export type ClaveFranja = '9-13' | '14-19' | '10-13' | '14-16'

// Los sábados el reparto tiene otro horario que el resto de la semana
// (domingo directamente no reparte, ver esDomingo/hayEntregaHoy).
export function franjasDisponibles(fecha: Date): ClaveFranja[] {
  return fecha.getDay() === 6 ? ['10-13', '14-16'] : ['9-13', '14-19']
}
