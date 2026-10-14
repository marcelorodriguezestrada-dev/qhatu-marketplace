// Lo que se muestra de cada publicación (tienda y admin): qué imagen, qué
// texto, dónde se compartió, en qué grupo / página y el link rastreado.
export function detallePublicacion(id: string, x: any): Record<string, any> {
  const prodImagen = x.imagenProductoId || x.productoIds?.[0] || x.productos?.[0]?.id || ''
  const compartidaEn: { donde: string; at: string }[] = Array.isArray(x.compartidaEn) ? x.compartidaEn : typeof x.compartidaEn === 'string' ? [{ donde: x.compartidaEn, at: x.publicadaAt }] : []
  return {
    id,
    red: x.canal,
    productos: x.productos || [],
    estado: x.estado || 'borrador',
    publicadaAt: x.publicadaAt || null,
    createdAt: x.createdAt,
    vecesCompartida: x.vecesCompartida || 0,
    texto: x.texto || '',
    imagen: prodImagen ? `/api/marketing/imagen/${prodImagen}?formato=${x.formato === 'vertical' ? 'vertical' : 'cuadrado'}` : '',
    formato: x.formato || 'cuadrado',
    compartidaEn,
    lugar: x.lugar || '',
    linkPost: x.linkPost || '',
    link: prodImagen ? `/producto/${prodImagen}?c=${id}&utm_source=${x.canal}&utm_medium=social&utm_campaign=${id}` : '',
  }
}
