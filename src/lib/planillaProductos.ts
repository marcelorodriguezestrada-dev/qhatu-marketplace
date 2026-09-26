// Planilla Excel para publicar muchos productos de una vez (/vender →
// "Publicar con Excel"). Acá están las columnas y la lectura de cada
// fila; el componente PublicarMasivo arma la plantilla, lee el archivo
// y publica fila por fila con la misma API que el formulario.

export const COLUMNAS_PLANILLA = [
  { clave: 'nombre', titulo: 'Nombre *', ejemplo: 'Botín de cuero marrón', ancho: 32 },
  { clave: 'precio', titulo: 'Precio Bs *', ejemplo: 320, ancho: 12 },
  { clave: 'precioOriginal', titulo: 'Precio antes Bs', ejemplo: 380, ancho: 14 },
  { clave: 'rubro', titulo: 'Categoría *', ejemplo: '', ancho: 26 },
  { clave: 'publico', titulo: 'Para (Mujer/Hombre/Niños/Unisex)', ejemplo: 'Mujer', ancho: 18 },
  { clave: 'descripcionCorta', titulo: 'Descripción corta', ejemplo: 'Cuero legítimo, suela de goma', ancho: 30 },
  { clave: 'descripcionLarga', titulo: 'Descripción', ejemplo: 'Hecho a mano en Potosí. Ideal para el frío.', ancho: 40 },
  { clave: 'talles', titulo: 'Talles (separados por coma)', ejemplo: '35, 36, 37, 38', ancho: 22 },
  { clave: 'colores', titulo: 'Colores (separados por coma)', ejemplo: 'Marrón, Negro', ancho: 22 },
  { clave: 'materiales', titulo: 'Material', ejemplo: 'Cuero', ancho: 14 },
  { clave: 'stock', titulo: 'Stock', ejemplo: 10, ancho: 8 },
  { clave: 'compraMinima', titulo: 'Compra mínima', ejemplo: 1, ancho: 12 },
  { clave: 'imagenUrl', titulo: 'Foto (link https, opcional)', ejemplo: '', ancho: 30 },
] as const

export const MAX_FILAS_PLANILLA = 100

type Rubro = { id: string; label: string; categoriaLabel: string }

export type FilaLeida = {
  fila: number // número de fila en Excel (la 1 es el encabezado)
  datos: Record<string, any> | null // listo para POST /api/productos
  errores: string[]
  avisos: string[]
}

export function normalizarTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  // "1.234,50" / "1234.5" / "Bs 320"
  let t = String(v).replace(/[^\d.,-]/g, '')
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function lista(v: unknown): string[] {
  return String(v ?? '').split(/[,;/]/).map((x) => x.trim()).filter(Boolean).slice(0, 30)
}

export function buscarRubroPorTexto(texto: unknown, rubros: Rubro[]): Rubro | null {
  const t = normalizarTexto(texto)
  if (!t) return null
  const parte = t.includes('>') ? t.split('>').pop()!.trim() : t
  return (
    rubros.find((r) => normalizarTexto(r.id) === t) ||
    rubros.find((r) => normalizarTexto(r.label) === parte) ||
    rubros.find((r) => normalizarTexto(`${r.categoriaLabel} > ${r.label}`) === t) ||
    rubros.find((r) => normalizarTexto(r.label).startsWith(parte)) ||
    null
  )
}

function publicoDesde(v: unknown): string {
  const t = normalizarTexto(v)
  if (t.startsWith('muj') || t === 'dama' || t === 'damas') return 'mujer'
  if (t.startsWith('hom') || t === 'caballero' || t === 'caballeros') return 'hombre'
  if (t.startsWith('nin') || t.startsWith('infan')) return 'ninos'
  return 'unisex'
}

// Encabezados → índice de columna. Acepta los títulos de la plantilla y
// también títulos simples ("Precio", "Categoria", "Tallas"...), sin
// importar mayúsculas, tildes o el orden de las columnas.
const ALIAS: Record<string, string[]> = {
  nombre: ['nombre', 'producto', 'nombre del producto'],
  precio: ['precio bs', 'precio', 'precio actual'],
  precioOriginal: ['precio antes bs', 'precio antes', 'precio anterior'],
  rubro: ['categoria', 'rubro', 'tipo'],
  publico: ['para', 'publico'],
  descripcionCorta: ['descripcion corta'],
  descripcionLarga: ['descripcion', 'descripcion larga', 'detalle'],
  talles: ['talles', 'tallas', 'talla', 'talle'],
  colores: ['colores', 'color'],
  materiales: ['material', 'materiales'],
  stock: ['stock', 'cantidad', 'unidades'],
  compraMinima: ['compra minima', 'minimo'],
  imagenUrl: ['foto', 'imagen', 'link foto'],
}

