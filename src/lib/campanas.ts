// Campañas de marketing del admin (Admin → Marketing): cada una tiene un
// código y un link rastreable (…?c=CODIGO). Quien entra por ese link
// queda "marcado" 30 días en su navegador y lo que haga después (se
// registra, abre su tienda, se anota como profesional, compra) suma a
// esa campaña.

export const CANALES_CAMPANA = [
  { id: 'facebook', label: 'Facebook', icono: '📘' },
  { id: 'marketplace', label: 'Marketplace (mensajes)', icono: '🏪' },
  { id: 'instagram', label: 'Instagram', icono: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icono: '💬' },
  { id: 'tiktok', label: 'TikTok', icono: '🎵' },
  { id: 'volante', label: 'Volante / afiche (QR)', icono: '🖨️' },
  { id: 'otro', label: 'Otro', icono: '📣' },
] as const

export const OBJETIVOS_CAMPANA = [
  { id: 'compradores', label: 'Traer compradores', destino: '/' },
  { id: 'vendedores', label: 'Sumar vendedores', destino: '/vender' },
  { id: 'profesionales', label: 'Sumar profesionales', destino: '/publicar-servicio' },
  { id: 'anuncios', label: 'Que publiquen anuncios', destino: '/publicar-anuncio' },
] as const

export type Campana = {
  id: string // = código
  nombre: string
  canal: string
  objetivo: string
  destino: string
  ciudad: string
  activa: boolean
  createdAt: string
  visitas: number
  registros: number
  vendedores: number
  profesionales: number
  anuncios: number
  pedidos: number
  ventasBs: number
}

export const METRICAS_CAMPANA = ['visitas', 'registros', 'vendedores', 'profesionales', 'anuncios', 'pedidos', 'ventasBs'] as const
export type MetricaCampana = (typeof METRICAS_CAMPANA)[number]

export function codigoCampana(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return `${base || 'campana'}-${Math.random().toString(36).slice(2, 6)}`
}

export function esCodigoCampana(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9-]{3,40}$/.test(v)
}

export function linkCampana(site: string, c: { id: string; destino: string }) {
  const destino = c.destino.startsWith('/') ? c.destino : '/'
  return `${site}${destino}${destino.includes('?') ? '&' : '?'}c=${c.id}`
}
