import { buscarCiudad } from '@/data/ciudades'

// Plan de lanzamiento (Admin → Marketing → 🚀 Lanzamiento): la fecha, las
// metas, las promos y el calendario de publicaciones por red. Cada
// publicación tiene su propio link rastreable (una campaña de
// src/lib/campanas.ts), así se mide qué trajo cada una.

export const REDES_LANZAMIENTO = [
  { id: 'tiktok', label: 'TikTok', icono: '🎵', color: '#111111' },
  { id: 'instagram', label: 'Instagram', icono: '📸', color: '#C13584' },
  { id: 'facebook', label: 'Facebook', icono: '📘', color: '#1877F2' },
  { id: 'whatsapp', label: 'WhatsApp', icono: '💬', color: '#1FA855' },
] as const
export type RedLanzamiento = (typeof REDES_LANZAMIENTO)[number]['id']

export const FORMATOS = [
  { id: 'video', label: '🎬 Video' },
  { id: 'reel', label: '🎬 Reel' },
  { id: 'imagen', label: '🖼️ Imagen' },
  { id: 'carrusel', label: '🖼️ Carrusel' },
  { id: 'estado', label: '⭕ Estado' },
  { id: 'historia', label: '⭕ Historia' },
] as const

export const ESTADOS_PUBLICACION = [
  { id: 'pendiente', label: '⏳ Por hacer' },
  { id: 'lista', label: '✅ Lista' },
  { id: 'publicada', label: '🚀 Publicada' },
] as const
export type EstadoPublicacion = (typeof ESTADOS_PUBLICACION)[number]['id']

export const OBJETIVOS_PUBLICACION = [
  { id: 'compradores', label: 'Traer compradores', destino: '/' },
  { id: 'vendedores', label: 'Sumar tiendas', destino: '/vender' },
  { id: 'profesionales', label: 'Sumar profesionales', destino: '/publicar-servicio' },
] as const

export type ConfigLanzamiento = {
  fecha: string // yyyy-mm-dd
  ciudad: string
  metas: { visitas: number; registros: number; pedidos: number; vendedores: number }
  // Promos reales del lanzamiento (la IA solo usa estas, no inventa otras).
  promos: string
  redes: RedLanzamiento[]
}

export type Publicacion = {
  id: string
  fecha: string // yyyy-mm-dd
  red: RedLanzamiento
  formato: string
  titulo: string
  idea: string // qué mostrar / guion
  texto: string // caption, con {LINK} donde va el link
  hashtags: string
  objetivo: string
  estado: EstadoPublicacion
  campanaId: string | null
  createdAt: string
}

export const CONFIG_POR_DEFECTO: ConfigLanzamiento = {
  fecha: '2026-11-02',
  ciudad: 'potosi',
  metas: { visitas: 3000, registros: 100, pedidos: 30, vendedores: 10 },
  promos: '1 año gratis para las 10 primeras tiendas. Cupón de envío gratis en la primera compra.',
  redes: ['tiktok', 'instagram', 'facebook', 'whatsapp'],
}

const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : def)
export const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function sanearConfig(v: any): ConfigLanzamiento {
  const d = CONFIG_POR_DEFECTO
  return {
    fecha: esFecha(v?.fecha) ? v.fecha : d.fecha,
    ciudad: typeof v?.ciudad === 'string' && v.ciudad ? v.ciudad.slice(0, 40) : d.ciudad,
    metas: {
      visitas: num(v?.metas?.visitas, d.metas.visitas),
      registros: num(v?.metas?.registros, d.metas.registros),
      pedidos: num(v?.metas?.pedidos, d.metas.pedidos),
      vendedores: num(v?.metas?.vendedores, d.metas.vendedores),
    },
    promos: typeof v?.promos === 'string' ? v.promos.slice(0, 500) : d.promos,
    redes: Array.isArray(v?.redes) ? (v.redes.filter((r: string) => REDES_LANZAMIENTO.some((x) => x.id === r)) as RedLanzamiento[]) : d.redes,
  }
}

export function sanearPublicacion(v: any): Omit<Publicacion, 'id' | 'createdAt' | 'campanaId'> | null {
  if (!esFecha(v?.fecha)) return null
  const red = REDES_LANZAMIENTO.find((r) => r.id === v?.red)?.id
  if (!red) return null
  const titulo = String(v?.titulo || '').trim().slice(0, 100)
  if (!titulo) return null
  return {
    fecha: v.fecha,
    red,
    formato: FORMATOS.some((f) => f.id === v?.formato) ? v.formato : red === 'whatsapp' ? 'estado' : red === 'tiktok' ? 'video' : 'imagen',
    titulo,
    idea: String(v?.idea || '').trim().slice(0, 1200),
    texto: String(v?.texto || '').trim().slice(0, 2200),
    hashtags: String(v?.hashtags || '').trim().slice(0, 300),
    objetivo: OBJETIVOS_PUBLICACION.some((o) => o.id === v?.objetivo) ? v.objetivo : 'compradores',
    estado: ESTADOS_PUBLICACION.some((e) => e.id === v?.estado) ? v.estado : 'pendiente',
  }
}

