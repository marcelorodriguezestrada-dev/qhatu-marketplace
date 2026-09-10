// Público objetivo del producto. A diferencia de Categoría/Rubro, esto
// es una lista fija y chica (no se espera que crezca mucho ni que el
// admin necesite agregar opciones sueltas todo el tiempo), así que no
// tiene el esquema de personalización por Firestore que sí tiene
// src/data/categoriasProductos.ts — es solo una constante.

export type PublicoProducto = 'mujer' | 'hombre' | 'ninos' | 'unisex'

export const PUBLICOS_PRODUCTO: { id: PublicoProducto; label: string }[] = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'ninos', label: 'Niños' },
  { id: 'unisex', label: 'Unisex' },
]

export const PUBLICO_PRODUCTO_FALLBACK: PublicoProducto = 'unisex'

export function labelPublicoProducto(id: string | undefined): string {
  return PUBLICOS_PRODUCTO.find((p) => p.id === id)?.label || PUBLICOS_PRODUCTO.find((p) => p.id === PUBLICO_PRODUCTO_FALLBACK)!.label
}
