// "Armar planilla": de una carpeta de fotos (de la compu o de Drive) sale
// la planilla de productos lista para completar precios y volver a
// importar desde Google Sheets. Cada foto/producto es una fila con la
// tienda, el nombre, el público, los colores y la categoría adivinados
// del nombre del archivo, el link a la foto y una columna "vista" con la
// miniatura (=IMAGE).
import type { ProductoLeido } from '@/lib/importarCarpeta'

export type RubroPlano = { id: string; label: string; grupo?: string; categoriaId: string; categoriaLabel: string }

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export const rutaDe = (r: RubroPlano) => [r.categoriaLabel, r.grupo, r.label].filter(Boolean).join(' > ')

// Palabras del nombre que no dicen qué es el producto.
const RELLENO = new Set(['nino', 'ninos', 'nina', 'ninas', 'bebe', 'bebes', 'mujer', 'hombre', 'dama', 'caballero', 'unisex', 'infantil', 'recien', 'nacido', 'nacida', 'piezas', 'pieza', 'para', 'con', 'sin', 'color', 'colores', 'modelo', 'nuevo', 'nueva', 'talle', 'talla', 'estampado', 'estampada', 'rayas', 'osito', 'mickey', 'snoopy', 'kitty', 'fiesta'])
export const COLORES = ['negro', 'blanco', 'rojo', 'azul', 'celeste', 'verde', 'amarillo', 'naranja', 'rosa', 'fucsia', 'violeta', 'lila', 'gris', 'marron', 'beige', 'camel', 'crema', 'bordo', 'dorado', 'plateado', 'turquesa', 'coral', 'nude', 'mostaza', 'natural']
// Cómo se le dice en la calle → cómo se llama el rubro.
const SINONIMOS: Record<string, string> = {
  palazzo: 'pantalones', palazos: 'pantalones', jogger: 'pantalones', buzo: 'buzos', polera: 'remeras', polo: 'remeras', playera: 'remeras',
  zapas: 'zapatillas', tenis: 'zapatillas', ajuar: 'conjuntos', batita: 'batas', jardinero: 'enteritos', mameluco: 'enteritos', enterizo: 'enteritos',
  sastrero: 'trajes', terno: 'trajes', chompa: 'sweaters', saco: 'sacos', casaca: 'camperas', chamarra: 'camperas', calceta: 'medias', calcetines: 'medias',
  leggings: 'calzas', leggins: 'calzas', bodies: 'bodys', body: 'bodys', gorro: 'gorros', gorra: 'gorras', chaqueta: 'camperas',
}
// "camperita" → "camper", "batitas" → "bat" (diminutivos).
const raiz = (w: string) => (w.length > 6 ? w.replace(/c?it(o|a|os|as)$/, '') : w)
// Misma palabra salvo plural/género: pantalon ≈ pantalones, camper ≈ camperas
// (pero pantalon ≠ pantallas, calza ≠ calzado).
const SUFIJOS = new Set(['', 's', 'es', 'a', 'o', 'as', 'os'])
function mismaPalabra(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i >= 3 && SUFIJOS.has(a.slice(i)) && SUFIJOS.has(b.slice(i))
}

