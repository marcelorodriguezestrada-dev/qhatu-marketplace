import { cache } from 'react'
import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/sitio'
import { RUBRO_DE_GRUPO } from '@/data/categoriasProductos'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { paisDeCiudad } from '@/lib/mercado'
import { construirArbolCategorias } from '@/lib/categoriasServer'

// SEO (Google): datos públicos que se leen del lado del servidor para que
// cada página llegue ya armada (título, descripción, contenido y datos
// estructurados schema.org), en vez de vacía hasta que carga el navegador.

// Firestore → JSON plano (lo que se le pasa a un client component).
const plano = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export const textoCorto = (t: unknown, max = 160) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max)

// Ciudades que se muestran en Google: solo las abiertas (no las "en prueba").
export async function ciudadesAbiertas(): Promise<Set<string>> {
  const { ciudades } = await cargarCiudadesServidor().catch(() => ({ ciudades: [] as any[] }))
  return new Set(ciudades.filter((c: any) => c.estado === 'abierta').map((c: any) => c.id))
}

// cache(): generateMetadata y el layout lo piden en el mismo render, se lee una sola vez.
export const leerProductoPublico = cache(async (id: string): Promise<Record<string, any> | null> => {
  try {
    const doc = await getDb().collection('productos').doc(id).get()
    if (!doc.exists) return null
    const datos = doc.data() as any
    if (datos.estado && datos.estado !== 'activo') return null
    if (datos.rubro && RUBRO_DE_GRUPO[datos.rubro]) datos.rubro = RUBRO_DE_GRUPO[datos.rubro]
    return plano({ id: doc.id, ...datos })
  } catch {
    return null
  }
})

// Igual que GET /api/profesionales/[id] para un visitante: sin CV oculto
// ni link de videollamada, con sus reseñas. No suma vistas.
// cache(): generateMetadata y el layout lo piden en el mismo render, se lee una sola vez.
export const leerProfesionalPublico = cache(async (id: string): Promise<Record<string, any> | null> => {
  try {
    const ref = getDb().collection('profesionales').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return null
    const datos = doc.data() as any
    if (datos.estado && datos.estado !== 'aprobado') return null
    const resenas = (await ref.collection('resenas').get()).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    if (datos.cvPublico === false) {
      delete datos.historialLaboral
      delete datos.idiomas
      datos.cvOculto = true
    }
    delete datos.linkVideollamada
    return plano({ id: doc.id, ...datos, resenas })
  } catch {
    return null
  }
})

// cache(): generateMetadata y el layout lo piden en el mismo render, se lee una sola vez.
export const leerTiendaPublica = cache(async (id: string): Promise<{ tienda: Record<string, any>; productos: Record<string, any>[] } | null> => {
  try {
    const db = getDb()
    const [doc, prods] = await Promise.all([
      db.collection('vendedores').doc(id).get(),
      db.collection('productos').where('vendedorId', '==', id).get(),
    ])
    if (!doc.exists) return null
    const t = doc.data() as any
    const productos = prods.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => !p.estado || p.estado === 'activo')
    return {
      // Los mismos campos públicos que usa /tienda/[id] (sin datos de cobro).
      tienda: { id, existe: true, nombreNegocio: t.nombreNegocio || '', logoUrl: t.logoUrl || '', direccion: t.direccion || '', horarios: t.horarios || '', zona: t.zona || '', tiposVenta: t.tiposVenta || {}, verificado: !!t.verificado, whatsapp: t.whatsapp || '', ciudad: ciudadDe(t), lat: t.lat ?? null, lng: t.lng ?? null },
      productos: plano(productos),
    }
  } catch {
    return null
  }
})

// Nombre del rubro de un profesional ("abogado-penalista" → "Abogado/a penalista").
export const nombreRubroServidor = cache(async (rubroId: string): Promise<string> => {
  try {
    const arbol: any = await construirArbolCategorias()
    const categorias: any[] = Array.isArray(arbol) ? arbol : arbol?.categorias || []
    for (const c of categorias) for (const r of c.rubros || []) if (r.id === rubroId) return String(r.label || rubroId)
  } catch {}
  return rubroId ? rubroId.replace(/-/g, ' ').replace(/^\w/, (x) => x.toUpperCase()) : 'Servicio'
})

// ── schema.org (JSON-LD) ──

