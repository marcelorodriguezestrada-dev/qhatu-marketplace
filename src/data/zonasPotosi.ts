// Zonas/barrios reales de la ciudad de Potosí, Bolivia — curado a partir
// de un documento oficial de planificación municipal (PDM/GAD Potosí),
// con coordenadas aproximadas (Google Maps) para poder mostrar un mapa
// de referencia y calcular cercanía. No es 100% exhaustivo (la ciudad
// tiene más de 70 zonas registradas) — son las más conocidas/grandes.
//
// IMPORTANTE sobre los precios: son un punto de partida por cercanía al
// centro (3 franjas: Bs 5 / Bs 10 / Bs 15), NO tu tarifa real — ajustalos
// vos según lo que de verdad cobrás por zona. Y algunas coordenadas son
// aproximadas (Google Maps no tiene todos los barrios geocodificados con
// precisión) — si notás alguna mal ubicada, decime cuál y la corrijo.
export type ZonaPotosi = {
  nombre: string
  lat: number
  lng: number
  costoEnvio: number
}

// Lista con precio y coordenadas — la usa el checkout (envío de
// productos) y el mapita de zonas.
export const ZONAS_ENVIO_POTOSI: ZonaPotosi[] = [
  { nombre: 'Centro (Plaza 10 de Noviembre)', lat: -19.5893, lng: -65.7535, costoEnvio: 5 },
  { nombre: 'Santa Rosa', lat: -19.5890, lng: -65.7546, costoEnvio: 5 },
  { nombre: 'San Martín', lat: -19.5886, lng: -65.7477, costoEnvio: 5 },
  { nombre: 'Villa Tomás Frías', lat: -19.5836, lng: -65.7477, costoEnvio: 5 },
  { nombre: 'San Pedro', lat: -19.5949, lng: -65.7528, costoEnvio: 5 },
  { nombre: 'San Benito Central', lat: -19.5916, lng: -65.7602, costoEnvio: 5 },
  { nombre: 'Villa Nueva Imperial (Velarde)', lat: -19.5881, lng: -65.7615, costoEnvio: 5 },
  { nombre: 'Villa Imperial', lat: -19.5747, lng: -65.7593, costoEnvio: 10 },
  { nombre: 'San Juan', lat: -19.5810, lng: -65.7550, costoEnvio: 10 },
  { nombre: 'Concepción', lat: -19.5925, lng: -65.7469, costoEnvio: 10 },
  { nombre: 'San Clemente', lat: -19.5773, lng: -65.7636, costoEnvio: 10 },
  { nombre: 'Chuquimia', lat: -19.5807, lng: -65.7631, costoEnvio: 10 },
  { nombre: 'La Chaca', lat: -19.5841, lng: -65.7668, costoEnvio: 10 },
  { nombre: 'Calvario', lat: -19.5975, lng: -65.7480, costoEnvio: 10 },
  { nombre: 'Villa España', lat: -19.5836, lng: -65.7580, costoEnvio: 10 },
  { nombre: 'San Cristóbal', lat: -19.5981, lng: -65.7436, costoEnvio: 10 },
  { nombre: 'Cantumarca', lat: -19.5856, lng: -65.7803, costoEnvio: 15 },
  { nombre: 'Ciudad Satélite', lat: -19.5700, lng: -65.7684, costoEnvio: 15 },
  { nombre: 'Plan 40', lat: -19.5645, lng: -65.7684, costoEnvio: 15 },
  { nombre: 'Villa Armonía', lat: -19.5814, lng: -65.7684, costoEnvio: 15 },
  { nombre: 'Pampa Ingenio', lat: -19.5926, lng: -65.7424, costoEnvio: 15 },
  { nombre: 'Cerro Rico / Pailaviri', lat: -19.6066, lng: -65.7430, costoEnvio: 15 },
]

// Lista simple de nombres nomás — la usan las páginas que solo
// necesitan elegir una zona sin que importe el precio de envío (por
// ejemplo, un profesional de /publicar-servicio eligiendo en qué zona
// de la ciudad trabaja). Se deriva de la misma lista de arriba para no
// mantener los nombres en dos lugares distintos.
export const ZONAS_POTOSI: string[] = ZONAS_ENVIO_POTOSI.map((z) => z.nombre)
