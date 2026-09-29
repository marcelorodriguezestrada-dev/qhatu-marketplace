import { CENTRO_POTOSI, ZONAS_ENVIO_POTOSI } from './zonasPotosi'

// Ciudades donde funciona Clasi Click. Todo lo que no tiene ciudad
// guardada (productos, tiendas, anuncios y profesionales de antes) es
// de Potosí (CIUDAD_POR_DEFECTO).
//
// - activa: si aparece en el selector "📍 Ciudad". El admin la prende o
//   apaga desde Admin → Inicio → Ciudades (config/ciudades en Firestore);
//   el valor de acá es el de arranque.
// - envioClasiClick: si hay envío propio de Clasi Click en esa ciudad
//   (en Potosí sí; en La Paz arranca sin, y envía cada vendedor).
// - regionesIP / ciudadesIP: cómo reconocerla con la ubicación aproximada
//   por IP que da Vercel (x-vercel-ip-country-region / x-vercel-ip-city).
//   OJO: en Bolivia los datos móviles suelen salir por La Paz o Santa
//   Cruz, así que eso solo SUGIERE la ciudad; nunca se filtra sin que la
//   persona la confirme.

export type CiudadId = 'potosi' | 'la-paz'

export type ZonaCiudad = { nombre: string; lat: number; lng: number; grupo?: string }

export type Ciudad = {
  id: CiudadId
  nombre: string
  departamento: string
  centro: { lat: number; lng: number; nombre: string }
  activa: boolean
  envioClasiClick: boolean
  zonas: ZonaCiudad[]
  regionesIP: string[]
  ciudadesIP: string[]
}

export const CIUDAD_POR_DEFECTO: CiudadId = 'potosi'

// Zonas de La Paz y El Alto (El Alto va como zona de La Paz: para el
// comprador es la misma ciudad). Coordenadas aproximadas para arrancar;
// se ajustan cuando se definan las tarifas de envío.
const ZONAS_LA_PAZ: ZonaCiudad[] = [
  { nombre: 'Centro (Plaza Murillo)', lat: -16.4958, lng: -68.1334, grupo: 'Centro' },
  { nombre: 'San Francisco', lat: -16.4964, lng: -68.1375, grupo: 'Centro' },
  { nombre: 'San Pedro', lat: -16.5021, lng: -68.1387, grupo: 'Centro' },
  { nombre: 'Sopocachi', lat: -16.5093, lng: -68.1262, grupo: 'Centro' },
  { nombre: 'Miraflores', lat: -16.4991, lng: -68.1213, grupo: 'Centro' },
  { nombre: 'Max Paredes / Gran Poder', lat: -16.4932, lng: -68.1462, grupo: 'Norte' },
  { nombre: 'Villa Fátima', lat: -16.4842, lng: -68.1183, grupo: 'Norte' },
  { nombre: 'Achachicala', lat: -16.4702, lng: -68.1441, grupo: 'Norte' },
  { nombre: 'Villa Copacabana', lat: -16.4931, lng: -68.1082, grupo: 'Este' },
  { nombre: 'Pampahasi', lat: -16.5031, lng: -68.1012, grupo: 'Este' },
  { nombre: 'Obrajes', lat: -16.5268, lng: -68.1063, grupo: 'Zona Sur' },
  { nombre: 'Irpavi', lat: -16.5202, lng: -68.0772, grupo: 'Zona Sur' },
  { nombre: 'Calacoto', lat: -16.5408, lng: -68.0871, grupo: 'Zona Sur' },
  { nombre: 'San Miguel', lat: -16.5392, lng: -68.0788, grupo: 'Zona Sur' },
  { nombre: 'Achumani', lat: -16.5302, lng: -68.0683, grupo: 'Zona Sur' },
  { nombre: 'Mallasa', lat: -16.5681, lng: -68.0872, grupo: 'Zona Sur' },
  { nombre: 'El Alto — La Ceja', lat: -16.5021, lng: -68.1632, grupo: 'El Alto' },
  { nombre: 'El Alto — Ciudad Satélite', lat: -16.5271, lng: -68.1581, grupo: 'El Alto' },
  { nombre: 'El Alto — 16 de Julio', lat: -16.4901, lng: -68.1852, grupo: 'El Alto' },
  { nombre: 'El Alto — Villa Adela', lat: -16.5183, lng: -68.2002, grupo: 'El Alto' },
  { nombre: 'El Alto — Río Seco', lat: -16.4762, lng: -68.2041, grupo: 'El Alto' },
  { nombre: 'El Alto — Senkata', lat: -16.5601, lng: -68.2003, grupo: 'El Alto' },
]

