// Volantes de Admin → Marketing. Un volante es una "config":
// - modo 'diseno': nuestro diseño (franja, logo, dos columnas, QR) con un
//   tema de colores y textos editables (a mano o con IA).
// - modo 'imagen': un diseño propio subido (Canva, etc.) al que le
//   estampamos el QR de la campaña y el link.
// La config viaja en la URL de la imagen (?d=…, base64url) para la vista
// previa y la descarga, y se puede guardar como plantilla.

export type CajaVolante = { titulo: string; bajada: string; items: string[] }
export type TextosVolante = {
  titulo: string
  subtitulo: string // "|" corta la línea
  bajada: string
  cajas: CajaVolante[] // 1 o 2
  cta: string
  pie: string
}
export type PosQR = 'abajo-derecha' | 'abajo-izquierda' | 'arriba-derecha' | 'arriba-izquierda' | 'abajo-centro'
export type ConfigVolante = {
  modo: 'diseno' | 'imagen'
  tema: string
  destino: string // '/', '/vender', '/publicar-servicio'
  textos: TextosVolante
  logoUrl?: string
  fondoUrl?: string
  qrPos?: PosQR
  qrTam?: number // % del ancho (12–40)
  mostrarLink?: boolean
}

export type TemaVolante = {
  id: string
  label: string
  fondo: string
  franja: string | null // null = sin franja (título sobre el fondo)
  textoFranja: string
  titulo: string // color del título si no hay franja
  subtitulo: string
  logo: string
  bajada: string
  caja: string
  bordeCaja: string
  cabecera1: string
  cabecera2: string
  textoCabecera: string
  item: string
  bajadaCaja: string
  punto: string
  cta: string
  textoCta: string
  pastilla: string
  textoPastilla: string
  pie: string
}

export const TEMAS_VOLANTE: TemaVolante[] = [
  { id: 'rojo', label: '🔴 Rojo Clasi Click', fondo: '#F8F7F4', franja: '#C41E2A', textoFranja: '#FFFFFF', titulo: '#C41E2A', subtitulo: '#FFFFFF', logo: '#C41E2A', bajada: '#1E2233', caja: '#FFFFFF', bordeCaja: '#E5E0D8', cabecera1: '#C41E2A', cabecera2: '#95131F', textoCabecera: '#FFFFFF', item: '#1E2233', bajadaCaja: '#6B6E7B', punto: '#C41E2A', cta: '#C41E2A', textoCta: '#FFFFFF', pastilla: '#FFFFFF', textoPastilla: '#C41E2A', pie: '#6B6E7B' },
  { id: 'oscuro-verde', label: '🟢 Oscuro y verde', fondo: '#06080D', franja: null, textoFranja: '#FFFFFF', titulo: '#00C853', subtitulo: '#F3F4F6', logo: '#00C853', bajada: '#9AA4B8', caja: '#0F172A', bordeCaja: '#1E293B', cabecera1: '#00C853', cabecera2: '#00C853', textoCabecera: '#06080D', item: '#F3F4F6', bajadaCaja: '#94A3B8', punto: '#00C853', cta: '#00C853', textoCta: '#06080D', pastilla: '#06080D', textoPastilla: '#00C853', pie: '#94A3B8' },
  { id: 'azul', label: '🔵 Azul confianza', fondo: '#F4F7FB', franja: '#1D4ED8', textoFranja: '#FFFFFF', titulo: '#1D4ED8', subtitulo: '#FFFFFF', logo: '#1D4ED8', bajada: '#1E2233', caja: '#FFFFFF', bordeCaja: '#DCE3EE', cabecera1: '#1D4ED8', cabecera2: '#1E3A8A', textoCabecera: '#FFFFFF', item: '#1E2233', bajadaCaja: '#64748B', punto: '#1D4ED8', cta: '#1D4ED8', textoCta: '#FFFFFF', pastilla: '#FFFFFF', textoPastilla: '#1D4ED8', pie: '#64748B' },
  { id: 'naranja', label: '🟠 Naranja oferta', fondo: '#FFF8F0', franja: '#EA580C', textoFranja: '#FFFFFF', titulo: '#EA580C', subtitulo: '#FFFFFF', logo: '#EA580C', bajada: '#1E2233', caja: '#FFFFFF', bordeCaja: '#F3E1CF', cabecera1: '#EA580C', cabecera2: '#9A3412', textoCabecera: '#FFFFFF', item: '#1E2233', bajadaCaja: '#78716C', punto: '#EA580C', cta: '#EA580C', textoCta: '#FFFFFF', pastilla: '#FFFFFF', textoPastilla: '#EA580C', pie: '#78716C' },
  { id: 'andino', label: '🟡 Andino (rojo, amarillo, verde)', fondo: '#FFFBEA', franja: '#B91C1C', textoFranja: '#FDE047', titulo: '#B91C1C', subtitulo: '#FFFFFF', logo: '#15803D', bajada: '#1E2233', caja: '#FFFFFF', bordeCaja: '#F1E4A8', cabecera1: '#15803D', cabecera2: '#B91C1C', textoCabecera: '#FFFFFF', item: '#1E2233', bajadaCaja: '#6B6E7B', punto: '#EAB308', cta: '#15803D', textoCta: '#FFFFFF', pastilla: '#FDE047', textoPastilla: '#14532D', pie: '#6B6E7B' },
]

export function buscarTema(id: string | null | undefined): TemaVolante {
  return TEMAS_VOLANTE.find((t) => t.id === id) || TEMAS_VOLANTE[0]
}

