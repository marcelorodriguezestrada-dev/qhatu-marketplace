// Zonas/barrios reales de la ciudad de Potosí, Bolivia — curado a partir
// de un documento oficial de planificación municipal (PDM/GAD Potosí),
// con coordenadas aproximadas (Google Maps) para poder mostrar un mapa
// de referencia y calcular cercanía. No es 100% exhaustivo (la ciudad
// tiene más de 70 zonas registradas) — son las más conocidas/grandes.
//
// IMPORTANTE sobre los precios: se calculan automáticamente según la
// distancia real de cada zona al centro (Plaza 10 de Noviembre), no
// están asignados a mano — así el mapa sale en anillos concéntricos
// limpios (verde en el centro, naranja a media distancia, rojo lejos)
// en vez de una mezcla irregular. Son un punto de partida, NO tu tarifa
// real — ajustalos vos según lo que de verdad cobrás por zona. Y
// algunas coordenadas son aproximadas (Google Maps no tiene todos los
// barrios geocodificados con precisión) — si notás alguna mal ubicada,
// decime cuál y la corrijo.
export type ZonaPotosi = {
  nombre: string
  lat: number
  lng: number
  costoEnvio: number
}

const CENTRO_POTOSI = { lat: -19.5893, lng: -65.7535 } // Plaza 10 de Noviembre

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Umbrales elegidos mirando la distribución real de distancias de estas
// 22 zonas (van de 0 a ~3,2 km del centro): hasta 1 km, Bs 5; de 1 a 2
// km, Bs 10; más de 2 km, Bs 15. Da una franja verde chica y compacta
// en el centro, un anillo naranja mediano, y rojo en los barrios más
// alejados — el patrón concéntrico que se ve en un mapa de reparto real.
function costoPorDistancia(lat: number, lng: number): number {
  const d = distanciaKm(CENTRO_POTOSI.lat, CENTRO_POTOSI.lng, lat, lng)
  if (d <= 1) return 5
  if (d <= 2) return 10
  return 15
}

const COORDENADAS_ZONAS: { nombre: string; lat: number; lng: number }[] = [
  { nombre: 'Centro (Plaza 10 de Noviembre)', lat: -19.5893, lng: -65.7535 },
  { nombre: 'Santa Rosa', lat: -19.5890, lng: -65.7546 },
  { nombre: 'San Martín', lat: -19.5886, lng: -65.7477 },
  { nombre: 'Villa Tomás Frías', lat: -19.5836, lng: -65.7477 },
  { nombre: 'San Pedro', lat: -19.5949, lng: -65.7528 },
  { nombre: 'San Benito Central', lat: -19.5916, lng: -65.7602 },
  { nombre: 'Villa Nueva Imperial (Velarde)', lat: -19.5881, lng: -65.7615 },
  { nombre: 'Villa Imperial', lat: -19.5747, lng: -65.7593 },
  { nombre: 'San Juan', lat: -19.5810, lng: -65.7550 },
  { nombre: 'Concepción', lat: -19.5925, lng: -65.7469 },
  { nombre: 'San Clemente', lat: -19.5773, lng: -65.7636 },
  { nombre: 'Chuquimia', lat: -19.5807, lng: -65.7631 },
  { nombre: 'La Chaca', lat: -19.5841, lng: -65.7668 },
  { nombre: 'Calvario', lat: -19.5975, lng: -65.7480 },
  { nombre: 'Villa España', lat: -19.5836, lng: -65.7580 },
  { nombre: 'San Cristóbal', lat: -19.5981, lng: -65.7436 },
  { nombre: 'Cantumarca', lat: -19.5856, lng: -65.7803 },
  { nombre: 'Ciudad Satélite', lat: -19.5700, lng: -65.7684 },
  { nombre: 'Plan 40', lat: -19.5645, lng: -65.7684 },
  { nombre: 'Villa Armonía', lat: -19.5814, lng: -65.7684 },
  { nombre: 'Pampa Ingenio', lat: -19.5926, lng: -65.7424 },
  { nombre: 'Cerro Rico / Pailaviri', lat: -19.6066, lng: -65.7430 },
]

// Lista con precio y coordenadas — la usa el checkout (envío de
// productos) y el mapita de zonas. El costo sale de costoPorDistancia(),
// no de un número tipeado a mano por zona.
export const ZONAS_ENVIO_POTOSI: ZonaPotosi[] = COORDENADAS_ZONAS.map((z) => ({
  ...z,
  costoEnvio: costoPorDistancia(z.lat, z.lng),
}))

// Lista simple de nombres nomás — la usan las páginas que solo
// necesitan elegir una zona sin que importe el precio de envío (por
// ejemplo, un profesional de /publicar-servicio eligiendo en qué zona
// de la ciudad trabaja). Se deriva de la misma lista de arriba para no
// mantener los nombres en dos lugares distintos.
export const ZONAS_POTOSI: string[] = ZONAS_ENVIO_POTOSI.map((z) => z.nombre)

// Agrupado en "Zona 1 / Zona 2 / Zona 3" según el mismo costo de envío
// por distancia de arriba (Bs 5 / 10 / 15) — así el selector del
// checkout no es una lista larga de 22 barrios de un tirón: primero se
// elige la zona (con su precio), y recién ahí aparecen los barrios de
// esa zona.
export type GrupoZonaPotosi = { id: string; label: string; costoEnvio: number; barrios: string[] }

export const ZONAS_AGRUPADAS: GrupoZonaPotosi[] = (() => {
  const costosOrdenados = [...new Set(ZONAS_ENVIO_POTOSI.map((z) => z.costoEnvio))].sort((a, b) => a - b)
  return costosOrdenados.map((costo, i) => ({
    id: `zona-${i + 1}`,
    label: `Zona ${i + 1}`,
    costoEnvio: costo,
    barrios: ZONAS_ENVIO_POTOSI.filter((z) => z.costoEnvio === costo).map((z) => z.nombre),
  }))
})()

// A qué grupo (Zona 1/2/3) pertenece un barrio puntual — para cuando
// hay que arrancar el selector ya con algo elegido, o para reflejar la
// zona detectada automáticamente por ubicación.
export function grupoDeBarrio(nombreBarrio: string): GrupoZonaPotosi | undefined {
  return ZONAS_AGRUPADAS.find((g) => g.barrios.includes(nombreBarrio))
}

// El barrio conocido más cercano a una coordenada — se usa cuando el
// comprador comparte su ubicación en el checkout, para completarle la
// zona y el barrio solo, sin que tenga que buscarlo a mano en la lista.
export function barrioMasCercano(lat: number, lng: number): ZonaPotosi {
  let mejor = ZONAS_ENVIO_POTOSI[0]
  let mejorDistancia = Infinity
  for (const z of ZONAS_ENVIO_POTOSI) {
    const d = distanciaKm(lat, lng, z.lat, z.lng)
    if (d < mejorDistancia) {
      mejorDistancia = d
      mejor = z
    }
  }
  return mejor
}
