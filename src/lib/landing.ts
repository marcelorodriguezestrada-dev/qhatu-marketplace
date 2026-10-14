import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getDb } from '@/lib/firebaseAdmin'
import { construirArbolCategorias } from '@/lib/categoriasServer'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { RUBRO_DE_GRUPO } from '@/data/categoriasProductos'
import { buscarCiudad, ciudadDe, productoEnCiudad, profesionalEnCiudad } from '@/data/ciudades'
import { ciudadesAbiertas } from '@/lib/seo'

// SEO etapa 2: páginas por ciudad y rubro, armadas con lo publicado.
//   /potosi                         → todo lo de la ciudad
//   /potosi/servicios/electricista  → profesionales de ese rubro (o grupo / categoría)
//   /potosi/productos/calzado-...   → productos de esa categoría o subcategoría
// Solo existen las que tienen algo publicado (sin páginas vacías) y solo
// en ciudades abiertas (no las "en prueba").

export type Landing = {
  tipo: 'servicios' | 'productos'
  slug: string
  label: string
  nivel: 'categoria' | 'grupo' | 'rubro'
  // Para el breadcrumb: la categoría de arriba (si es grupo o rubro).
  padre?: { slug: string; label: string }
  ids: string[] // productos o profesionales
}

// "Abogado/a penalista" → "Abogado penalista"; "Médico clínico / general" → "Médico clínico".
export function limpiarLabel(label: string) {
  return label.replace(/\/a\b/g, '').replace(/\s*\/\s*[^/]+$/, '').replace(/\s+/g, ' ').trim()
}

const nombreOtros = (label: string, padre?: string) => (/^otros?$/i.test(label) && padre ? `Otros de ${padre}` : label)

// Todo lo publicado + los árboles de categorías.
async function leerTodo() {
  const db = getDb()
  const [prodSnap, profSnap, arbolServ, arbolProd] = await Promise.all([
    db.collection('productos').get(),
    db.collection('profesionales').get(),
    construirArbolCategorias(),
    construirArbolCategoriasProductos(),
  ])
  const productos = prodSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p) => !p.estado || p.estado === 'activo')
    .map((p) => ({ ...p, rubro: RUBRO_DE_GRUPO[p.rubro] || p.rubro }))
  const profesionales = profSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => !p.estado || p.estado === 'aprobado')
  return { productos, profesionales, arbolServ: arbolServ as any, arbolProd: arbolProd as any }
}

export const esCiudadAbierta = async (ciudad: string) => (await ciudadesAbiertas()).has(ciudad)

// Todas las páginas posibles de una ciudad (con al menos 1 resultado).
async function calcularLandings(ciudad: string, todo: Awaited<ReturnType<typeof leerTodo>>): Promise<Landing[]> {
  const { productos, profesionales, arbolServ, arbolProd } = todo
  const out: Landing[] = []

  // Servicios: categoría › grupo (opcional) › rubro.
  const pros = profesionales.filter((p) => profesionalEnCiudad(p, ciudad as any))
  for (const c of arbolServ.categorias || []) {
    const deCat = pros.filter((p) => (c.rubros || []).some((r: any) => r.id === p.rubro))
    if (!deCat.length) continue
    out.push({ tipo: 'servicios', slug: c.id, label: c.label, nivel: 'categoria', ids: deCat.map((p) => p.id) })
    const grupos = new Map<string, { label: string; ids: string[] }>()
    for (const r of c.rubros || []) {
      const ids = deCat.filter((p) => p.rubro === r.id).map((p) => p.id)
      if (!ids.length) continue
      out.push({ tipo: 'servicios', slug: r.id, label: limpiarLabel(nombreOtros(r.label, c.label)), nivel: 'rubro', padre: { slug: c.id, label: c.label }, ids })
      if (r.grupo?.id) {
        const g = grupos.get(r.grupo.id) || { label: r.grupo.label, ids: [] as string[] }
        g.ids.push(...ids)
        grupos.set(r.grupo.id, g)
      }
    }
    for (const [id, g] of grupos) {
      if (out.some((l) => l.tipo === 'servicios' && l.slug === id)) continue
      out.push({ tipo: 'servicios', slug: id, label: g.label, nivel: 'grupo', padre: { slug: c.id, label: c.label }, ids: g.ids })
    }
  }

  // Productos: categoría › subcategoría (grupo). Los rubros sueltos son
  // demasiado finos para tener página propia.
  const prods = productos.filter((p) => productoEnCiudad(p, ciudad as any))
  for (const c of arbolProd.categorias || []) {
    const idsRubros = new Set((c.rubros || []).map((r: any) => r.id))
    const deCat = prods.filter((p) => idsRubros.has(p.rubro))
    if (!deCat.length) continue
    out.push({ tipo: 'productos', slug: c.id, label: c.label, nivel: 'categoria', ids: deCat.map((p) => p.id) })
    const grupos = new Map<string, { label: string; ids: string[] }>()
    for (const r of c.rubros || []) {
      if (!r.grupoId) continue
      const ids = deCat.filter((p) => p.rubro === r.id).map((p) => p.id)
      if (!ids.length) continue
      const g = grupos.get(r.grupoId) || { label: r.grupo || r.label, ids: [] as string[] }
      g.ids.push(...ids)
      grupos.set(r.grupoId, g)
    }
    for (const [id, g] of grupos) out.push({ tipo: 'productos', slug: id, label: g.label, nivel: 'grupo', padre: { slug: c.id, label: c.label }, ids: g.ids })
  }
  return out
}

