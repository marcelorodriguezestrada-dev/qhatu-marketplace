import { getDb } from '@/lib/firebaseAdmin'
import { CIUDADES, CIUDAD_POR_DEFECTO, registrarCiudades, type Ciudad, type EstadoCiudad, type ZonaCiudad } from '@/data/ciudades'
import { PAISES_MERCADO, sanearPaisMercado, type PaisMercado } from '@/data/paisesMercado'

// Ciudades y países guardados por el admin (solo servidor).
// - config/ciudades: { ciudades: { [id]: { estado, envioClasiClick } }, extras: { [id]: ciudad nueva } }
//   (las configs viejas tienen `activa` en vez de `estado`).
// - config/paises: { paises: { [ISO]: PaisMercado } }
// Además registra las ciudades nuevas en src/data/ciudades.ts, así
// buscarCiudad / sanearCiudad las conocen en este proceso.

export type CiudadInfo = {
  id: string
  nombre: string
  departamento: string
  pais: string
  estado: EstadoCiudad
  envioClasiClick: boolean
  extra: boolean
  centro: Ciudad['centro']
  zonas: ZonaCiudad[]
}

let cache: { hasta: number; datos: { ciudades: CiudadInfo[]; paises: PaisMercado[] } } | null = null

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

export function sanearCiudadExtra(v: any): Ciudad | null {
  const id = String(v?.id || '').trim()
  const nombre = String(v?.nombre || '').trim().slice(0, 60)
  const pais = String(v?.pais || '').trim().toUpperCase()
  const lat = num(v?.centro?.lat)
  const lng = num(v?.centro?.lng)
  if (!/^[a-z0-9-]{2,40}$/.test(id) || !nombre || !/^[A-Z]{2}$/.test(pais) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const zonas: ZonaCiudad[] = (Array.isArray(v?.zonas) ? v.zonas : [])
    .map((z: any) => ({ nombre: String(z?.nombre || '').trim().slice(0, 60), lat: num(z?.lat), lng: num(z?.lng) }))
    .filter((z: ZonaCiudad) => z.nombre)
    .map((z: ZonaCiudad) => ({ nombre: z.nombre, lat: Number.isFinite(z.lat) ? z.lat : lat, lng: Number.isFinite(z.lng) ? z.lng : lng }))
    .slice(0, 80)
  return {
    id,
    nombre,
    pais,
    departamento: String(v?.departamento || '').trim().slice(0, 60),
    centro: { lat, lng, nombre: String(v?.centro?.nombre || 'Centro').trim().slice(0, 80) },
    activa: false,
    envioClasiClick: false,
    zonas,
    regionesIP: [],
    ciudadesIP: [],
    extra: true,
  }
}

export async function cargarCiudadesServidor(fresco = false): Promise<{ ciudades: CiudadInfo[]; paises: PaisMercado[] }> {
  if (!fresco && cache && cache.hasta > Date.now()) return cache.datos
  let guardadas: Record<string, any> = {}
  let extrasGuardadas: Record<string, any> = {}
  let paisesGuardados: Record<string, any> = {}
  try {
    const db = getDb()
    const [c, p] = await Promise.all([db.collection('config').doc('ciudades').get(), db.collection('config').doc('paises').get()])
    guardadas = c.data()?.ciudades || {}
    extrasGuardadas = c.data()?.extras || {}
    paisesGuardados = p.data()?.paises || {}
  } catch (err) {
    console.error('cargarCiudadesServidor', err)
  }
  const extras = Object.values(extrasGuardadas).map(sanearCiudadExtra).filter((c): c is Ciudad => !!c)
  registrarCiudades(extras)

  const ciudades: CiudadInfo[] = [...CIUDADES, ...extras].map((c) => {
    const g = guardadas[c.id] || {}
    let estado: EstadoCiudad = g.estado === 'abierta' || g.estado === 'prueba' || g.estado === 'cerrada' ? g.estado : typeof g.activa === 'boolean' ? (g.activa ? 'abierta' : 'cerrada') : c.extra ? 'prueba' : c.activa ? 'abierta' : 'cerrada'
    if (c.id === CIUDAD_POR_DEFECTO) estado = 'abierta' // Potosí siempre abierta
    return {
      id: c.id,
      nombre: c.nombre,
      departamento: c.departamento,
      pais: c.pais,
      estado,
      envioClasiClick: typeof g.envioClasiClick === 'boolean' ? g.envioClasiClick : c.envioClasiClick,
      extra: !!c.extra,
      centro: c.centro,
      zonas: c.zonas,
    }
  })

  const paises: PaisMercado[] = PAISES_MERCADO.map((b) => sanearPaisMercado(paisesGuardados[b.id] || {}, b) || b)
  for (const [id, v] of Object.entries(paisesGuardados)) {
    if (paises.some((p) => p.id === id)) continue
    const p = sanearPaisMercado({ ...v, id })
    if (p) paises.push(p)
  }
  const datos = { ciudades, paises }
  cache = { hasta: Date.now() + 60_000, datos }
  return datos
}

export function olvidarCacheCiudades() {
  cache = null
}
