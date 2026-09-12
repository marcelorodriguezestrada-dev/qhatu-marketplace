// Lógica de reparto: agrupa los pedidos pagados en las dos salidas
// diarias de la moto (8:00 y 14:00) y arma el orden de entrega
// optimizado por cercanía (vecino más próximo, arrancando desde el
// depósito) usando la ubicación que el comprador compartió al hacer el
// pedido con envío.

// Punto de partida de la moto — se puede configurar por variable de
// entorno; si no está cargada, usamos un punto central de La Paz como
// referencia razonable.
export const DEPOSITO = {
  lat: Number(process.env.NEXT_PUBLIC_DEPOSITO_LAT) || -16.5,
  lng: Number(process.env.NEXT_PUBLIC_DEPOSITO_LNG) || -68.1193,
}

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export type Franja = '08:00' | '14:00'

// A qué salida le toca un pedido, según la hora en la que se confirmó
// el pago. Antes de las 8, entra en la salida de las 8. Entre las 8 y
// las 14, entra en la de las 14. Después de las 14, ya no llega a
// ninguna salida de hoy — queda para la de mañana a las 8, que es la
// misma sección "08:00" (esta vista es del día a día, no un calendario:
// lo que importa es en qué salida entra, no si es hoy o mañana).
export function calcularFranja(fecha: Date): Franja {
  const hora = fecha.getHours()
  if (hora < 8) return '08:00'
  if (hora < 14) return '14:00'
  return '08:00'
}

type ConUbicacion = { lat?: number | null; lng?: number | null }

// Vecino más próximo: en cada paso, de las paradas que quedan, elige la
// más cercana a donde está "parada" la moto en ese momento. No es el
// óptimo matemático perfecto (eso es NP-difícil), pero para un puñado
// de entregas por salida da una ruta sensata sin vueltas de más — y es
// instantáneo de calcular, no hace falta un servicio de ruteo externo.
// Las paradas sin ubicación (el comprador no la compartió) van al final,
// en el orden en que llegaron — hay que confirmar la dirección a mano.
export function ordenarPorCercania<T extends ConUbicacion>(paradas: T[], origen: { lat: number; lng: number } = DEPOSITO): T[] {
  const conUbicacion = paradas.filter((p) => p.lat != null && p.lng != null)
  const sinUbicacion = paradas.filter((p) => p.lat == null || p.lng == null)

  const restantes = [...conUbicacion]
  const ruta: T[] = []
  let actual = origen

  while (restantes.length > 0) {
    let mejorIdx = 0
    let mejorDist = Infinity
    restantes.forEach((p, i) => {
      const d = distanciaKm(actual, { lat: p.lat as number, lng: p.lng as number })
      if (d < mejorDist) {
        mejorDist = d
        mejorIdx = i
      }
    })
    const [elegido] = restantes.splice(mejorIdx, 1)
    ruta.push(elegido)
    actual = { lat: elegido.lat as number, lng: elegido.lng as number }
  }

  return [...ruta, ...sinUbicacion]
}
