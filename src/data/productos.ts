export type Producto = {
  id: number | string
  nombre: string
  vendedor: string
  vendedorId?: string
  descripcionCorta?: string
  descripcionLarga?: string
  // Id del rubro dentro del árbol Categoría > Rubro de productos (ver
  // src/data/categoriasProductos.ts) — ej: 'botines', 'chompas-abrigos'.
  rubro: string
  // Público objetivo: 'mujer' | 'hombre' | 'ninos' | 'unisex' (ver
  // src/data/publicoProducto.ts). Opcional por compatibilidad con
  // productos viejos publicados antes de este campo — se los trata
  // como 'unisex' si no lo tienen.
  publico?: 'mujer' | 'hombre' | 'ninos' | 'unisex'
  // Campo viejo: productos publicados antes de la clasificación por
  // rubro guardaban acá uno de 4 nombres fijos ('Calzado', 'Ropa',
  // 'Accesorios', 'Hogar'). Se mantiene opcional solo por compatibilidad
  // con datos ya guardados en Firestore; la UI nueva usa `rubro`.
  categoria?: 'Calzado' | 'Ropa' | 'Accesorios' | 'Hogar'
  precio: number // en Bolivianos
  precioOriginal?: number // opcional — si el vendedor carga un precio "antes de", se muestra tachado con el % de descuento real
  icono: string
  imagenUrl?: string
  thumbUrl?: string
  // Página "visor" de ImgBB para la foto principal (ibb.co/xxxx, con
  // metadatos Open Graph) — a diferencia de `imagenUrl` (el link
  // directo al archivo, usado para mostrarla en la app con <img>),
  // esta es la que hay que mandar en un mensaje de WhatsApp para que
  // arme la vista previa con miniatura (ver linkWhatsappRetiroEfectivo
  // en /checkout). Vacío en productos subidos antes de este campo.
  imagenViewerUrl?: string
  // Fotos extra de la galería del producto — beneficio Premium del
  // VENDEDOR (no del producto en sí): si el vendedor tiene Premium
  // vigente, cada uno de sus productos puede tener hasta
  // MAX_FOTOS_ADICIONALES_PREMIUM fotos más, además de la principal.
  fotosAdicionales?: string[]
  createdAt?: string
  vistas?: number
  plan?: 'basico' | 'premium'
  talles?: string[] // ej: ["36","37","38"] — opcional, no todos los productos tienen talle
  colores?: string[] // ej: ["Marrón","Negro"]
  materiales?: string // texto libre, ej: "Cuero"
  compraMinima?: number // cantidad mínima por pedido, por defecto 1
  tiendaNombre?: string // nombre del negocio del vendedor, copiado de su perfil de tienda al momento de publicar/actualizar
  tiendaLogoUrl?: string
}

// El vendedor puede cargar los talles como un rango corto ("34-38") en
// vez de escribir cada número — acá lo "desarmamos" en talles sueltos
// para que el comprador elija uno específico, no el rango entero como
// si fuera una sola opción. Funciona con números ("34-38" → 34..38);
// cualquier otra cosa (S/M/L, "Único", un talle suelto) se deja tal
// cual está, porque no hay un rango numérico que expandir.
export function expandirTalles(talles: string[]): string[] {
  const resultado: string[] = []
  for (const t of talles) {
    const match = t.trim().match(/^(\d+)\s*-\s*(\d+)$/)
    if (match) {
      const desde = parseInt(match[1], 10)
      const hasta = parseInt(match[2], 10)
      // Si el rango viniera al revés (38-34) o fuera absurdamente
      // largo, mejor dejarlo tal cual que generar cientos de botones.
      if (desde <= hasta && hasta - desde <= 40) {
        for (let n = desde; n <= hasta; n++) resultado.push(String(n))
        continue
      }
    }
    resultado.push(t.trim())
  }
  // Sin duplicados, por si el vendedor puso "34-38, 36" y 36 ya estaba
  // adentro del rango.
  return [...new Set(resultado)]
}

// Catálogo semilla. En producción esto vive en Firestore (colección
// "productos") y cada vendedor lo carga desde un panel propio — esto es
// el punto de partida para no arrancar con la tienda vacía.
export const PRODUCTOS_SEED: Producto[] = [
  { id: 1, nombre: 'Botines de cuero mujer', vendedor: 'Zapatería Doña Rosa', rubro: 'botines', publico: 'mujer', precio: 250, icono: 'boot', imagenUrl: '', thumbUrl: '' },
  { id: 2, nombre: 'Sandalias trenzadas', vendedor: 'Zapatería Doña Rosa', rubro: 'sandalias', publico: 'mujer', precio: 150, icono: 'sandal', imagenUrl: '', thumbUrl: '' },
  { id: 3, nombre: 'Zapatos de vestir mujer', vendedor: 'Calzados El Alto', rubro: 'zapatos-vestir', publico: 'mujer', precio: 220, icono: 'shoe', imagenUrl: '', thumbUrl: '' },
  { id: 4, nombre: 'Aguayo tejido tradicional', vendedor: 'Textiles Andinos', rubro: 'textiles-tejidos', publico: 'unisex', precio: 180, icono: 'textile', imagenUrl: '', thumbUrl: '' },
  { id: 5, nombre: 'Chompa de alpaca', vendedor: 'Lana Real', rubro: 'chompas-abrigos', publico: 'unisex', precio: 320, icono: 'sweater', imagenUrl: '', thumbUrl: '' },
  { id: 6, nombre: 'Sombrero de ala', vendedor: 'Sombrerería Central', rubro: 'sombreros', publico: 'unisex', precio: 95, icono: 'hat', imagenUrl: '', thumbUrl: '' },
  { id: 7, nombre: 'Zapatillas urbanas mujer', vendedor: 'Calzados El Alto', rubro: 'zapatillas', publico: 'mujer', precio: 200, icono: 'sneaker', imagenUrl: '', thumbUrl: '' },
  { id: 8, nombre: 'Cartera de cuero', vendedor: 'Marroquinería Sur', rubro: 'carteras-bolsos', publico: 'mujer', precio: 140, icono: 'bag', imagenUrl: '', thumbUrl: '' },
]
