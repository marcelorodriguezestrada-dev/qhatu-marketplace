// Zonas de envío = las de src/data/zonasPotosi.ts + las que el admin
// agrega desde "Zonas sugeridas" (config/zonasEnvio en Firestore). Las
// sugeridas salen de los compradores: con la casa marcada en el mapa
// pueden escribir una zona que no está en la lista (ej. "Cuarto
// Centenario"); cada pedido así suma esa zona con su punto, y el admin
// la agrega a la lista con un toque.
//
// El costo del envío sale del PUNTO de la entrega (distancia al centro,
// ver costoPorDistancia), no del nombre de la zona: aunque el nombre
// quede mal, se cobra justo.
import { ZONAS_ENVIO_POTOSI, costoPorDistancia, distanciaKm, type ZonaPotosi } from '@/data/zonasPotosi'

export type ZonaEnvio = ZonaPotosi
export type ZonaExtra = { nombre: string; lat: number; lng: number }

export const normZona = (t: string) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function armarZonas(extras: ZonaExtra[] = []): ZonaEnvio[] {
  const vistas = new Set(ZONAS_ENVIO_POTOSI.map((z) => normZona(z.nombre)))
  const nuevas = extras
    .filter((z) => z && z.nombre && typeof z.lat === 'number' && typeof z.lng === 'number' && !vistas.has(normZona(z.nombre)))
    .map((z) => ({ nombre: z.nombre, lat: z.lat, lng: z.lng, costoEnvio: costoPorDistancia(z.lat, z.lng) }))
  return [...ZONAS_ENVIO_POTOSI, ...nuevas]
}

export function zonaMasCercana(zonas: ZonaEnvio[], lat: number, lng: number): ZonaEnvio {
  return zonas.reduce((mejor, z) => (distanciaKm(lat, lng, z.lat, z.lng) < distanciaKm(lat, lng, mejor.lat, mejor.lng) ? z : mejor), zonas[0])
}

export function zonasCercanas(zonas: ZonaEnvio[], lat: number, lng: number, n = 6): ZonaEnvio[] {
  return [...zonas].sort((a, b) => distanciaKm(lat, lng, a.lat, a.lng) - distanciaKm(lat, lng, b.lat, b.lng)).slice(0, n)
}

// "san benito central", "Velarde" (lo de entre paréntesis) → la zona de la lista.
export function buscarZonaEn(zonas: ZonaEnvio[], texto: string): ZonaEnvio | null {
  const t = normZona(texto)
  if (!t) return null
  const sinParentesis = (n: string) => normZona(n.replace(/\(.*\)/g, ' '))
  return (
    zonas.find((z) => normZona(z.nombre) === t) ||
    zonas.find((z) => sinParentesis(z.nombre) === t || normZona(z.nombre.match(/\(([^)]+)\)/)?.[1] || '') === t) ||
    null
  )
}
