// Tipos compartidos (servidor y navegador) de /mis-estadisticas.
// p = producto, s = servicio (perfil de profesional), a = anuncio.
export type TipoItemEstadistica = 'p' | 's' | 'a'
export type CampoEstadistica = 'vistas' | 'contactos' | 'carrito'

// Día en que se empezó a contar día por día cada producto / servicio /
// anuncio. Antes solo había totales de toda la vida (`vistas` en cada
// documento), que se siguen mostrando como "Total".
export const INICIO_ESTADISTICAS = '2026-10-11'

export const PERIODOS_ESTADISTICAS = [7, 30, 90] as const
export const PERIODO_GRATIS = 7

export type ResumenEstadistica = {
  vistas: number
  contactos: number
  carrito: number
  pedidos: number
  unidades: number
  vendido: number
}

export type PuntoEstadistica = { fecha: string; vistas: number; contactos: number; carrito: number; pedidos: number }

export type ItemEstadistica = {
  id: string
  nombre: string
  imagen?: string
  href: string
  estado?: string
  vistasTotal: number
  contactosTotal?: number
  // Solo con Premium: lo del período elegido, por ítem.
  vistas?: number
  contactos?: number
  carrito?: number
  unidades?: number
  vendido?: number
}

export type SeccionEstadisticas = {
  premium: boolean
  resumen: ResumenEstadistica
  // Solo con Premium: el día a día del período.
  serie?: PuntoEstadistica[]
  items: ItemEstadistica[]
}

export type RespuestaEstadisticas = {
  dias: number
  desde: string
  hasta: string
  pais: string
  productos?: SeccionEstadisticas
  servicios?: SeccionEstadisticas
  anuncios?: SeccionEstadisticas
}
