import { buscarCiudad } from '@/data/ciudades'

// Cómo se le habla a la gente según dónde está la tienda / la campaña:
//   Bolivia   → tuteo ("mira", "pídelo", "paga con QR"), con expresiones
//               bolivianas (casero, yapita, pues) y toque potosino o paceño.
//   Argentina → voseo rioplatense ("mirá", "pedilo", "pagá con QR").
// Lo usan las plantillas de marketing y todos los prompts de IA que
// escriben textos para compradores o vendedores.

export type Estilo = 'potosi' | 'la-paz' | 'bolivia' | 'argentina'

export function estiloDe(ciudadId: string | null | undefined): Estilo {
  const c = buscarCiudad(ciudadId)
  if (c.pais === 'AR') return 'argentina'
  if (c.id === 'potosi' || c.id === 'la-paz') return c.id
  return 'bolivia'
}

export const esVoseo = (ciudadId: string | null | undefined) => estiloDe(ciudadId) === 'argentina'

// Elige el texto según el país: v(ciudad, 'mira', 'mirá').
export const v = (ciudadId: string | null | undefined, bolivia: string, argentina: string) => (esVoseo(ciudadId) ? argentina : bolivia)

export function gentilicio(ciudadId: string | null | undefined) {
  const e = estiloDe(ciudadId)
  if (e === 'potosi') return 'potosino'
  if (e === 'la-paz') return 'paceño'
  if (buscarCiudad(ciudadId).id === 'buenos-aires') return 'porteño'
  return e === 'argentina' ? 'argentino' : 'boliviano'
}

// Instrucción para la IA (va al final del prompt de sistema).
export function guiaIdioma(ciudadId: string | null | undefined): string {
  const c = buscarCiudad(ciudadId)
  const e = estiloDe(ciudadId)
  if (e === 'argentina') {
    return (
      ` IDIOMA: escribí como habla la gente de ${c.nombre}, Argentina: voseo rioplatense ("mirá", "aprovechá", "pedilo", "escribinos", "vos tenés"), ` +
      'con expresiones naturales y sin exagerar ("re lindo", "bárbaro", "dale", "un golazo"). Precios en pesos ($). ' +
      'No uses palabras bolivianas ("casero", "yapa", "pues", "harto").'
    )
  }
  const toque =
    e === 'potosi'
      ? ' Toque potosino cuando encaje (máximo una referencia, sin forzar): "potosino/a", la Villa Imperial, el Cerro Rico, el frío de Potosí, el orgullo potosino.'
      : e === 'la-paz'
        ? ' Toque paceño cuando encaje (máximo una referencia, sin forzar): "paceño/a", el Illimani, el teleférico, la hoyada.'
        : ''
  return (
    ` IDIOMA: escribí como habla la gente de ${c.nombre}, Bolivia: TUTEO boliviano ("mira", "aprovecha", "pídelo", "escríbenos", "tú tienes"). ` +
    'NUNCA voseo argentino ("mirá", "aprovechá", "pedilo", "vos", "che", "re"), aunque estas instrucciones estén escritas con voseo. ' +
    'Podés usar con naturalidad y sin exagerar expresiones bolivianas: "casero/casera", "yapita", "pues" ("ven pues"), "harto" (mucho), "bien bonito", "precio de casera". ' +
    `Talla (no "talle"). Precios en Bs.${toque}`
  )
}
