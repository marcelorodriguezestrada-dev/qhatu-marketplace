import { getDb } from '@/lib/firebaseAdmin'
import { CATEGORIAS_PRODUCTOS_BASE, CATEGORIA_PRODUCTO_FALLBACK_ID, CATEGORIA_PRODUCTO_ALIAS, type CategoriaProducto } from '@/data/categoriasProductos'
import { ordenarRubros } from '@/lib/arbolCategorias'

const alias = (id: string) => CATEGORIA_PRODUCTO_ALIAS[id] || id

// Arma el árbol final Categoría › Subcategoría › Rubro de PRODUCTOS combinando:
// 1. La base fija del código (src/data/categoriasProductos.ts)
// 2. Categorías que el admin agregó a mano (`categorias_productos_personalizadas`)
// 3. Rubros que el admin agregó a mano (`rubros_productos_personalizados`)
// 4. Reubicaciones: rubros de la base que el admin movió a otra
//    categoría (`rubro_producto_categoria_overrides`)
//
// Es el mismo esquema que src/lib/categoriasServer.ts usa para
// profesionales, pero apuntando a las colecciones de productos —
// están separadas para no mezclar el árbol de rubros de servicios con
// el de rubros de productos.
export async function construirArbolCategoriasProductos() {
  const db = getDb()
  const [personalizadasSnap, rubrosSnap, overridesSnap] = await Promise.all([
    db.collection('categorias_productos_personalizadas').get(),
    db.collection('rubros_productos_personalizados').get(),
    db.collection('rubro_producto_categoria_overrides').get(),
  ])

  const personalizadas = new Map(personalizadasSnap.docs.map((d) => [d.id, (d.data() as any).label as string]))

  const mapa = new Map<string, CategoriaProducto>()
  for (const c of CATEGORIAS_PRODUCTOS_BASE) {
    mapa.set(c.id, { id: c.id, label: personalizadas.get(c.id) || c.label, rubros: [...c.rubros] })
  }
  for (const [id, label] of personalizadas) {
    if (mapa.has(id) || CATEGORIA_PRODUCTO_ALIAS[id]) continue
    mapa.set(id, { id, label: label || id, rubros: [] })
  }

  const overrides = new Map<string, string>()
  for (const doc of overridesSnap.docs) {
    overrides.set(doc.id, alias((doc.data() as any).categoriaId))
  }
  if (overrides.size > 0) {
    for (const cat of mapa.values()) {
      cat.rubros = cat.rubros.filter((r) => {
        const destino = overrides.get(r.id)
        if (!destino || destino === cat.id || !mapa.has(destino)) return true
        // Movido a otra categoría: queda suelto (sin la subcategoría vieja).
        mapa.get(destino)!.rubros.push({ id: r.id, label: r.label })
        return false
      })
    }
  }

  for (const doc of rubrosSnap.docs) {
    const data = doc.data() as any
    const yaExiste = [...mapa.values()].some((c) => c.rubros.some((r) => r.id === doc.id))
    if (yaExiste) continue
    const categoriaId = overrides.get(doc.id) || alias(data.categoriaId || '') || CATEGORIA_PRODUCTO_FALLBACK_ID
    const destino = mapa.has(categoriaId) ? categoriaId : CATEGORIA_PRODUCTO_FALLBACK_ID
    mapa.get(destino)!.rubros.push({ id: doc.id, label: data.label || doc.id })
  }

  const ordenBase = CATEGORIAS_PRODUCTOS_BASE.map((c) => c.id)
  const categorias = [...mapa.values()]
    .map((c) => ({
      ...c,
      // Subcategorías en su orden; dentro de cada una (y los sueltos)
      // alfabético con "Otros" al final.
      rubros: (() => {
        const sueltos = c.rubros.filter((r) => !r.grupoId).sort(ordenarRubros)
        const orden: string[] = []
        for (const r of c.rubros) if (r.grupoId && !orden.includes(r.grupoId)) orden.push(r.grupoId)
        return [...sueltos, ...orden.flatMap((g) => c.rubros.filter((r) => r.grupoId === g).sort(ordenarRubros))]
      })(),
    }))
    .sort((a, b) => {
      const oa = ordenBase.indexOf(a.id)
      const ob = ordenBase.indexOf(b.id)
      if (a.id === CATEGORIA_PRODUCTO_FALLBACK_ID) return 1
      if (b.id === CATEGORIA_PRODUCTO_FALLBACK_ID) return -1
      if (oa === -1 && ob === -1) return a.label.localeCompare(b.label, 'es')
      if (oa === -1) return 1
      if (ob === -1) return -1
      return oa - ob
    })

  const rubrosFlat = categorias.flatMap((c) =>
    c.rubros.map((r) => ({ id: r.id, label: r.label, categoriaId: c.id, categoriaLabel: c.label, grupoId: r.grupoId, grupo: r.grupo }))
  )

  return { categorias, rubrosFlat }
}
