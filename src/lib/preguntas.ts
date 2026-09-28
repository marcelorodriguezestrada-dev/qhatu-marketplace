// Preguntas de compradores sobre un producto (estilo Mercado Libre).
// Colección `preguntas`: { productoId, productoNombre, vendedorId,
// autorUid, autorNombre, texto, respuesta, respondidaEn, createdAt }.

export const MAX_PREGUNTA = 300
export const MAX_RESPUESTA = 800

// En las preguntas públicas no se comparten teléfonos, emails ni links
// (igual que en Mercado Libre): la venta se cierra dentro de Clasi Click.
export function tieneDatosDeContacto(texto: string): boolean {
  const t = String(texto || '')
  if (/\S+@\S+\.\S+/.test(t)) return true
  if (/https?:\/\/|www\./i.test(t)) return true
  if (/(\d[\s.-]?){7,}/.test(t)) return true
  return false
}

// "Vania Martínez" → "Vania M."
export function nombreCortoPublico(nombre: string | null | undefined, email?: string | null): string {
  const base = String(nombre || '').trim() || String(email || '').split('@')[0]
  const partes = base.split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'Comprador'
  return partes.length > 1 ? `${partes[0]} ${partes[1][0].toUpperCase()}.` : partes[0].slice(0, 20)
}