// yyyy-mm-dd ± días (en UTC, sin problemas de hora).
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400_000)
}

// Las 4 fases, a partir de la fecha del lanzamiento.
export function fasesLanzamiento(fecha: string) {
  return [
    { id: 'preparacion', label: 'Preparación', desde: sumarDias(fecha, -28), hasta: sumarDias(fecha, -15), que: 'Cuentas en las redes, primeras tiendas y productos, contenido grabado.' },
    { id: 'expectativa', label: 'Expectativa', desde: sumarDias(fecha, -14), hasta: sumarDias(fecha, -1), que: '“Se viene”: adelantos, tiendas que se suman, cuenta regresiva.' },
    { id: 'lanzamiento', label: 'Lanzamiento', desde: fecha, hasta: sumarDias(fecha, 6), que: 'Abrimos: promos, cómo comprar, primeras compras.' },
    { id: 'crecimiento', label: 'Crecimiento', desde: sumarDias(fecha, 7), hasta: sumarDias(fecha, 30), que: 'Testimonios, ofertas de las tiendas, sumar más vendedores.' },
  ]
}
export function faseDe(fecha: string, dia: string) {
  const fases = fasesLanzamiento(fecha)
  return fases.find((f) => dia >= f.desde && dia <= f.hasta) || (dia < fases[0].desde ? fases[0] : fases[3])
}

// Sin IA: una semana tipo según la fase (para no quedar sin calendario).
export function calendarioPlantilla(cfg: ConfigLanzamiento, desde: string, dias: number) {
  const ciudad = buscarCiudad(cfg.ciudad).nombre
  const out: Omit<Publicacion, 'id' | 'createdAt' | 'campanaId'>[] = []
  for (let i = 0; i < dias; i++) {
    const dia = sumarDias(desde, i)
    const fase = faseDe(cfg.fecha, dia).id
    const dow = new Date(`${dia}T12:00:00Z`).getUTCDay()
    const faltan = diasEntre(dia, cfg.fecha)
    const plan: [RedLanzamiento, string, string, string][] = []
    if (fase === 'preparacion' || fase === 'expectativa') {
      if (dow === 1 || dow === 4) plan.push(['tiktok', 'video', faltan > 0 ? `Se viene Clasi Click a ${ciudad}` : 'Ya abrimos', 'Video corto (9–12 s): calles de la ciudad, texto “Algo nuevo llega a ' + ciudad + '”, logo al final.'])
      if (dow === 2) plan.push(['instagram', 'carrusel', 'Qué vas a encontrar', 'Carrusel de 5 fotos: productos reales de las primeras tiendas.'])
      if (dow === 3) plan.push(['facebook', 'imagen', 'Buscamos tiendas', `Imagen para grupos de compra-venta: ${cfg.promos.split('.')[0]}.`])
      if (dow === 5) plan.push(['whatsapp', 'estado', `Faltan ${faltan} días`, 'Estado con la cuenta regresiva y el logo.'])
      if (dow === 6) plan.push(['instagram', 'reel', 'Tienda que se suma', 'Reel mostrando una tienda que ya está en Clasi Click.'])
    } else {
      if (dow !== 0) plan.push(['tiktok', 'video', dow % 2 ? 'Cómo comprar en 3 toques' : 'Producto del día', 'Grabá la pantalla: buscar, agregar al carrito y pagar con QR.'])
      if (dow === 1 || dow === 3 || dow === 5) plan.push(['instagram', 'reel', 'Ofertas de la semana', 'Reel con 3 productos en oferta y su precio.'])
      if (dow === 2 || dow === 4) plan.push(['facebook', 'imagen', 'Envío a tu casa', 'Imagen: “Pedí hoy y recibí mañana”. Publicá en 3 grupos de la ciudad.'])
      if (dow === 6 || dow === 0) plan.push(['whatsapp', 'estado', 'Promo del finde', `Estado con la promo: ${cfg.promos.split('.')[1] || cfg.promos}.`])
    }
    for (const [red, formato, titulo, idea] of plan) {
      if (!cfg.redes.includes(red)) continue
      out.push({ fecha: dia, red, formato, titulo, idea, texto: `${titulo} 🛍️\nClasi Click: comprá en las tiendas de ${ciudad} y recibí en tu casa.\n👉 {LINK}`, hashtags: red === 'tiktok' || red === 'instagram' ? `#${ciudad.replace(/\s+/g, '')} #Bolivia #ClasiClick #ComprasOnline` : '', objetivo: titulo.includes('tiendas') || titulo.includes('Tienda') ? 'vendedores' : 'compradores', estado: 'pendiente' })
    }
  }
  return out
}
