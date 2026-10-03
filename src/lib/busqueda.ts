// Búsqueda de productos tolerante: sin acentos, palabra por palabra, y
// mirando también rubro, categoría y público — así "zapatos mujer"
// encuentra un "Zapato de cuero" cargado para Mujer.
//
// Cómo se entiende la consulta (ver buscarProducto):
//  - Las palabras de público ("mujer", "dama", "hombre", "niña"…) no se
//    buscan como texto: filtran por el público del producto. Un producto
//    "Otros/unisex" entra como relacionado; uno de otro público, no entra.
//  - El resto se compara palabra por palabra, admitiendo plural, género y
//    diminutivo ("pantalón" ≈ "pantalones", "remera" ≈ "remerita") y un
//    error de tipeo en palabras largas ("pantlon"), pero no otra palabra
//    que solo empieza igual ("media" ≠ "mediano", "calza" ≠ "calzado").
//  - En el nombre o la tienda pesa más; en el rubro también es exacto,
//    salvo rubros que juntan varias cosas ("Saquitos, Sweaters y
//    Chalecos": un saquito no es un chaleco → relacionado).
//  - Familias de palabras y etiquetas de IA → relacionado.
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'

export const normalizar = (t: string) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Singular simple: "zapatos" ↔ "zapato", "blusas" ↔ "blusa".
const raiz = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

const SINONIMOS_PUBLICO: Record<string, string> = { mujer: 'mujer dama damas femenino', hombre: 'hombre caballero varon masculino', ninos: 'ninos nino nina ninas infantil chicos', unisex: 'otros unisex' }

export function textoBuscable(p: { nombre?: string; vendedor?: string; publico?: string }, rubro?: { label: string; categoriaLabel: string; grupo?: string }) {
  return normalizar([p.nombre, p.vendedor, rubro?.label, rubro?.grupo, rubro?.categoriaLabel, SINONIMOS_PUBLICO[p.publico || 'unisex']].filter(Boolean).join(' '))
}

export function coincide(texto: string, consulta: string) {
  const palabras = normalizar(consulta).split(' ').filter(Boolean)
  return palabras.every((w) => texto.includes(raiz(w)))
}

export const labelPublico = (id: string) => PUBLICOS_PRODUCTO.find((p) => p.id === id)?.label || ''

// ——— Búsqueda inteligente ———
// 1) Familias de palabras: cómo habla la gente → qué productos son.
//    Si alguien busca "zapatos", también son zapatos las sandalias, los
//    botines y las zapatillas. `rubros` suma rubros enteros del árbol.
//    Para ampliar: agregá palabras a un grupo o un grupo nuevo.
// 2) etiquetasBusqueda: palabras ocultas que la IA guarda en cada
//    producto al publicarlo (ver generarEtiquetasBusquedaIA).
// Lo que coincide con el texto visible es "exacto"; lo que entra por
// familia o etiqueta es "relacionado" (se muestra después, aparte).

type Familia = { palabras: string[]; rubros?: string[] }
// Ids de rubro o de subcategoría (ej: 'ropa-calzado' = todo Ropa › Calzado).
const RUBROS_CALZADO = ['ropa-calzado', 'deportes-y-fitness-zapatillas', 'ropa-ropa-y-calzado-para-bebes-calzados', 'bebes-ropa-y-calzado-para-bebes-calzados', 'mascotas-botas-y-zapatos']

export const FAMILIAS: Familia[] = [
  { palabras: ['zapato', 'calzado', 'sandalia', 'botin', 'bota', 'zapatilla', 'mocasin', 'taco', 'ojota', 'chancleta', 'chinela', 'pantufla', 'tenis', 'sneaker', 'oxford', 'balerina', 'chatita', 'alpargata', 'abarca'], rubros: RUBROS_CALZADO },
  { palabras: ['chompa', 'sueter', 'buzo', 'chamarra', 'campera', 'casaca', 'abrigo', 'poleron', 'cardigan', 'saco', 'chaleco', 'parka'], rubros: ['chompas-abrigos'] },
  { palabras: ['polera', 'remera', 'camiseta', 'musculosa', 'chomba', 'playera', 'top'], rubros: ['ropa-remeras-musculosas-y-chombas'] },
  { palabras: ['pantalon', 'jean', 'jogger', 'buzo deportivo', 'calza', 'legging', 'short', 'bermuda'], rubros: ['ropa-pantalones', 'ropa-calzas', 'ropa-bermudas-y-shorts'] },
  { palabras: ['vestido', 'pollera', 'falda', 'enterito', 'mameluco'], rubros: ['ropa-vestidos', 'ropa-polleras', 'ropa-enteritos'] },
  { palabras: ['blusa', 'camisa', 'camisola'], rubros: ['ropa-blusas', 'ropa-camisas'] },
  { palabras: ['cartera', 'bolso', 'mochila', 'bolsa', 'billetera', 'monedero', 'maleta', 'valija', 'rinonera'], rubros: ['carteras-bolsos'] },
  { palabras: ['gorro', 'sombrero', 'gorra', 'chullo', 'boina'], rubros: ['sombreros'] },
  { palabras: ['ropa interior', 'pijama', 'calzon', 'boxer', 'brasier', 'sosten', 'media', 'calcetin'], rubros: ['ropa-ropa-interior-y-de-dormir'] },
  { palabras: ['celular', 'telefono', 'smartphone', 'movil', 'iphone', 'samsung', 'xiaomi', 'motorola'] },
  { palabras: ['audifono', 'auricular', 'parlante', 'bocina', 'altavoz'] },
  { palabras: ['computadora', 'laptop', 'notebook', 'portatil', 'pc', 'computador'] },
  { palabras: ['tele', 'televisor', 'television', 'smart tv', 'pantalla'] },
  { palabras: ['mueble', 'silla', 'mesa', 'ropero', 'cama', 'sofa', 'sillon', 'escritorio', 'estante', 'repisa', 'comoda', 'velador'] },
  { palabras: ['juguete', 'muneca', 'peluche', 'juego', 'lego', 'pelota'] },
  { palabras: ['maquillaje', 'labial', 'base', 'rimel', 'perfume', 'crema', 'colonia', 'esmalte'] },
  { palabras: ['joya', 'collar', 'arete', 'pulsera', 'anillo', 'reloj', 'cadena', 'aro', 'pendiente'] },
  { palabras: ['bebe', 'panal', 'mamadera', 'biberon', 'cochecito', 'carriola'] },
  { palabras: ['mascota', 'perro', 'gato', 'collar perro', 'croqueta', 'alimento perro'] },
]

