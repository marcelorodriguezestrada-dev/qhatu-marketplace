import { duracionCache, segundosAjuste } from '@/lib/consumoFirestore'
import type { IdAjuste } from '@/lib/ajustesConsumo'

// Caché en memoria del servidor para lecturas grandes que se repiten en
// cada visita (ej. todos los productos). Cada instancia de Vercel guarda la
// última respuesta `ms` milisegundos (10 veces más con el modo ahorro) y,
// si llegan varias visitas juntas, hacen UNA sola lectura.
const memo = new Map<string, { hasta: number; datos?: unknown; leyendo?: Promise<unknown> }>()

// Qué ajuste del tablero manda en cada caché (por el comienzo de la clave).
function ajusteDe(clave: string): IdAjuste | null {
  if (clave === 'productos' || clave === 'anuncios' || clave === 'profesionales') return 'cacheListas'
  if (clave.startsWith('notificaciones:')) return 'cacheNotificaciones'
  if (clave === 'configuracion/pagos' || clave === 'portada') return 'cacheConfig'
  if (clave.startsWith('resenas:') || clave.startsWith('entregados:')) return 'cacheResenas'
  return null
}

// `ms`: duración si el admin no la cambió desde el tablero.
export async function enCache<T>(clave: string, msPorDefecto: number, leer: () => Promise<T>): Promise<T> {
  const ajuste = ajusteDe(clave)
  const ms = ajuste ? segundosAjuste(ajuste) * 1000 : msPorDefecto
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
export const cabeceraCDN = (segundosPorDefecto: number, ajuste: IdAjuste = 'cacheListas') => ({
  'Cache-Control': `public, s-maxage=${duracionCache((segundosAjuste(ajuste) || segundosPorDefecto) * 1000) / 1000}, stale-while-revalidate=600`,
})
