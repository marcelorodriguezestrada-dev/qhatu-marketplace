// Selector de país para los campos de WhatsApp (profesionales y
// vendedores). Hoy la plataforma solo opera en Bolivia, así que es una
// lista de un solo elemento — pero queda armada como lista (no como un
// valor fijo tipo "+591" harcodeado en cada formulario) para que el día
// que la web se expanda a otro país, agregarlo sea sumar un objeto acá
// y un validador en validarWhatsapp.ts, sin tocar los formularios.

export type Pais = { id: string; nombre: string; bandera: string; codigo: string }

export const PAISES: Pais[] = [
  { id: 'BO', nombre: 'Bolivia', bandera: '🇧🇴', codigo: '591' },
]

export const PAIS_FALLBACK_ID = 'BO'

export function buscarPais(id: string | undefined): Pais {
  return PAISES.find((p) => p.id === id) || PAISES.find((p) => p.id === PAIS_FALLBACK_ID)!
}