export function jsonLdProducto(p: Record<string, any>) {
  const pais = paisDeCiudad(ciudadDe(p))
  const sinStock = typeof p.stock === 'number' && p.stock <= 0
  const fotos = [p.imagenUrl, ...(Array.isArray(p.fotosAdicionales) ? p.fotosAdicionales : [])].filter(Boolean)
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    description: textoCorto(p.descripcionLarga || p.descripcionCorta || p.nombre, 500),
    url: `${SITE_URL}/producto/${p.id}`,
    ...(fotos.length ? { image: fotos.slice(0, 5) } : {}),
    ...(Array.isArray(p.etiquetasBusqueda) && p.etiquetasBusqueda.length ? { keywords: p.etiquetasBusqueda.slice(0, 15).join(', ') } : {}),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/producto/${p.id}`,
      price: Number(p.precio || 0),
      priceCurrency: pais.moneda,
      availability: sinStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      areaServed: buscarCiudad(ciudadDe(p)).nombre,
      ...(p.tiendaNombre || p.vendedorId ? { seller: { '@type': 'Organization', name: p.tiendaNombre || 'Tienda en Clasi Click', ...(p.vendedorId ? { url: `${SITE_URL}/tienda/${p.vendedorId}` } : {}) } } : {}),
    },
  }
  const n = Number(p.cantidadResenas || 0)
  if (n > 0 && Number(p.ratingPromedio) > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(p.ratingPromedio).toFixed(1), reviewCount: n }
  return ld
}

export function jsonLdProfesional(p: Record<string, any>, rubro: string) {
  const ciudad = buscarCiudad(ciudadDe(p))
  const pais = paisDeCiudad(ciudad.id)
  const resenas = Array.isArray(p.resenas) ? p.resenas : []
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: p.nombre,
    description: textoCorto(p.descripcion || `${rubro} en ${ciudad.nombre}`, 500),
    url: `${SITE_URL}/servicios/${p.id}`,
    ...(p.imagenUrl ? { image: p.imagenUrl } : {}),
    address: { '@type': 'PostalAddress', ...(p.direccion ? { streetAddress: p.direccion } : {}), addressLocality: ciudad.nombre, ...(p.zona ? { addressRegion: p.zona } : {}), addressCountry: pais.id },
    ...(p.lat != null && p.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {}),
    areaServed: [ciudad.nombre, ...(Array.isArray(p.viajaA) ? p.viajaA.map((c: string) => buscarCiudad(c).nombre) : [])],
    ...(p.precio ? { priceRange: `${pais.simboloMoneda} ${p.precio}` } : {}),
    ...(Array.isArray(p.servicios) && p.servicios.length
      ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: rubro, itemListElement: p.servicios.slice(0, 15).map((s: any) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: String(s?.nombre || s) } })) } }
      : {}),
  }
  const n = Number(p.cantidadResenas || resenas.length || 0)
  if (n > 0 && Number(p.ratingPromedio) > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(p.ratingPromedio).toFixed(1), reviewCount: n }
  return ld
}

export function jsonLdTienda(t: Record<string, any>, productos: Record<string, any>[]) {
  const ciudad = buscarCiudad(t.ciudad)
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: t.nombreNegocio || 'Tienda',
    url: `${SITE_URL}/tienda/${t.id}`,
    ...(t.logoUrl ? { image: t.logoUrl } : {}),
    address: { '@type': 'PostalAddress', ...(t.direccion ? { streetAddress: t.direccion } : {}), addressLocality: ciudad.nombre, addressCountry: ciudad.pais },
    ...(t.lat != null && t.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng } } : {}),
    ...(productos.length
      ? { makesOffer: productos.slice(0, 20).map((p) => ({ '@type': 'Offer', price: Number(p.precio || 0), priceCurrency: paisDeCiudad(ciudadDe(p)).moneda, itemOffered: { '@type': 'Product', name: p.nombre, url: `${SITE_URL}/producto/${p.id}` } })) }
      : {}),
  }
}

export function jsonLdSitio() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Clasi Click',
      url: SITE_URL,
      description: 'Marketplace de Bolivia: comprá en tiendas de tu ciudad, pagá con QR y recibí en tu casa. También servicios profesionales y anuncios.',
      areaServed: ['Potosí', 'La Paz', 'Bolivia'],
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Clasi Click', url: SITE_URL, inLanguage: 'es' },
  ]
}

// <script type="application/ld+json"> seguro (sin cerrar el script con "</").
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')
