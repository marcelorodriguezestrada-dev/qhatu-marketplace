// Arma los productos a importar desde las filas de una planilla de Google
// (la primera fila son los títulos). Columnas, en cualquier orden y con
// nombres parecidos: tienda, producto, precio, público, talles, colores,
// stock, categoría, foto, precio antes, descripción, código.
// La columna foto puede tener links (Drive compartido o web) o nombres de
// archivo que se buscan en la carpeta de fotos elegida; varios separados
// por coma.
import { codigoTienda, esImagen, publicoEnTexto, separarMarcaFoto, type ProductoLeido } from '@/lib/importarCarpeta'

const normalizar = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const ALIAS: Record<string, string[]> = {
  tienda: ['tienda', 'vendedor', 'negocio', 'empresa', 'codigo tienda', 'codigo empresa', 'marca tienda'],
  nombre: ['producto', 'nombre', 'nombre producto', 'titulo', 'articulo', 'descripcion corta'],
  precio: ['precio', 'precio bs', 'precio venta', 'bs', 'valor', 'precio actual'],
  precioAntes: ['precio antes', 'antes', 'precio anterior', 'precio original', 'precio lista'],
  publico: ['publico', 'para', 'genero', 'sexo'],
  talles: ['talles', 'talle', 'tallas', 'talla', 'medidas', 'numero'],
  colores: ['colores', 'color'],
  stock: ['stock', 'cantidad', 'unidades', 'disponible'],
  categoria: ['categoria', 'rubro', 'tipo', 'subcategoria'],
  foto: ['foto', 'fotos', 'imagen', 'imagenes', 'link foto', 'url foto', 'archivo', 'foto archivo'],
  descripcion: ['descripcion', 'detalle', 'descripcion larga'],
  sku: ['codigo', 'sku', 'cod', 'codigo producto', 'id producto', 'referencia', 'ref'],
}

// Si el título no es exacto, por palabra clave ("descripcion foto" → foto,
// "código,legajo" → código, "descripción detallada" → descripción).
const CLAVES: [string, RegExp][] = [
  ['foto', /\b(foto|fotos|imagen|imagenes|archivo)\b/],
  ['precioAntes', /\b(antes|anterior|original|lista)\b/],
  ['precio', /\bprecio\b/],
  ['sku', /\b(codigo|sku|legajo|ref|referencia)\b/],
  ['descripcion', /\bdescripcion\b/],
  ['talles', /\b(talles?|tallas?)\b/],
  ['colores', /\bcolor(es)?\b/],
  ['categoria', /\b(categoria|rubro)\b/],
  ['tienda', /\b(tienda|vendedor|negocio|empresa)\b/],
  ['nombre', /\b(producto|nombre|titulo|articulo)\b/],
  ['publico', /\b(publico|genero)\b/],
  ['stock', /\b(stock|cantidad|unidades)\b/],
]

function mapearColumnas(titulos: string[]) {
  const m: Record<string, number> = {}
  const usadas = new Set<number>()
  titulos.forEach((t, i) => {
    const n = normalizar(t).replace(/ \*$/, '')
    for (const [campo, alias] of Object.entries(ALIAS)) if (m[campo] === undefined && alias.includes(n)) { m[campo] = i; usadas.add(i) }
  })
  titulos.forEach((t, i) => {
    if (usadas.has(i)) return
    const n = normalizar(t)
    const c = CLAVES.find(([campo, re]) => m[campo] === undefined && re.test(n))
    if (c) { m[c[0]] = i; usadas.add(i) }
  })
  // "descripcion corta" puede ser el nombre si no hay columna producto.
  return m
}

const PUBLICOS: Record<string, string> = { mujer: 'mujer', mujeres: 'mujer', dama: 'mujer', damas: 'mujer', femenino: 'mujer', hombre: 'hombre', hombres: 'hombre', varon: 'hombre', caballero: 'hombre', masculino: 'hombre', nino: 'ninos', ninos: 'ninos', nina: 'ninos', ninas: 'ninos', infantil: 'ninos', bebe: 'ninos', unisex: 'unisex', otros: 'unisex' }
const numero = (v: string) => {
  const t = String(v || '').replace(/bs\.?/i, '').replace(/\s/g, '')
  if (!t) return null
  // 1.250,50 → 1250.50 ; 1250.5 → 1250.5
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
const lista = (v: string) => String(v || '').split(/[,;/|]/).map((x) => x.trim()).filter(Boolean)
const baseArchivo = (n: string) => normalizar(n.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)$/, ''))