export const CIUDADES: Ciudad[] = [
  {
    id: 'potosi',
    nombre: 'Potosí',
    departamento: 'Potosí',
    centro: { ...CENTRO_POTOSI, nombre: 'Plaza 10 de Noviembre' },
    activa: true,
    envioClasiClick: true,
    zonas: ZONAS_ENVIO_POTOSI.map((z) => ({ nombre: z.nombre, lat: z.lat, lng: z.lng })),
    regionesIP: ['P'],
    ciudadesIP: ['potosi', 'villa imperial de potosi'],
  },
  {
    id: 'la-paz',
    nombre: 'La Paz',
    departamento: 'La Paz',
    centro: { lat: -16.4964, lng: -68.1375, nombre: 'Plaza San Francisco' },
    activa: false,
    envioClasiClick: false,
    zonas: ZONAS_LA_PAZ,
    regionesIP: ['L'],
    ciudadesIP: ['la paz', 'el alto', 'nuestra senora de la paz', 'viacha', 'achocalla'],
  },
]

export function buscarCiudad(id: string | null | undefined): Ciudad {
  return CIUDADES.find((c) => c.id === id) || CIUDADES.find((c) => c.id === CIUDAD_POR_DEFECTO)!
}

export function esCiudadId(id: unknown): id is CiudadId {
  return typeof id === 'string' && CIUDADES.some((c) => c.id === id)
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Ubicación aproximada por IP (Vercel) → ciudad de Clasi Click, o null
// si no es ninguna de las nuestras (ej: Santa Cruz, o fuera de Bolivia).
export function ciudadDesdeGeoIP(pais: string | null, region: string | null, ciudad: string | null): CiudadId | null {
  if (pais && pais.toUpperCase() !== 'BO') return null
  const c = ciudad ? norm(decodeURIComponent(ciudad)) : ''
  const porCiudad = c ? CIUDADES.find((x) => x.ciudadesIP.includes(c)) : null
  if (porCiudad) return porCiudad.id
  const r = (region || '').toUpperCase().replace(/^BO-/, '')
  const porRegion = r ? CIUDADES.find((x) => x.regionesIP.includes(r)) : null
  return porRegion ? porRegion.id : null
}

// Lo que viene de un formulario → una ciudad válida (Potosí si no).
export function sanearCiudad(v: unknown): CiudadId {
  return esCiudadId(v) ? v : CIUDAD_POR_DEFECTO
}

// Ciudad de un documento guardado (producto, tienda, anuncio,
// profesional). Los de antes no tienen ciudad: son de Potosí.
export function ciudadDe(doc: { ciudad?: unknown } | null | undefined): CiudadId {
  return sanearCiudad(doc?.ciudad)
}

// Profesionales: otras ciudades a las que viaja a atender (sin repetir
// la propia).
export function sanearViajaA(v: unknown, propia: CiudadId): CiudadId[] {
  if (!Array.isArray(v)) return []
  return Array.from(new Set(v.filter(esCiudadId))).filter((c) => c !== propia)
}

// Nombres de zonas de una ciudad para los selectores de zona/barrio.
export function zonasDeCiudad(id: CiudadId): string[] {
  return buscarCiudad(id).zonas.map((z) => z.nombre)
}