export function textosBase(tipo: string, ciudad: string, gentilicio: string): TextosVolante {
  const C = ciudad.toUpperCase()
  if (tipo === 'vendedores') {
    return {
      titulo: `¿VENDÉS EN ${C}?`,
      subtitulo: 'Publicá gratis y llegá|a más clientes',
      bajada: `La tienda online ${gentilicio}|que trabaja por vos`,
      cajas: [
        { titulo: 'TU TIENDA GRATIS', bajada: 'Sin comisiones para empezar', items: ['Catálogo con fotos y precios', 'Cobrás directo con tu QR', 'Publicación masiva con Excel'] },
        { titulo: 'MÁS CLIENTES', bajada: 'Te conectamos al instante', items: ['Matcheo automático con quien busca', 'Preguntas y ventas en un lugar', 'Coordiná la entrega por WhatsApp'] },
      ],
      cta: 'Registrate gratis y empezá a vender hoy',
      pie: `Vendé en ${ciudad} — fácil, rápido y seguro`,
    }
  }
  if (tipo === 'profesionales') {
    return {
      titulo: `¡PROFESIONALES DE ${C}!`,
      subtitulo: 'Que tus clientes|te encuentren',
      bajada: `El directorio ${gentilicio}|de profesionales y oficios`,
      cajas: [
        { titulo: 'SI OFRECÉS SERVICIOS', bajada: 'Sumate gratis', items: ['Tu perfil con fotos y reseñas', 'Clientes directo a tu WhatsApp', 'Agenda de turnos online'] },
        { titulo: 'SI BUSCÁS A ALGUIEN', bajada: 'Encontrá de confianza', items: ['Electricistas, médicos, abogados…', 'Calificaciones reales', 'Cerca de tu zona'] },
      ],
      cta: 'Anotate gratis en 2 minutos',
      pie: `Profesionales de ${ciudad} en un solo lugar`,
    }
  }
  return {
    titulo: `¡ATENCIÓN ${C}!`,
    subtitulo: 'Llegó la nueva forma de|comprar y vender sin complicaciones',
    bajada: `El primer e-commerce 100% ${gentilicio}|hecho para conectar a nuestra gente`,
    cajas: [
      { titulo: 'SI QUIERES COMPRAR', bajada: 'Todo lo que buscás, en un solo lugar', items: ['Productos y servicios locales', 'Pagá fácil con QR', 'Entrega a domicilio o retiro'] },
      { titulo: 'SI QUIERES VENDER', bajada: 'Publicá y llegá a más clientes', items: ['Publicá tus productos gratis', 'Matcheo automático al instante', 'Coordiná la entrega por WhatsApp'] },
    ],
    cta: 'Apoyemos el comercio y el talento de nuestra tierra',
    pie: `Comprá y vendé en ${ciudad} — fácil, rápido y seguro`,
  }
}

export function destinoDeTipo(tipo: string) {
  return tipo === 'vendedores' ? '/vender' : tipo === 'profesionales' ? '/publicar-servicio' : '/'
}

const corto = (v: unknown, n: number) => String(v ?? '').slice(0, n)

// Limpia una config que viene de la URL o del admin (nunca confiar).
export function sanearConfigVolante(v: any): ConfigVolante {
  const t = v?.textos || {}
  const cajas = (Array.isArray(t.cajas) ? t.cajas : []).slice(0, 2).map((c: any) => ({
    titulo: corto(c?.titulo, 40),
    bajada: corto(c?.bajada, 60),
    items: (Array.isArray(c?.items) ? c.items : []).slice(0, 4).map((i: any) => corto(i, 60)).filter(Boolean),
  }))
  const pos: PosQR[] = ['abajo-derecha', 'abajo-izquierda', 'arriba-derecha', 'arriba-izquierda', 'abajo-centro']
  // Solo imágenes subidas por nuestro /api/upload-image (ImgBB): la imagen
  // se genera en un endpoint público y no debe poder pedir cualquier URL.
  const url = (u: unknown) => (typeof u === 'string' && u.length <= 500 && /^https:\/\/([a-z0-9-]+\.)?ibb\.co\//i.test(u) ? u : undefined)
  return {
    modo: v?.modo === 'imagen' ? 'imagen' : 'diseno',
    tema: buscarTema(v?.tema).id,
    destino: typeof v?.destino === 'string' && v.destino.startsWith('/') && !v.destino.startsWith('//') ? v.destino.slice(0, 80) : '/',
    textos: {
      titulo: corto(t.titulo, 40),
      subtitulo: corto(t.subtitulo, 90),
      bajada: corto(t.bajada, 90),
      cajas,
      cta: corto(t.cta, 70),
      pie: corto(t.pie, 80),
    },
    logoUrl: url(v?.logoUrl),
    fondoUrl: url(v?.fondoUrl),
    qrPos: pos.includes(v?.qrPos) ? v.qrPos : 'abajo-derecha',
    qrTam: Math.min(40, Math.max(12, Number(v?.qrTam) || 22)),
    mostrarLink: v?.mostrarLink !== false,
  }
}

// base64url de un JSON con acentos/emoji (funciona en navegador y Node).
export function codificarConfig(c: ConfigVolante): string {
  const json = JSON.stringify(c)
  const b64 = typeof window === 'undefined' ? Buffer.from(json, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodificarConfig(d: string): ConfigVolante | null {
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(b64, 'base64').toString('utf8')
    return sanearConfigVolante(JSON.parse(json))
  } catch {
    return null
  }
}