export function leerSheet(
  filas: string[][],
  archivos: { file: File; ruta: string }[] = []
): { productos: ProductoLeido[]; error?: string; avisos: string[]; columnas: string[] } {
  const col = mapearColumnas(filas[0] || [])
  const columnas = Object.keys(col)
  if (col.nombre === undefined) return { productos: [], avisos: [], columnas, error: 'No encontramos la columna del producto (“producto” o “nombre”).' }
  if (col.tienda === undefined) return { productos: [], avisos: [], columnas, error: 'No encontramos la columna “tienda” (el código o nombre de la tienda de cada producto).' }
  // Fotos locales por nombre de archivo (sin extensión ni "(2)").
  const porNombre = new Map<string, File[]>()
  for (const a of archivos) {
    const nombre = a.ruta.split('/').pop() || a.file.name
    if (!esImagen(nombre)) continue
    const k = baseArchivo(nombre)
    porNombre.set(k, [...(porNombre.get(k) || []), a.file])
  }
  const avisos: string[] = []
  const productos: ProductoLeido[] = []
  const celda = (f: string[], campo: string) => (col[campo] !== undefined ? String(f[col[campo]] ?? '').trim() : '')
  filas.slice(1).forEach((f, i) => {
    const nombre = celda(f, 'nombre')
    const tienda = codigoTienda(celda(f, 'tienda'))
    if (!nombre && !tienda) return
    const fila = i + 2
    if (!nombre || !tienda) { avisos.push(`Fila ${fila}: falta ${!nombre ? 'el producto' : 'la tienda'}`); return }
    const fotosLink: string[] = []
    const fotos: File[] = []
    for (const ref of celda(f, 'foto').split(/[,;\n]+|\s+(?=https?:)/).map((x) => x.trim()).filter(Boolean)) {
      if (/^https?:\/\//i.test(ref)) fotosLink.push(ref)
      else {
        const encontrada = porNombre.get(baseArchivo(ref))
        if (encontrada) fotos.push(...encontrada)
        else avisos.push(`Fila ${fila}: no encontramos la foto “${ref}” en la carpeta`)
      }
    }
    const publico = PUBLICOS[normalizar(celda(f, 'publico'))] || publicoEnTexto(nombre)
    const precio = numero(celda(f, 'precio'))
    if (precio == null) avisos.push(`Fila ${fila}: “${nombre}” sin precio`)
    const stockTxt = celda(f, 'stock')
    productos.push({
      clave: `${tienda}::fila${fila}`,
      tienda,
      nombre: nombre.slice(0, 120),
      publico,
      precio,
      precioAntes: numero(celda(f, 'precioAntes')),
      talles: lista(celda(f, 'talles')),
      colores: lista(celda(f, 'colores')),
      stock: stockTxt === '' ? null : Math.max(0, Math.floor(numero(stockTxt) ?? 0)),
      categoriaTexto: celda(f, 'categoria'),
      descripcion: celda(f, 'descripcion').slice(0, 300),
      sku: celda(f, 'sku').slice(0, 60),
      fotos,
      fotosLink,
      archivo: `fila ${fila}`,
      fila,
    })
  })
  return { productos: unirFotosDelMismo(productos, avisos), avisos, columnas }
}

// Filas del mismo producto con distinta foto ("Banquito a", "Banquito c",
// "Banquito v" de la misma tienda) → un solo producto "Banquito" con todas
// las fotos. Los datos (precio, talles…) salen de la primera fila que los
// tenga.
function unirFotosDelMismo(productos: ProductoLeido[], avisos: string[]): ProductoLeido[] {
  const grupos = new Map<string, ProductoLeido[]>()
  for (const p of productos) {
    const { base, marca } = separarMarcaFoto(p.nombre)
    const k = marca && !p.sku ? `${p.tienda}::${normalizar(base)}` : `${p.tienda}::${p.clave}`
    grupos.set(k, [...(grupos.get(k) || []), p])
  }
  const out: ProductoLeido[] = []
  for (const g of grupos.values()) {
    const [p] = g
    const { base, marca } = separarMarcaFoto(p.nombre)
    if (!marca) { out.push(...g); continue }
    const primero = <T,>(f: (x: ProductoLeido) => T | null | undefined, vacio: (v: T) => boolean = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)) =>
      g.map(f).find((v) => v != null && !vacio(v as T)) ?? f(p)
    out.push({
      ...p,
      nombre: base,
      precio: primero((x) => x.precio) ?? null,
      precioAntes: primero((x) => x.precioAntes) ?? null,
      publico: primero((x) => x.publico) ?? null,
      talles: primero((x) => x.talles) || [],
      colores: primero((x) => x.colores) || [],
      stock: primero((x) => x.stock) ?? null,
      categoriaTexto: primero((x) => x.categoriaTexto) || '',
      descripcion: primero((x) => x.descripcion) || '',
      fotos: g.flatMap((x) => x.fotos),
      fotosLink: g.flatMap((x) => x.fotosLink || []),
      archivo: g.length > 1 ? `filas ${g.map((x) => x.fila).join(', ')}` : p.archivo,
    })
    if (g.length > 1) avisos.push(`Filas ${g.map((x) => x.fila).join(', ')}: “${base}” con ${g.length} fotos (las unimos en un solo producto)`)
  }
  return out
}
