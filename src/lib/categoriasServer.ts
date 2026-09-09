import { getDb } from '@/lib/firebaseAdmin'
import { CATEGORIAS_BASE, CATEGORIA_FALLBACK_ID, type Categoria } from '@/data/categorias'

// Arma el árbol final Categoría > Rubro combinando:
// 1. La base fija del código (src/data/categorias.ts)
// 2. Categorías que el admin agregó a mano (`categorias_personalizadas`)
// 3. Rubros que el admin agregó a mano, o que un profesional escribió
//    al elegir "Otro" en el formulario (`rubros_personalizados`,
//    cada uno ya con la categoría a la que pertenece)
// 4. Reubicaciones: rubros de la base que el admin decidió mover a
//    otra categoría porque no correspondían (`rubro_categoria_overrides`)
//
// Vive en src/lib y no en el route.ts de /api/categorias porque un
// archivo route.ts de Next.js solo puede exportar handlers HTTP
// (GET, POST, etc.) y config — cualquier otra función exportada ahí
// rompe el build ("no es un campo de ruta válido").
export async function construirArbolCategorias() {
  const db = getDb()
  const [personalizadasSnap, rubrosSnap, overridesSnap] = await Promise.all([
    db.collection('categorias_personalizadas').get(),
    db.collection('rubros_personalizados').get(),
    db.collection('rubro_categoria_overrides').get(),
  ])

  const personalizadas = new Map(personalizadasSnap.docs.map((d) => [d.id, (d.data() as any).label as string]))

  const mapa = new Map<string, Categoria>()
  for (const c of CATEGORIAS_BASE) {
    // Si el admin le cambió el nombre a una categoría de la base
    // (misma id, otro label), usamos ese nombre en vez del original.
    mapa.set(c.id, { id: c.id, label: personalizadas.get(c.id) || c.label, rubros: [...c.rubros] })
  }
  for (const [id, label] of personalizadas) {
    if (mapa.has(id)) continue
    mapa.set(id, { id, label: label || id, rubros: [] })
  }

  // Reubicar rubros base que el admin movió a otra categoría.
  const overrides = new Map<string, string>()
  for (const doc of overridesSnap.docs) {
    overrides.set(doc.id, (doc.data() as any).categoriaId)
  }
  if (overrides.size > 0) {
    for (const cat of mapa.values()) {
      cat.rubros = cat.rubros.filter((r) => {
        const destino = overrides.get(r.id)
        if (!destino || destino === cat.id || !mapa.has(destino)) return true
        mapa.get(destino)!.rubros.push(r)
        return false
      })
    }
  }

  // Rubros personalizados (agregados por admin o por usuarios vía "Otro").
  for (const doc of rubrosSnap.docs) {
    const data = doc.data() as any
    const yaExiste = [...mapa.values()].some((c) => c.rubros.some((r) => r.id === doc.id))
    if (yaExiste) continue
    const categoriaId = overrides.get(doc.id) || data.categoriaId || CATEGORIA_FALLBACK_ID
    const destino = mapa.has(categoriaId) ? categoriaId : CATEGORIA_FALLBACK_ID
    mapa.get(destino)!.rubros.push({ id: doc.id, label: data.label || doc.id })
  }

  const ordenBase = CATEGORIAS_BASE.map((c) => c.id)
  const categorias = [...mapa.values()]
    .map((c) => ({
      ...c,
      rubros: [...c.rubros].sort((a, b) => (a.id === 'otro' ? 1 : b.id === 'otro' ? -1 : a.label.localeCompare(b.label, 'es'))),
    }))
    .sort((a, b) => {
      const oa = ordenBase.indexOf(a.id)
      const ob = ordenBase.indexOf(b.id)
      if (a.id === CATEGORIA_FALLBACK_ID) return 1
      if (b.id === CATEGORIA_FALLBACK_ID) return -1
      if (oa === -1 && ob === -1) return a.label.localeCompare(b.label, 'es')
      if (oa === -1) return 1
      if (ob === -1) return -1
      return oa - ob
    })

  const rubrosFlat = categorias.flatMap((c) =>
    c.rubros.map((r) => ({ id: r.id, label: r.label, categoriaId: c.id, categoriaLabel: c.label }))
  )

  return { categorias, rubrosFlat }
}
