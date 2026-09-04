export type Producto = {
  id: number | string
  nombre: string
  vendedor: string
  vendedorId?: string
  categoria: 'Calzado' | 'Ropa' | 'Accesorios' | 'Hogar'
  precio: number // en Bolivianos
  icono: string
  imagenUrl?: string
}

// Catálogo semilla. En producción esto vive en Firestore (colección
// "productos") y cada vendedor lo carga desde un panel propio — esto es
// el punto de partida para no arrancar con la tienda vacía.
export const PRODUCTOS_SEED: Producto[] = [
  { id: 1, nombre: 'Botines de cuero mujer', vendedor: 'Zapatería Doña Rosa', categoria: 'Calzado', precio: 250, icono: 'boot' },
  { id: 2, nombre: 'Sandalias trenzadas', vendedor: 'Zapatería Doña Rosa', categoria: 'Calzado', precio: 150, icono: 'sandal' },
  { id: 3, nombre: 'Zapatos de vestir mujer', vendedor: 'Calzados El Alto', categoria: 'Calzado', precio: 220, icono: 'shoe' },
  { id: 4, nombre: 'Aguayo tejido tradicional', vendedor: 'Textiles Andinos', categoria: 'Hogar', precio: 180, icono: 'textile' },
  { id: 5, nombre: 'Chompa de alpaca', vendedor: 'Lana Real', categoria: 'Ropa', precio: 320, icono: 'sweater' },
  { id: 6, nombre: 'Sombrero de ala', vendedor: 'Sombrerería Central', categoria: 'Accesorios', precio: 95, icono: 'hat' },
  { id: 7, nombre: 'Zapatillas urbanas mujer', vendedor: 'Calzados El Alto', categoria: 'Calzado', precio: 200, icono: 'sneaker' },
  { id: 8, nombre: 'Cartera de cuero', vendedor: 'Marroquinería Sur', categoria: 'Accesorios', precio: 140, icono: 'bag' },
]
