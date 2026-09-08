export type Producto = {
  id: number | string
  nombre: string
  vendedor: string
  vendedorId?: string
  descripcionCorta?: string
  descripcionLarga?: string
  categoria: 'Calzado' | 'Ropa' | 'Accesorios' | 'Hogar'
  precio: number // en Bolivianos
  precioOriginal?: number // opcional — si el vendedor carga un precio "antes de", se muestra tachado con el % de descuento real
  icono: string
  imagenUrl?: string
  thumbUrl?: string
  createdAt?: string
  vistas?: number
  plan?: 'basico' | 'premium'
}

// Catálogo semilla. En producción esto vive en Firestore (colección
// "productos") y cada vendedor lo carga desde un panel propio — esto es
// el punto de partida para no arrancar con la tienda vacía.
export const PRODUCTOS_SEED: Producto[] = [
  { id: 1, nombre: 'Botines de cuero mujer', vendedor: 'Zapatería Doña Rosa', categoria: 'Calzado', precio: 250, icono: 'boot', imagenUrl: '', thumbUrl: '' },
  { id: 2, nombre: 'Sandalias trenzadas', vendedor: 'Zapatería Doña Rosa', categoria: 'Calzado', precio: 150, icono: 'sandal', imagenUrl: '', thumbUrl: '' },
  { id: 3, nombre: 'Zapatos de vestir mujer', vendedor: 'Calzados El Alto', categoria: 'Calzado', precio: 220, icono: 'shoe', imagenUrl: '', thumbUrl: '' },
  { id: 4, nombre: 'Aguayo tejido tradicional', vendedor: 'Textiles Andinos', categoria: 'Hogar', precio: 180, icono: 'textile', imagenUrl: '', thumbUrl: '' },
  { id: 5, nombre: 'Chompa de alpaca', vendedor: 'Lana Real', categoria: 'Ropa', precio: 320, icono: 'sweater', imagenUrl: '', thumbUrl: '' },
  { id: 6, nombre: 'Sombrero de ala', vendedor: 'Sombrerería Central', categoria: 'Accesorios', precio: 95, icono: 'hat', imagenUrl: '', thumbUrl: '' },
  { id: 7, nombre: 'Zapatillas urbanas mujer', vendedor: 'Calzados El Alto', categoria: 'Calzado', precio: 200, icono: 'sneaker', imagenUrl: '', thumbUrl: '' },
  { id: 8, nombre: 'Cartera de cuero', vendedor: 'Marroquinería Sur', categoria: 'Accesorios', precio: 140, icono: 'bag', imagenUrl: '', thumbUrl: '' },
]