const raizFamilias = FAMILIAS.map((f) => ({ ...f, raices: f.palabras.map((p) => raiz(normalizar(p))) }))
const CONOCIDAS = new Set(raizFamilias.flatMap((f) => f.raices))

// ——— Palabras ———
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'y', 'e', 'en', 'un', 'una', 'unos', 'unas', 'por', 'a', 'al', 'o', 'tipo'])
const PUBLICO_DE: Record<string, string> = {
  mujer: 'mujer', mujeres: 'mujer', dama: 'mujer', damas: 'mujer', senora: 'mujer', senoras: 'mujer', femenino: 'mujer', femenina: 'mujer',
  hombre: 'hombre', hombres: 'hombre', caballero: 'hombre', caballeros: 'hombre', varon: 'hombre', varones: 'hombre', masculino: 'hombre', senor: 'hombre', senores: 'hombre',
  nino: 'ninos', ninos: 'ninos', nina: 'ninos', ninas: 'ninos', infantil: 'ninos', infantiles: 'ninos', kids: 'ninos', nene: 'ninos', nena: 'ninos', nenes: 'ninos', nenas: 'ninos',
  unisex: 'unisex',
}
const palabrasDe = (t: string) => normalizar(t).split(/[^a-z0-9]+/).filter(Boolean)

// Misma palabra salvo plural, género o diminutivo.
const SUFIJOS = new Set(['', 's', 'es', 'a', 'o', 'as', 'os', 'ita', 'ito', 'itas', 'itos', 'cita', 'cito', 'citas', 'citos'])
function mismaPalabra(a: string, b: string) {
  if (a === b) return true
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i >= 3 && SUFIJOS.has(a.slice(i)) && SUFIJOS.has(b.slice(i))
}
// Un error de tipeo (letra de más, de menos, cambiada o dos invertidas) en palabras de 5+ letras.
function casiIgual(a: string, b: string) {
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  const ra = a.slice(i), rb = b.slice(i)
  return ra.slice(1) === rb.slice(1) || ra.slice(1) === rb || ra === rb.slice(1) || (ra.length > 1 && ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2))
}
// ¿La palabra buscada está en estas palabras? `parcial`: la última palabra
// se está escribiendo ("panta" ya encuentra pantalones).
// El error de tipeo solo se tolera en palabras que no conocemos: "chompa"
// (suéter) existe y no es "chomba" (remera), pero "pantlon" no existe.
function esta(t: string, palabras: string[], parcial = false) {
  const rt = raiz(t)
  const tipeo = !CONOCIDAS.has(rt)
  return palabras.some((w) => mismaPalabra(t, w) || (tipeo && (casiIgual(t, w) || casiIgual(rt, raiz(w)))) || (parcial && t.length >= 2 && w.startsWith(t)))
}

// Público del producto; si quedó en "Otros", el que diga el nombre ("Blusa dama").
function publicoProducto(p: ProductoBuscable) {
  if (p.publico && p.publico !== 'unisex') return p.publico
  for (const w of palabrasDe(p.nombre || '')) if (PUBLICO_DE[w] && PUBLICO_DE[w] !== 'unisex') return PUBLICO_DE[w]
  return 'unisex'
}

// Las alternativas de una palabra buscada (ella misma + su familia).
function familiaDe(palabra: string) {
  const r = raiz(palabra)
  return (
    raizFamilias.find((f) => f.raices.some((x) => x === r || (!x.includes(' ') && mismaPalabra(x, palabra)))) ||
    (r.length >= 5 ? raizFamilias.find((f) => f.raices.some((x) => x.length >= 5 && (x.startsWith(r) || r.startsWith(x)))) : undefined)
  )
}

