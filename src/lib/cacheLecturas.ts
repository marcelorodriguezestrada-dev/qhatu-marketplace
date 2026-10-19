import { duracionCache } from '@/lib/consumoFirestore'

// Caché en memoria del servidor para lecturas grandes que se repiten en
// cada visita (ej. todos los productos). Cada instancia de Vercel guarda la
// última respuesta `ms` milisegundos (10 veces más con el modo ahorro) y,
// si llegan varias visitas juntas, hacen UNA sola lectura.
const memo = new Map<string, { hasta: number; datos?: unknown; leyendo?: Promise<unknown> }>()

export async function enCache<T>(clave: string, ms: number, leer: () => Promise<T>): Promise<T> {
  const e = memo.get(clave)
  if (e && 'datos' in e && e.hasta > Date.now()) return e.datos as T
  if (e?.leyendo) return e.leyendo as Promise<T>
  const leyendo = leer()
    .then((datos) => {
      memo.set(clave, { hasta: Date.now() + duracionCache(ms), datos })
      return datos
    })
    .catch((err) => {
      // Si falla (ej. sin cuota), se sigue mostrando lo último que había.
      if (e && 'datos' in e) {
        memo.set(clave, { hasta: Date.now() + 30_000, datos: e.datos })
        return e.datos as T
      }
      memo.delete(clave)
      throw err
    })
  memo.set(clave, { ...(e || { hasta: 0 }), leyendo })
  return leyendo
}

// Después de guardar un cambio: que la próxima lectura sea fresca (en esta instancia).
export function olvidarCache(clave: string) {
  memo.delete(clave)
}

// Cabecera para que el CDN de Vercel guarde la respuesta pública y la
// comparta entre todas las visitas (no llega ni a la función).
export const cabeceraCDN = (segundos: number) => ({ 'Cache-Control': `public, s-maxage=${duracionCache(segundos * 1000) / 1000}, stale-while-revalidate=600` })