// El rubro que mejor coincide con el nombre del producto (null si no hay
// nada claro: la categoría queda vacía y la elige la IA al importar).
export function adivinarRubro(nombre: string, rubros: RubroPlano[], contexto: { bebe?: boolean; usadas?: Set<string>; tienda?: string } = {}): RubroPlano | null {
  const todas = norm(nombre).split(' ')
  const conTienda = [...todas, ...norm(contexto.tienda || '').split(' ')]
  const palabras = todas.filter((w) => w.length >= 4 && !RELLENO.has(w) && !COLORES.includes(w))
  if (!palabras.length) return null
  const buscadas = palabras.map((w, i) => ({ r: SINONIMOS[w] || raiz(w), primera: i === 0 }))
  const dice = (re: RegExp) => conTienda.some((w) => re.test(w))
  let mejor: { r: RubroPlano; p: number } | null = null
  for (const r of rubros) {
    if (/^otros?\b/i.test(r.label)) continue
    const del = norm(r.label).split(' ').filter((x) => x.length >= 3)
    let p = 0
    for (const b of buscadas) if (del.some((x) => mismaPalabra(b.r, x) || mismaPalabra(b.r, raiz(x)))) p += b.primera ? 6 : 4
    if (!p) continue
    const camino = norm(`${r.categoriaLabel} ${r.grupo || ''} ${r.label}`)
    const esBebes = /bebe/.test(camino)
    if (contexto.bebe) p += esBebes ? 3 : -1
    else if (esBebes) p -= 3
    if (/^(ropa|bebes)/.test(norm(r.categoriaLabel))) p += 2
    // Ropa deportiva o de trabajo solo si el nombre lo dice.
    if (/deport/.test(camino) && !dice(/^deport/)) p -= 3
    if (/trabajo|uniforme|seguridad/.test(camino) && !dice(/^(trabajo|uniforme|seguridad)/)) p -= 3
    if (contexto.usadas?.has(r.categoriaId)) p += 2
    p -= del.length * 0.1 // a igual coincidencia, el rubro más corto ("Calzas" antes que "Calzas deportivas")
    if (!mejor || p > mejor.p) mejor = { r, p }
  }
  return mejor && mejor.p >= 5 ? mejor.r : null
}

const esBebe = (t: string) => /\b(bebe|bebes|bb|rn|recien|ajuar|baby)\b/.test(norm(t))
const lindo = (codigo: string) => codigo.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export type FilaPlanilla = {
  tienda: string
  producto: string
  precio: number | null
  publico: string
  talles: string
  colores: string
  stock: number | null
  categoria: string
  fotos: string[] // links (Drive o ImgBB) o nombres de archivo
  vista?: string // link de la miniatura
  archivo: string
}

// Tiendas escritas de dos formas ("risitas" y "risitas-bebes") → la más larga.
export function unificarTiendas(codigos: string[]): Map<string, string> {
  const unicos = [...new Set(codigos)].sort((a, b) => b.length - a.length)
  const m = new Map<string, string>()
  for (const c of unicos) m.set(c, unicos.find((l) => l !== c && l.startsWith(c + '-')) || c)
  return m
}

const PUBLICO_TEXTO: Record<string, string> = { mujer: 'mujer', hombre: 'hombre', ninos: 'niños', unisex: 'unisex' }

export function armarFilas(
  productos: ProductoLeido[],
  rubros: RubroPlano[],
  fotoDe: (p: ProductoLeido) => { links: string[]; vista?: string }
): { filas: FilaPlanilla[]; unificadas: [string, string][]; sinCategoria: number } {
  const union = unificarTiendas(productos.map((p) => p.tienda))
  const tiendaDe = (p: ProductoLeido) => union.get(p.tienda) || p.tienda
  // Tienda de bebés: si la mayoría de sus productos son de bebé (o lo dice el nombre).
  const porTienda = new Map<string, ProductoLeido[]>()
  for (const p of productos) porTienda.set(tiendaDe(p), [...(porTienda.get(tiendaDe(p)) || []), p])
  const deBebes = new Set([...porTienda].filter(([t, ps]) => esBebe(t.replace(/-/g, ' ')) || ps.filter((p) => esBebe(p.nombre)).length > ps.length / 2).map(([t]) => t))
  const filas = productos.map((p): FilaPlanilla => {
    const tienda = tiendaDe(p)
    const r = adivinarRubro(p.nombre, rubros, { bebe: deBebes.has(tienda) || esBebe(p.nombre), tienda: tienda.replace(/-/g, ' ') })
    const { links, vista } = fotoDe(p)
    const n = norm(p.nombre)
    return {
      tienda: lindo(tienda),
      producto: p.nombre,
      precio: p.precio,
      publico: PUBLICO_TEXTO[p.publico || ''] || (deBebes.has(tienda) ? 'niños' : ''),
      talles: p.talles.join(', '),
      colores: COLORES.filter((c) => n.split(' ').includes(c)).join(', '),
      stock: p.stock,
      categoria: r ? rutaDe(r) : '',
      fotos: links,
      vista,
      archivo: p.archivo,
    }
  }).sort((a, b) => a.tienda.localeCompare(b.tienda) || a.producto.localeCompare(b.producto))
  const unificadas = [...union].filter(([a, b]) => a !== b).map(([a, b]) => [lindo(a), lindo(b)] as [string, string])
  return { filas, unificadas, sinCategoria: filas.filter((f) => !f.categoria).length }
}

