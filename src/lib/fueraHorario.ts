// Compras que alguien quiso hacer fuera de horario (Clasi Click toma
// pedidos de 8 a 20 h, ver tiendaAbierta en entregaDias.ts). Se guarda
// su carrito en `comprasFueraHorario` y se le deja programado un aviso en
// la campanita para cuando abre (8:00 de Bolivia): la notificación se crea
// en el momento con `visibleDesde` y /api/notificaciones no la muestra
// antes de esa hora. Así no depende de un cron.

export const HORA_APERTURA = 8

// Próxima apertura (8:00 de Bolivia = 12:00 UTC) como ISO en UTC.
export function proximaApertura(ahora: Date = new Date()): string {
  const bo = new Date(ahora.getTime() - 4 * 3600_000) // reloj de Bolivia expresado en UTC
  const dia = new Date(Date.UTC(bo.getUTCFullYear(), bo.getUTCMonth(), bo.getUTCDate(), HORA_APERTURA + 4, 0, 0))
  if (bo.getUTCHours() >= HORA_APERTURA) dia.setUTCDate(dia.getUTCDate() + 1)
  return dia.toISOString()
}

export type ItemFueraHorario = { id: string; nombre: string; precio: number; cantidad: number; talla?: string; color?: string; imagen?: string }

export type CompraFueraHorario = {
  id: string
  uid: string
  email: string
  nombre: string
  whatsapp: string
  ciudad: string
  tienda: string | null
  items: ItemFueraHorario[]
  total: number
  intentos: number
  primerIntento: string
  ultimoIntento: string
  avisoEn: string
  notificacionId: string | null
  convertido: boolean
  pedidoId?: string | null
  convertidoAt?: string | null
  contactadoAt?: string | null
}

export function mensajeApertura(items: { nombre: string; cantidad: number }[]) {
  const primero = items[0]?.nombre || 'tus productos'
  const que = items.length > 1 ? `${primero} y ${items.length - 1} producto${items.length - 1 === 1 ? '' : 's'} más` : primero
  return `☀️ ¡Ya abrimos! Dejaste ${que} en tu carrito: terminá tu compra ahora en un toque 🛍️`
}
