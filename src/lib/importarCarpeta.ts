// Lee los nombres de las fotos de una carpeta para la importación masiva.
//
// Estructura recomendada (una subcarpeta por tienda):
//   Productos/cachitos/blusa-flores_ninos_85_4-6-8.jpg
//   Productos/cachitos/blusa-flores_ninos_85_4-6-8 (2).jpg   ← otra foto del mismo
// o todo junto con la tienda adelante:
//   Productos/cachitos_blusa-flores_ninos_85.jpg
//
// Nombre: producto _ público _ precio _ talles (solo el producto es
// obligatorio; el resto en cualquier orden). Se reconoce:
//  - público: mujer, dama, hombre, varon, caballero, nino(s), nina(s), infantil, unisex
//  - precio: un número (85, 85.50, 85bs, bs85)
//  - talles: con guiones (4-6-8, 36-37, s-m-l) o "t38"
//  - stock: "x5" o "stock5"
// Varias fotos del mismo producto: mismo nombre + " (2)", " (3)"… o "_foto2"
// (o "niño1", "niño2": el número pegado al final no es parte del nombre).

export type FotoArchivo = { file: File; ruta: string }
// Una foto de la compu (file) o de una carpeta de Drive (link).
export type FuenteFoto = { ruta: string; file?: File; link?: string }
export type ProductoLeido = {
  clave: string
  tienda: string // código, ej "cachitos"
  nombre: string
  publico: string | null
  precio: number | null
  talles: string[]
  stock: number | null
  fotos: File[]
  archivo: string // nombre original de la primera foto (pista para la IA)
  // Solo desde Google Sheets:
  fotosLink?: string[] // fotos por link (Drive compartido o web)
  colores?: string[]
  categoriaTexto?: string // lo que diga la columna "categoría" (se busca el rubro)
  precioAntes?: number | null
  descripcion?: string
  sku?: string // código del producto de la tienda (para reconocerlo al reimportar)
  fila?: number // fila de la planilla
}

// Clave estable para reconocer el mismo producto al volver a importar
// (se guarda en el producto como claveImportacion).
export const claveImportacion = (p: { tienda: string; sku?: string; nombre: string }) =>
  `${p.tienda}::${p.sku ? 'sku:' + codigoTienda(p.sku) : codigoTienda(p.nombre)}`.slice(0, 120)

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// "T.Luna lunera" y "Luna lunera" son la misma tienda: se saca el "T." / "Tienda".
export const codigoTienda = (t: string) =>
  normalizar(t).replace(/^\s*(t|tda|tienda)\s*[.:]\s*|^\s*tienda\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const PUBLICOS: Record<string, string> = {
  mujer: 'mujer', mujeres: 'mujer', dama: 'mujer', damas: 'mujer', femenino: 'mujer',
  hombre: 'hombre', hombres: 'hombre', varon: 'hombre', varones: 'hombre', caballero: 'hombre', caballeros: 'hombre', masculino: 'hombre',
  nino: 'ninos', ninos: 'ninos', nina: 'ninos', ninas: 'ninos', infantil: 'ninos', kids: 'ninos', bebe: 'ninos', bebes: 'ninos',
  unisex: 'unisex',
}
// Público escrito dentro del nombre ("Polera niña", "ajuar RN", "traje caballero").
export function publicoEnTexto(texto: string): string | null {
  const palabras = normalizar(texto).split(/[^a-z0-9]+/)
  for (const w of palabras) if (PUBLICOS[w]) return PUBLICOS[w]
  if (palabras.some((w) => w === 'rn' || w === 'bb' || w === 'recien')) return 'ninos'
  return null
}
// Nombre que no dice qué es el producto: el que le pone la cámara, el
// celular o un generador de imágenes ("Generated Image gr7r8mgr7r",
// "IMG_2034", "WhatsApp Image 2026-10-05", "DSC0012", "cied4ecied4ecied").
// Ahí el nombre lo pone la IA mirando la foto.
export function nombreGenerico(nombre: string): boolean {
  const t = normalizar(String(nombre || '')).replace(/\.[a-z0-9]{3,4}$/, '').replace(/[_-]+/g, ' ').trim()
  if (!t) return true
  if (/\b(generated image|gemini|chatgpt image|dall ?e|midjourney|whatsapp image|screenshot|captura de pantalla|photo|image|imagen|foto|img|dsc|dcim|pxl|mvimg|wp|sin titulo|untitled)\b/.test(t) && !/[a-z]{4,}/.test(t.replace(/\b(generated|image|gemini|chatgpt|whatsapp|screenshot|captura|de|pantalla|photo|imagen|foto|img|dsc|dcim|pxl|mvimg|sin|titulo|untitled|copia|copy)\b/g, '').replace(/\b\w*\d\w*\b/g, ''))) return true
  // Todo son códigos (letras y números mezclados, sin palabras).
  return t.split(' ').every((w) => /\d/.test(w) || (w.length >= 8 && !/[aeiou]{1}[^aeiou]{0,2}[aeiou]/.test(w)) || /(.{3,})\1/.test(w))
}

// Marca de foto al final del nombre: "Banquito a", "Banquito c",
// "Banquito v" (o "Banquito 1", "2"…) son el MISMO producto con varias
// fotos. Una sola letra o número suelto al final; S/M/L no, porque
// suelen ser el talle ("Remera M").
export function separarMarcaFoto(nombre: string): { base: string; marca: string | null } {
  const m = String(nombre || '').trim().match(/^(.*[^\s])\s+([a-z0-9])$/i)
  if (!m || /^[sml]$/i.test(m[2]) || (m[1].match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length < 3) return { base: String(nombre || '').trim(), marca: null }
  return { base: m[1].trim(), marca: m[2] }
}

const TALLES_LETRA = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'unico', 'u'])
const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function esImagen(nombre: string) {
  return EXT_IMAGEN.test(nombre) && !nombre.startsWith('.')
}

