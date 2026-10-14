import type { MetadataRoute } from 'next'
import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/sitio'
import { ciudadDe } from '@/data/ciudades'
import { ciudadesAbiertas } from '@/lib/seo'
import { landingsDeCiudad, urlLanding } from '@/lib/landing'

// /sitemap.xml — la lista de páginas para Google: productos, servicios,
// tiendas y anuncios publicados de las ciudades abiertas (las "en prueba",
// como Buenos Aires, no). Se rearma cada hora.
export const revalidate = 3600

const fecha = (v: unknown) => {
  const d = new Date(String(v || ''))
  return isNaN(d.getTime()) ? undefined : d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/servicios`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categorias`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/anuncios`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/ayuda`, changeFrequency: 'monthly', priority: 0.3 },
  ]
  try {
    const db = getDb()
    const abiertas = await ciudadesAbiertas()
    const visible = (d: any) => abiertas.has(ciudadDe(d)) && !d.esPrueba
    const [productos, profesionales, anuncios] = await Promise.all([
      db.collection('productos').get(),
      db.collection('profesionales').get(),
      db.collection('anuncios').get(),
    ])
    const tiendas = new Map<string, Date | undefined>()
    const urls: MetadataRoute.Sitemap = []
    for (const d of productos.docs) {
      const p = d.data() as any
      if ((p.estado && p.estado !== 'activo') || !visible(p)) continue
      const f = fecha(p.updatedAt || p.createdAt)
      urls.push({ url: `${SITE_URL}/producto/${d.id}`, lastModified: f, changeFrequency: 'weekly', priority: 0.8 })
      if (p.vendedorId) {
        const previa = tiendas.get(p.vendedorId)
        if (!previa || (f && f > previa)) tiendas.set(p.vendedorId, f)
      }
    }
    for (const [id, f] of tiendas) urls.push({ url: `${SITE_URL}/tienda/${id}`, lastModified: f, changeFrequency: 'weekly', priority: 0.7 })
    for (const d of profesionales.docs) {
      const p = d.data() as any
      if ((p.estado && p.estado !== 'aprobado') || !visible(p)) continue
      urls.push({ url: `${SITE_URL}/servicios/${d.id}`, lastModified: fecha(p.updatedAt || p.createdAt), changeFrequency: 'weekly', priority: 0.8 })
    }
    for (const d of anuncios.docs) {
      const a = d.data() as any
      if (a.estado !== 'aprobado' || !visible(a)) continue
      urls.push({ url: `${SITE_URL}/anuncios/${d.id}`, lastModified: fecha(a.updatedAt || a.createdAt), changeFrequency: 'weekly', priority: 0.5 })
    }
    // Páginas por ciudad y rubro (etapa 2): /potosi, /potosi/servicios/electricista…
    for (const ciudad of abiertas) {
      const landings = await landingsDeCiudad(ciudad).catch(() => [])
      if (!landings.length) continue
      urls.push({ url: `${SITE_URL}/${ciudad}`, changeFrequency: 'daily', priority: 0.9 })
      for (const l of landings) urls.push({ url: `${SITE_URL}${urlLanding(ciudad, l)}`, changeFrequency: 'daily', priority: l.nivel === 'categoria' ? 0.85 : 0.8 })
    }
    return [...fijas, ...urls]
  } catch (err) {
    console.error('sitemap', err)
    return fijas
  }
}
