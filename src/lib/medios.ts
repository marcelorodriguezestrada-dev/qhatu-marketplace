// Biblioteca de contenido de marketing (Admin → Marketing → 🎬 Contenido):
// videos e imágenes para las publicaciones del plan de lanzamiento. Los
// archivos viven en Cloudinary (no en el repositorio); acá guardamos solo
// el link. Cloudinary además "edita" por URL: recortar, 9:16, textos y
// logo, y devuelve un MP4 listo para TikTok / Reels.

export type Medio = {
  id: string
  tipo: 'video' | 'imagen'
  nombre: string
  // Cloudinary (subido acá) o un link externo (Drive, YouTube…).
  origen: 'cloudinary' | 'link'
  url: string
  publicId: string | null
  duracion: number | null // segundos (videos)
  ancho: number | null
  alto: number | null
  bytes: number | null
  publicacionId: string | null
  editadoDe: string | null
  createdAt: string
}

export const CARPETA_CLOUDINARY = 'clasiclick-marketing'

export type Edicion = {
  inicio: number
  fin: number
  formato: '9:16' | '1:1' | 'original'
  textoArriba: string
  textoAbajo: string
  logo: boolean
  link: boolean
}

export const EDICION_POR_DEFECTO: Edicion = { inicio: 0, fin: 0, formato: '9:16', textoArriba: '', textoAbajo: '', logo: true, link: true }

// Texto para una capa de Cloudinary: comas y barras van doble escapadas.
function textoCapa(t: string) {
  return encodeURIComponent(t.trim()).replace(/%2C/g, '%252C').replace(/%2F/g, '%252F')
}

// URL de Cloudinary con la edición aplicada (el video o la imagen nueva se
// genera la primera vez que se pide; puede tardar unos segundos).
export function urlEditada(cloud: string, m: Pick<Medio, 'tipo' | 'publicId' | 'duracion'>, e: Edicion, descargar = false): string | null {
  if (!m.publicId) return null
  const partes: string[] = []
  if (m.tipo === 'video' && m.duracion) {
    const fin = e.fin > e.inicio ? Math.min(e.fin, m.duracion) : m.duracion
    if (e.inicio > 0.05 || fin < m.duracion - 0.05) partes.push(`so_${e.inicio.toFixed(1)},eo_${fin.toFixed(1)}`)
  }
  if (e.formato === '9:16') partes.push('c_fill,ar_9:16,w_1080,g_center')
  else if (e.formato === '1:1') partes.push('c_fill,ar_1:1,w_1080,g_center')
  else partes.push('c_limit,w_1080')
  if (e.textoArriba.trim()) partes.push(`l_text:Arial_62_bold:${textoCapa(e.textoArriba)},co_white,b_rgb:00000099,c_fit,w_960/fl_layer_apply,g_north,y_150`)
  if (e.textoAbajo.trim()) partes.push(`l_text:Arial_46_bold:${textoCapa(e.textoAbajo)},co_white,b_rgb:00000099,c_fit,w_960/fl_layer_apply,g_south,y_230`)
  if (e.logo) {
    partes.push('l_text:Arial_46_bold:Clasi,co_white/fl_layer_apply,g_south_east,x_175,y_70')
    partes.push('l_text:Arial_46_bold:Click,co_rgb:16C35B/fl_layer_apply,g_south_east,x_60,y_70')
  }
  if (e.link) partes.push('l_text:Arial_40_bold:clasiclick.com,co_white,b_rgb:0D1526CC/fl_layer_apply,g_south_west,x_60,y_70')
  if (descargar) partes.push('fl_attachment:clasiclick')
  const tipo = m.tipo === 'video' ? 'video' : 'image'
  return `https://res.cloudinary.com/${cloud}/${tipo}/upload/${partes.join('/')}/${m.publicId}.${m.tipo === 'video' ? 'mp4' : 'jpg'}`
}

// Miniatura de un video de Cloudinary (un cuadro del segundo 1).
export function miniaturaVideo(cloud: string, publicId: string) {
  return `https://res.cloudinary.com/${cloud}/video/upload/so_1,c_fill,w_400,h_500/${publicId}.jpg`
}

export const pesoLegible = (b: number | null) => (!b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)
