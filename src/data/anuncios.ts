// Anuncios clasificados: cualquier usuario logueado puede publicar uno
// (algo que no encaja como "producto" ni como "servicio profesional" —
// un aviso de "se busca", "se alquila", comunicados, etc.), pero no se
// muestra en /anuncios hasta que un admin lo aprueba. Mismo esquema de
// moderación que ya usás para productos y profesionales.

export type TipoAnuncio = 'venta' | 'busqueda' | 'aviso' | 'otro'

export const TIPOS_ANUNCIO: { id: TipoAnuncio; label: string }[] = [
  { id: 'venta', label: 'Vendo / Ofrezco' },
  { id: 'busqueda', label: 'Busco' },
  { id: 'aviso', label: 'Aviso general' },
  { id: 'otro', label: 'Otro' },
]

export function labelTipoAnuncio(id: string | undefined): string {
  return TIPOS_ANUNCIO.find((t) => t.id === id)?.label || 'Otro'
}