export type ProductoBuscable = { nombre?: string; vendedor?: string; publico?: string; rubro?: string; etiquetasBusqueda?: string[]; descripcionCorta?: string }
type RubroBuscable = { label: string; categoriaLabel: string; grupoId?: string; grupo?: string }

// Consulta ya separada (se puede armar una vez y usar para todos los productos).
export function prepararConsulta(consulta: string) {
  const todas = palabrasDe(consulta).filter((w) => !VACIAS.has(w))
  const publicos = new Set(todas.map((w) => PUBLICO_DE[w]).filter(Boolean))
  const terminos = todas.filter((w) => !PUBLICO_DE[w])
  return { terminos, publicos, palabrasPublico: todas.filter((w) => PUBLICO_DE[w]) }
}

// Rubro que junta varias cosas: "Saquitos, Sweaters y Chalecos", "Bermudas y Shorts".
const esLista = (label: string) => /,|\sy\s|\se\s|\//.test(label)

export type ResultadoBusqueda = { tipo: 'exacto' | 'relacionado'; puntaje: number }

export function buscarProducto(
  p: ProductoBuscable,
  rubro: RubroBuscable | undefined,
  consulta: string | ReturnType<typeof prepararConsulta>,
  opciones: { parcial?: boolean } = {}
): ResultadoBusqueda | null {
  const c = typeof consulta === 'string' ? prepararConsulta(consulta) : consulta
  if (!c.terminos.length && !c.publicos.size) return null
  let tipo: ResultadoBusqueda['tipo'] = 'exacto'
  let puntaje = 0

  // Público: filtra (no se busca como texto).
  if (c.publicos.size) {
    const pub = publicoProducto(p)
    if (c.publicos.has(pub)) {
      puntaje += 3
      // "niña" pesa más en una "Blusa niña" que en un "Pantalón niño".
      if (c.palabrasPublico.some((w) => esta(w, palabrasDe(p.nombre || '')))) puntaje += 2
    } else if (pub === 'unisex' && c.terminos.length && !c.publicos.has('unisex')) tipo = 'relacionado'
    else return null
  }

  const nombre = palabrasDe(`${p.nombre || ''} ${p.vendedor || ''}`)
  const soloNombre = palabrasDe(p.nombre || '')
  const deRubro = rubro ? palabrasDe(rubro.label) : []
  const rubroEsLista = rubro ? esLista(rubro.label) : false
  const deGrupo = rubro ? palabrasDe(`${rubro.grupo || ''} ${rubro.categoriaLabel}`) : []
  const oculto = palabrasDe(`${(p.etiquetasBusqueda || []).join(' ')} ${p.descripcionCorta || ''}`)
  const textoOculto = ` ${[...nombre, ...deRubro, ...deGrupo, ...oculto].join(' ')} `

  for (let i = 0; i < c.terminos.length; i++) {
    const t = c.terminos[i]
    const parcial = !!opciones.parcial && i === c.terminos.length - 1
    if (esta(t, nombre, parcial)) {
      puntaje += 10
      if (soloNombre[0] && (mismaPalabra(t, soloNombre[0]) || (parcial && soloNombre[0].startsWith(t)))) puntaje += 4 // "Chaleco …" antes que "Saco con chaleco"
      continue
    }
    if (esta(t, deRubro, parcial)) {
      puntaje += rubroEsLista ? 4 : 7
      if (rubroEsLista) tipo = 'relacionado'
      continue
    }
    if (esta(t, deGrupo, parcial)) { puntaje += 5; continue }
    if (esta(t, oculto, parcial)) { puntaje += 3; tipo = 'relacionado'; continue }
    const fam = familiaDe(t)
    const enFamilia =
      fam &&
      ((fam.rubros && ((p.rubro && fam.rubros.includes(p.rubro)) || (rubro?.grupoId && fam.rubros.includes(rubro.grupoId)))) ||
        fam.raices.some((x) => (x.includes(' ') ? textoOculto.includes(` ${x} `) : esta(x, [...nombre, ...deRubro, ...oculto]))))
    if (!enFamilia) return null
    puntaje += 2
    tipo = 'relacionado'
  }
  return { tipo, puntaje }
}

// 'exacto' | 'relacionado' | null (no aparece).
export function relevancia(p: ProductoBuscable, rubro: RubroBuscable | undefined, consulta: string, opciones: { parcial?: boolean } = {}): 'exacto' | 'relacionado' | null {
  return buscarProducto(p, rubro, consulta, opciones)?.tipo || null
}

// Para ordenar: más arriba lo que coincide en el nombre, después en el
// rubro, en las etiquetas de IA y al final lo que entra por familia.
export function puntajeRelacionado(p: ProductoBuscable, consulta: string, rubro?: RubroBuscable) {
  return buscarProducto(p, rubro, consulta)?.puntaje || 0
}
