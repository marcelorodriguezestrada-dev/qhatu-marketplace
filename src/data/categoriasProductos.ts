// Taxonomía por defecto para PRODUCTOS: Categoría > Rubro. Es el mismo
// patrón que src/data/categorias.ts usa para profesionales, pero en un
// árbol aparte porque un "rubro" de producto (ej: Sandalias) no tiene
// nada que ver con un rubro de servicio (ej: Plomero).
//
// El admin puede además, igual que con profesionales:
//  - agregar categorías nuevas de producto (`categorias_productos_personalizadas`)
//  - agregar rubros nuevos dentro de cualquier categoría (`rubros_productos_personalizados`)
//  - mover un rubro de acá a otra categoría (`rubro_producto_categoria_overrides`)
//
// El armado final (base + lo agregado en Firestore) lo arma
// `/api/categorias-productos`, que es la única fuente de verdad que
// debería consultar la UI (ver `src/lib/useCategoriasProductos.ts`).
// Este archivo es solo el punto de partida.

export type RubroProducto = { id: string; label: string }
export type CategoriaProducto = { id: string; label: string; rubros: RubroProducto[] }

export const CATEGORIAS_PRODUCTOS_BASE: CategoriaProducto[] = [
  {
    id: 'calzado',
    label: 'Calzado',
    rubros: [
      { id: 'botines', label: 'Botines' },
      { id: 'sandalias', label: 'Sandalias' },
      { id: 'zapatos-vestir', label: 'Zapatos de vestir' },
      { id: 'zapatillas', label: 'Zapatillas / sneakers' },
      { id: 'otro-calzado', label: 'Otro calzado' },
    ],
  },
  {
    id: 'ropa',
    label: 'Ropa',
    rubros: [
      { id: 'chompas-abrigos', label: 'Chompas y abrigos' },
      { id: 'ropa-casual', label: 'Ropa casual' },
      { id: 'ropa-trabajo', label: 'Ropa de trabajo' },
      { id: 'otro-ropa', label: 'Otra ropa' },
    ],
  },
  {
    id: 'accesorios',
    label: 'Accesorios',
    rubros: [
      { id: 'carteras-bolsos', label: 'Carteras y bolsos' },
      { id: 'sombreros', label: 'Sombreros' },
      { id: 'joyas-bijouterie', label: 'Joyas y bijouterie' },
      { id: 'otro-accesorio', label: 'Otro accesorio' },
    ],
  },
  {
    id: 'hogar',
    label: 'Hogar',
    rubros: [
      { id: 'textiles-tejidos', label: 'Textiles y tejidos' },
      { id: 'decoracion', label: 'Decoración' },
      { id: 'otro-hogar', label: 'Otro para el hogar' },
    ],
  },
  {
    id: 'otros-productos',
    label: 'Otros',
    rubros: [
      { id: 'otro-producto', label: 'Otro' },
    ],
  },
]

// Id de la categoría donde cae, por defecto, cualquier rubro de
// producto nuevo que no se le asignó explícitamente una categoría.
export const CATEGORIA_PRODUCTO_FALLBACK_ID = 'otros-productos'

// Compatibilidad con productos viejos: antes de esta clasificación,
// `producto.categoria` guardaba directamente uno de estos 4 nombres
// fijos. Este mapa se usa una sola vez, al leer un producto que
// todavía no tiene `rubro`, para no perder su clasificación.
export const LEGACY_CATEGORIA_A_RUBRO: Record<string, string> = {
  Calzado: 'otro-calzado',
  Ropa: 'otro-ropa',
  Accesorios: 'otro-accesorio',
  Hogar: 'otro-hogar',
}