// Solo los campos que muestran las páginas (lo que se guarda en caché).
const CAMPOS_PRODUCTO = ['id', 'nombre', 'precio', 'rubro', 'ciudad', 'tiendaNombre', 'thumbUrl', 'imagenUrl', 'plan', 'createdAt']
const CAMPOS_PROFESIONAL = ['id', 'nombre', 'rubro', 'especialidad', 'ciudad', 'zona', 'atiendeOnline', 'imagenUrl', 'plan', 'ratingPromedio', 'cantidadResenas', 'clicsWhatsapp']
const recortar = (o: any, campos: string[]) => Object.fromEntries(campos.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))

// Lo de una ciudad: sus páginas y los ítems que aparecen en ellas. Se
// calcula una vez por hora (unstable_cache), no en cada visita: si no,
// cada página leería todos los productos y profesionales de Firestore.
const datosCiudad = cache((ciudad: string) =>
  unstable_cache(
    async () => {
      const todo = await leerTodo()
      const landings = await calcularLandings(ciudad, todo)
      const usados = new Set(landings.flatMap((l) => l.ids))
      return {
        landings,
        productos: todo.productos.filter((p) => usados.has(p.id)).map((p) => recortar(p, CAMPOS_PRODUCTO)),
        profesionales: todo.profesionales
          .filter((p) => usados.has(p.id))
          .map((p) => ({ ...recortar(p, CAMPOS_PROFESIONAL), servicios: Array.isArray(p.servicios) ? p.servicios.slice(0, 3).map((x: any) => String(x?.nombre || x)) : [] })),
      }
    },
    ['landing-ciudad', ciudad],
    { revalidate: 3600 },
  )(),
)

export const landingsDeCiudad = async (ciudad: string) => (await datosCiudad(ciudad)).landings

export async function buscarLanding(ciudad: string, tipo: 'servicios' | 'productos', slug: string) {
  return (await landingsDeCiudad(ciudad)).find((l) => l.tipo === tipo && l.slug === slug) || null
}

export async function itemsDeLanding(ciudad: string, l: Landing): Promise<any[]> {
  const d = await datosCiudad(ciudad)
  const ids = new Set(l.ids)
  return (l.tipo === 'servicios' ? d.profesionales : d.productos).filter((p: any) => ids.has(p.id))
}

export const urlLanding = (ciudad: string, l: Pick<Landing, 'tipo' | 'slug'>) => `/${ciudad}/${l.tipo}/${l.slug}`

export const nombreCiudad = (id: string) => buscarCiudad(id).nombre
export { ciudadDe }