export function mapearEncabezados(encabezados: unknown[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  // "Precio Bs *" → "precio bs"; "Talles (separados por coma)" → "talles"
  const norm = encabezados.map((e) => normalizarTexto(e).replace(/\*/g, '').split(' (')[0].trim())
  for (const [clave, alias] of Object.entries(ALIAS)) {
    const i = norm.findIndex((h, idx) => alias.includes(h) && !Object.values(mapa).includes(idx))
    if (i >= 0) mapa[clave] = i
  }
  return mapa
}

export function leerFilas(filas: unknown[][], rubros: Rubro[], nombresExistentes: string[]): { filas: FilaLeida[]; error?: string } {
  if (filas.length < 2) return { filas: [], error: 'La planilla está vacía: completá al menos una fila debajo de los títulos.' }
  const mapa = mapearEncabezados(filas[0])
  if (mapa.nombre === undefined || mapa.precio === undefined || mapa.rubro === undefined) {
    return { filas: [], error: 'No encontramos las columnas "Nombre", "Precio Bs" y "Categoría". Usá la plantilla descargada de acá.' }
  }
  const existentes = new Set(nombresExistentes.map(normalizarTexto))
  const vistos = new Set<string>()
  const out: FilaLeida[] = []
  for (let r = 1; r < filas.length && out.length < MAX_FILAS_PLANILLA; r++) {
    const fila = filas[r] || []
    const celda = (clave: string) => (mapa[clave] !== undefined ? fila[mapa[clave]] : undefined)
    if (fila.every((c) => c === null || c === undefined || String(c).trim() === '')) continue
    const errores: string[] = []
    const avisos: string[] = []
    const nombre = String(celda('nombre') ?? '').trim().slice(0, 120)
    const precio = numero(celda('precio'))
    const precioOriginal = numero(celda('precioOriginal'))
    const rubro = buscarRubroPorTexto(celda('rubro'), rubros)
    if (!nombre) errores.push('Falta el nombre.')
    if (!precio || precio <= 0) errores.push('Falta el precio (o no es un número).')
    if (!celda('rubro')) errores.push('Falta la categoría.')
    else if (!rubro) errores.push(`No existe la categoría "${String(celda('rubro')).slice(0, 40)}". Elegila de la hoja "Categorías".`)
    if (precioOriginal && precio && precioOriginal <= precio) avisos.push('El "precio antes" no es mayor al precio: se ignora.')
    const clave = normalizarTexto(nombre)
    if (nombre && existentes.has(clave)) avisos.push('Ya tenés un producto con este nombre.')
    if (nombre && vistos.has(clave)) avisos.push('Nombre repetido en la planilla.')
    vistos.add(clave)
    const foto = String(celda('imagenUrl') ?? '').trim()
    if (foto && !/^https:\/\//i.test(foto)) avisos.push('La foto tiene que ser un link https: se publica sin foto.')
    const stock = numero(celda('stock'))
    const compraMinima = numero(celda('compraMinima'))
    out.push({
      fila: r + 1,
      errores,
      avisos,
      datos: errores.length
        ? null
        : {
            nombre,
            precio,
            precioOriginal: precioOriginal && precio && precioOriginal > precio ? precioOriginal : null,
            rubro: rubro!.id,
            publico: publicoDesde(celda('publico')),
            descripcionCorta: String(celda('descripcionCorta') ?? '').trim().slice(0, 200),
            descripcionLarga: String(celda('descripcionLarga') ?? '').trim().slice(0, 3000),
            talles: lista(celda('talles')),
            colores: lista(celda('colores')),
            materiales: String(celda('materiales') ?? '').trim().slice(0, 100),
            stock: stock !== null && stock >= 0 ? Math.floor(stock) : null,
            compraMinima: compraMinima && compraMinima >= 1 ? Math.floor(compraMinima) : 1,
            imagenUrl: /^https:\/\//i.test(foto) ? foto.slice(0, 500) : '',
            plan: 'basico',
          },
    })
  }
  if (out.length === 0) return { filas: [], error: 'No encontramos productos en la planilla (las filas están vacías).' }
  return { filas: out }
}