// ¿Las fotos sueltas en la carpeta elegida son de UNA tienda (la carpeta)?
// Sí, si no hay subcarpetas y los nombres no traen la tienda adelante:
// sin "_" ("blusa flores.jpg") o con público/precio/talles después del
// primer "_" ("blusa_ninos_85.jpg"). "cachitos_blusa.jpg" → varias tiendas.
const esDato = (tok: string) => {
  const n = normalizar(tok.trim())
  return !!PUBLICOS[n] || /^(?:bs\.?)?\d{1,6}(?:[.,]\d{1,2})?(?:bs)?$/.test(n) || /^(?:x|stock)\d{1,4}$/.test(n) || /^t(?:alle)?(\d{1,3}|xs|s|m|l|xl|xxl)$/.test(n) || (n.includes('-') && n.split('-').every((p) => /^\d{1,3}(\.5)?$/.test(p) || TALLES_LETRA.has(p)))
}
export function pareceUnaTienda(fotos: FuenteFoto[]): boolean {
  const sueltas = fotos.filter((f) => f.ruta.split('/').filter(Boolean).length === 2 && esImagen(f.ruta))
  if (!sueltas.length || sueltas.length !== fotos.filter((f) => esImagen(f.ruta)).length) return false
  const tokens = sueltas.map((f) => f.ruta.split('/').pop()!.replace(/\.[^.]+$/, '').split('_').filter((t) => t.trim()))
  // Sin tienda adelante: sin "_", con público/precio después, o un nombre de cámara/IA ("Gemini_Generated_Image_x").
  const sinTienda = tokens.filter((t, i) => t.length < 2 || esDato(t[1]) || nombreGenerico(sueltas[i].ruta.split('/').pop()!)).length
  return sinTienda > sueltas.length / 2
}

export function leerFotos(fotos: FuenteFoto[], opciones: { unaTienda?: boolean } = {}): { productos: ProductoLeido[]; ignorados: string[] } {
  const grupos = new Map<string, ProductoLeido>()
  const ignorados: string[] = []
  for (const { file, link, ruta } of fotos) {
    const partes = ruta.split('/').filter(Boolean)
    const archivo = partes[partes.length - 1] || file?.name || ''
    if (!esImagen(archivo)) { ignorados.push(ruta); continue }
    let base = archivo.replace(/\.[^.]+$/, '')
    // Fotos extra del mismo producto.
    base = base.replace(/\s*\(\d+\)$/, '').replace(/[_\s-]+foto\s*\d+$/i, '').replace(/([a-zñ])\d$/i, '$1').trim()
    // Separador tienda/producto: "_" (o ":" si se usó por error, ej "T.Genesis:NN niña").
    let tokens = base.replace(/^([^_:]+):(?=[^_]*$|[^:]*_)/, '$1_').split('_').map((t) => t.trim()).filter(Boolean)
    // Tienda: la carpeta que contiene la foto (si hay subcarpeta), o el primer pedazo del nombre.
    let tienda = partes.length >= 3 || (opciones.unaTienda && partes.length === 2) ? partes[partes.length - 2] : ''
    if (!tienda) {
      if (tokens.length < 2) { ignorados.push(ruta); continue }
      tienda = tokens[0]
      tokens = tokens.slice(1)
    }
    let nombre = ''
    let publico: string | null = null
    let precio: number | null = null
    let stock: number | null = null
    let talles: string[] = []
    const resto: string[] = []
    tokens.forEach((tok, i) => {
      const n = normalizar(tok)
      if (i === 0) { nombre = tok; return }
      if (PUBLICOS[n]) { publico = PUBLICOS[n]; return }
      const mStock = n.match(/^(?:x|stock)(\d{1,4})$/)
      if (mStock) { stock = Number(mStock[1]); return }
      const mPrecio = n.match(/^(?:bs\.?)?(\d{1,6}(?:[.,]\d{1,2})?)(?:bs)?$/)
      if (mPrecio && !n.includes('-')) { precio = Number(mPrecio[1].replace(',', '.')); return }
      const mTalle = n.match(/^t(?:alle)?(\d{1,3}|xs|s|m|l|xl|xxl)$/)
      if (mTalle) { talles = [mTalle[1].toUpperCase()]; return }
      const piezas = n.split('-').filter(Boolean)
      if (piezas.length >= 2 && piezas.every((p) => /^\d{1,3}(\.5)?$/.test(p) || TALLES_LETRA.has(p))) { talles = piezas.map((p) => p.toUpperCase()); return }
      resto.push(tok)
    })
    // Lo que no se reconoció se suma al nombre (ej "blusa_flores_rojas").
    nombre = [nombre, ...resto].join(' ').replace(/[-.]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!nombre) { ignorados.push(ruta); continue }
    if (!publico) publico = publicoEnTexto(nombre)
    nombre = separarMarcaFoto(nombre).base
    const clave = `${codigoTienda(tienda)}::${normalizar(nombre)}`
    const g = grupos.get(clave)
    if (g) {
      if (file) g.fotos.push(file)
      if (link) g.fotosLink = [...(g.fotosLink || []), link]
      continue
    }
    grupos.set(clave, { clave, tienda: codigoTienda(tienda), nombre: capital(nombre), publico, precio, talles, stock, fotos: file ? [file] : [], ...(link ? { fotosLink: [link] } : {}), archivo })
  }
  const productos = [...grupos.values()]
  return { productos, ignorados }
}
