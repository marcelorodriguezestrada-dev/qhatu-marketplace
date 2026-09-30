// Búsqueda de productos tolerante: sin acentos, palabra por palabra, y
// mirando también rubro, categoría y público — así "zapatos mujer"
// encuentra un "Zapato de cuero" cargado para Mujer.
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'

export const normalizar = (t: string) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Singular simple: "zapatos" ↔ "zapato", "blusas" ↔ "blusa".
const raiz = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

const SINONIMOS_PUBLICO: Record<string, string> = { mujer: 'mujer dama damas femenino', hombre: 'hombre caballero varon masculino', ninos: 'ninos nino nina ninas infantil chicos', unisex: 'otros unisex' }

export function textoBuscable(p: { nombre?: string; vendedor?: string; publico?: string }, rubro?: { label: string; categoriaLabel: string }) {
  return normalizar([p.nombre, p.vendedor, rubro?.label, rubro?.categoriaLabel, SINONIMOS_PUBLICO[p.publico || 'unisex']].filter(Boolean).join(' '))
}

export function coincide(texto: string, consulta: string) {
  const palabras = normalizar(consulta).split(' ').filter(Boolean)
  return palabras.every((w) => texto.includes(raiz(w)))
}

export const labelPublico = (id: string) => PUBLICOS_PRODUCTO.find((p) => p.id === id)?.label || ''