export async function descargarPlanilla(filas: FilaPlanilla[], nombreArchivo: string, origen: string, unificadas: [string, string][]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const titulos = ['vista', 'tienda', 'producto', 'precio', 'público', 'talles', 'colores', 'stock', 'categoría', 'foto', 'precio antes', 'descripción', 'código', 'archivo']
  const obligatorias = new Set(['tienda', 'producto', 'precio'])
  const enc = titulos.map((t) => ({ value: t, fontWeight: 'bold', backgroundColor: obligatorias.has(t) ? '#F6D9A8' : '#DCEBE5', type: String, height: 20 }))
  const conVista = filas.some((f) => f.vista)
  const texto = (v: string) => (v ? { value: v, type: String } : { value: null })
  const datos = filas.map((f) => [
    // En .xlsx la fórmula va sin "=" (con "=" Google Sheets la muestra como #ERROR!).
    f.vista ? { type: 'Formula', value: `IMAGE("${f.vista.replace(/"/g, '')}")`, height: 80 } : { value: null },
    texto(f.tienda),
    texto(f.producto),
    f.precio != null ? { value: f.precio, type: Number } : { value: null },
    texto(f.publico),
    texto(f.talles),
    texto(f.colores),
    f.stock != null ? { value: f.stock, type: Number } : { value: null },
    { ...texto(f.categoria), backgroundColor: f.categoria ? undefined : '#FFF4D6' },
    texto(f.fotos.join(', ')),
    { value: null }, { value: null }, { value: null },
    { ...texto(f.archivo), color: '#888888' },
  ].map((c) => ({ ...c, alignVertical: 'center' })))
  const sinPrecio = filas.filter((f) => f.precio == null).length
  const ayuda = [
    `Planilla armada por Clasi Click desde ${origen} (${filas.length} productos)`,
    '',
    'Qué falta completar antes de importar',
    sinPrecio ? `• precio (obligatorio): falta en ${sinPrecio} fila${sinPrecio === 1 ? '' : 's'}.` : '• precio: ya está en todas las filas (salió del nombre de la foto).',
    '• talles, stock, precio antes, descripción y código: opcionales.',
    '• categoría: la adivinamos por el nombre. Revisala; las celdas amarillas vacías las elige la IA mirando la foto al importar.',
    '• Si un producto tenía varias fotos con el mismo nombre, quedaron todas juntas en la columna foto (separadas por coma).',
    ...(unificadas.length ? [`• Tiendas unificadas: ${unificadas.map(([a, b]) => `“${a}” → “${b}”`).join(', ')}. Si son distintas, corregí la columna tienda.`] : []),
    '',
    ...(conVista ? ['Fotos', '• Si las fotos son de Drive, la carpeta tiene que estar compartida como "Cualquier persona con el enlace: Lector"; si no, la columna vista queda en blanco y no se pueden importar.', ''] : []),
    'Cómo importar',
    '• Subí este archivo a Google Drive y abrilo con Google Sheets (o copiá las filas a tu planilla).',
    '• Compartila como "Cualquier persona con el enlace: Lector".',
    `• Clasi Click → Admin → Productos → Edición rápida → Importar → "Google Sheet" → pegá el link.${filas.some((f) => f.fotos.some((x) => !/^https?:/i.test(x))) ? ' Como las fotos van por nombre de archivo, elegí también la carpeta de fotos.' : ''}`,
    '• Las columnas "vista" y "archivo" son solo para que veas; el importador las ignora.',
  ].map((v, i) => [{ value: v, type: String, fontWeight: /^(Planilla|Qué falta|Fotos$|Cómo importar)/.test(v) ? 'bold' : undefined, fontSize: i === 0 ? 13 : undefined }])
  await writeXlsxFile([
    { data: [enc, ...datos], sheet: 'Productos', columns: [conVista ? 22 : 8, 16, 28, 9, 9, 12, 14, 8, 44, 30, 11, 30, 10, 30].map((width) => ({ width })), stickyRowsCount: 1 },
    { data: ayuda, sheet: 'Leeme', columns: [{ width: 130 }] },
  ] as any).toFile(nombreArchivo)
}
