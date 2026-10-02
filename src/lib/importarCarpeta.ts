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
// Varias fotos del mismo producto: mismo nombre + " (2)", " (3)"… o "_foto2".

export type FotoArchivo = { file: File; ruta: string }
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
export const codigoTienda = (t: string) => normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const PUBLICOS: Record<string, string> = {
  mujer: 'mujer', mujeres: 'mujer', dama: 'mujer', damas: 'mujer', femenino: 'mujer',
  hombre: 'hombre', hombres: 'hombre', varon: 'hombre', varones: 'hombre', caballero: 'hombre', caballeros: 'hombre', masculino: 'hombre',
  nino: 'ninos', ninos: 'ninos', nina: 'ninos', ninas: 'ninos', infantil: 'ninos', kids: 'ninos', bebe: 'ninos', bebes: 'ninos',
  unisex: 'unisex',
}
const TALLES_LETRA = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'unico', 'u'])
const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function esImagen(nombre: string) {
  return EXT_IMAGEN.test(nombre) && !nombre.startsWith('.')
}

// ¿Las fotos sueltas en la carpeta elegida son de UNA tienda (la carpeta)?
// Sí, si no hay subcarpetas y los nombres no empiezan con un código que
// se repite (cachitos_…, cachitos_…).
export function pareceUnaTienda(fotos: FotoArchivo[]): boolean {
  const sueltas = fotos.filter((f) => f.ruta.split('/').filter(Boolean).length === 2 && esImagen(f.ruta))
  if (!sueltas.length || sueltas.length !== fotos.filter((f) => esImagen(f.ruta)).length) return false
  const prefijos = new Set(sueltas.map((f) => normalizar(f.ruta.split('/').pop()!.split('_')[0])))
  return prefijos.size > Math.max(2, sueltas.length / 3)
}

export function leerFotos(fotos: FotoArchivo[], opciones: { unaTienda?: boolean } = {}): { productos: ProductoLeido[]; ignorados: string[] } {
  const grupos = new Map<string, ProductoLeido>()
  const ignorados: string[] = []
  for (const { file, ruta } of fotos) {
    const partes = ruta.split('/').filter(Boolean)
    const archivo = partes[partes.length - 1] || file.name
    if (!esImagen(archivo)) { ignorados.push(ruta); continue }
    let base = archivo.replace(/\.[^.]+$/, '')
    // Fotos extra del mismo producto.
    base = base.replace(/\s*\(\d+\)$/, '').replace(/[_\s-]+foto\s*\d+$/i, '').trim()
    let tokens = base.split('_').map((t) => t.trim()).filter(Boolean)
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
    const clave = `${codigoTienda(tienda)}::${normalizar(base)}`
    const g = grupos.get(clave)
    if (g) {
      g.fotos.push(file)
      continue
    }
    grupos.set(clave, { clave, tienda: codigoTienda(tienda), nombre: capital(nombre), publico, precio, talles, stock, fotos: [file], archivo })
  }
  const productos = [...grupos.values()]
  return { productos, ignorados }
}
