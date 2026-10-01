// Búsqueda de productos tolerante: sin acentos, palabra por palabra, y
// mirando también rubro, categoría y público — así "zapatos mujer"
// encuentra un "Zapato de cuero" cargado para Mujer.
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

// Las alternativas de una palabra buscada (ella misma + su familia).
function familiaDe(palabra: string) {
  const r = raiz(palabra)
  return (
    raizFamilias.find((f) => f.raices.includes(r)) ||
    (r.length >= 5 ? raizFamilias.find((f) => f.raices.some((x) => x.length >= 5 && (x.startsWith(r) || r.startsWith(x)))) : undefined)
  )
}

export type ProductoBuscable = { nombre?: string; vendedor?: string; publico?: string; rubro?: string; etiquetasBusqueda?: string[]; descripcionCorta?: string }

// 'exacto' | 'relacionado' | null (no aparece).
export function relevancia(
  p: ProductoBuscable,
  rubro: { label: string; categoriaLabel: string; grupoId?: string; grupo?: string } | undefined,
  consulta: string
): 'exacto' | 'relacionado' | null {
  const palabras = normalizar(consulta).split(' ').filter(Boolean)
  if (!palabras.length) return null
  const visible = textoBuscable(p, rubro)
  if (palabras.every((w) => visible.includes(raiz(w)))) return 'exacto'
  const oculto = `${visible} ${normalizar((p.etiquetasBusqueda || []).join(' '))} ${normalizar(p.descripcionCorta || '')}`
  const ok = palabras.every((w) => {
    if (oculto.includes(raiz(w))) return true
    const fam = familiaDe(w)
    if (!fam) return false
    if (fam.rubros && ((p.rubro && fam.rubros.includes(p.rubro)) || (rubro?.grupoId && fam.rubros.includes(rubro.grupoId)))) return true
    return fam.raices.some((x) => oculto.includes(x))
  })
  return ok ? 'relacionado' : null
}

// Para ordenar los "relacionados": primero los que tienen la palabra
// buscada en sus etiquetas de IA / descripción, después los que entran
// solo por familia o rubro.
export function puntajeRelacionado(p: ProductoBuscable, consulta: string) {
  const oculto = normalizar(`${(p.etiquetasBusqueda || []).join(' ')} ${p.descripcionCorta || ''}`)
  return normalizar(consulta).split(' ').filter(Boolean).filter((w) => oculto.includes(raiz(w))).length
}
