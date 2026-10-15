import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/sitio'
import { ciudadDe } from '@/data/ciudades'
import { paisDeCiudad } from '@/lib/mercado'
import { ciudadesAbiertas, textoCorto } from '@/lib/seo'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { RUBRO_DE_GRUPO } from '@/data/categoriasProductos'

// Catálogo de productos para Google Merchant Center (Google Shopping,
// listados gratis) y Meta Commerce Manager (catálogo de Facebook e
// Instagram): /feed/google.xml y /feed/meta.csv. Solo productos activos
// con foto, de ciudades abiertas. Cada link lleva UTM para medirlo.
export type ItemFeed = {
  id: string
  titulo: string
  descripcion: string
  link: string
  imagen: string
  precio: string // "290.00 BOB"
  disponible: boolean
  marca: string
  categoria: string
  ciudad: string
}

export async function itemsFeed(origen: 'google' | 'meta'): Promise<ItemFeed[]> {
  const [snap, abiertas, arbol] = await Promise.all([getDb().collection('productos').get(), ciudadesAbiertas(), construirArbolCategoriasProductos().catch(() => null)])
  // "Ropa y Accesorios > Calzado > Alpargatas" (lo que Google llama product_type).
  const rutaRubro = new Map<string, string>((arbol?.rubrosFlat || []).map((r: any) => [r.id, [r.categoriaLabel, r.grupo, /^otros?$/i.test(r.label) ? '' : r.label].filter(Boolean).join(' > ')]))
  const out: ItemFeed[] = []
  for (const d of snap.docs) {
    const p = d.data() as any
    if ((p.estado && p.estado !== 'activo') || p.esPrueba) continue
    if (!abiertas.has(ciudadDe(p))) continue
    if (!p.imagenUrl && !p.thumbUrl) continue // sin foto Google y Meta lo rechazan
    const precio = Number(p.precio || 0)
    if (!(precio > 0)) continue
    const pais = paisDeCiudad(ciudadDe(p))
    const utm = `utm_source=${origen}&utm_medium=${origen === 'google' ? 'shopping' : 'catalogo'}&utm_campaign=feed-${origen}`
    out.push({
      id: d.id,
      titulo: textoCorto(p.nombre, 150),
      descripcion: textoCorto(p.descripcionLarga || p.descripcionCorta || p.nombre, 4900) || p.nombre,
      link: `${SITE_URL}/producto/${d.id}?${utm}`,
      imagen: `${SITE_URL}/producto/${d.id}/foto`,
      precio: `${precio.toFixed(2)} ${pais.moneda}`,
      disponible: !(typeof p.stock === 'number' && p.stock <= 0),
      marca: textoCorto(p.marca || p.tiendaNombre || 'Clasi Click', 70),
      categoria: rutaRubro.get(RUBRO_DE_GRUPO[p.rubro] || p.rubro) || '',
      ciudad: ciudadDe(p),
    })
  }
  return out
}

export const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
export const escCsv = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
