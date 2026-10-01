// Árbol de categorías de PRODUCTOS en 3 niveles, como Mercado Libre:
// Categoría › Subcategoría (grupo) › Rubro. El rubro es la hoja y es lo
// que guarda cada producto (`producto.rubro`). Algunas categorías tienen
// además rubros sueltos, sin subcategoría (ej: Ropa › Blusas).
//
// Por la red viaja compacto (`CategoriaCompacta`, sin repetir el nombre
// de la subcategoría en cada rubro) y en el navegador se expande con
// `expandirCategoria` — este archivo no tiene datos, solo las funciones,
// para que la página no cargue el árbol entero en el JavaScript.

export type RubroProducto = { id: string; label: string; grupoId?: string; grupo?: string }
export type CategoriaProducto = { id: string; label: string; rubros: RubroProducto[] }
export type GrupoCompacto = { id: string; label: string; rubros: [string, string][] }
export type CategoriaCompacta = { id: string; label: string; rubros: [string, string][]; grupos: GrupoCompacto[] }
export type RubroProductoFlat = { id: string; label: string; categoriaId: string; categoriaLabel: string; grupoId?: string; grupo?: string }

export function expandirCategoria(c: CategoriaCompacta): CategoriaProducto {
  return {
    id: c.id,
    label: c.label,
    rubros: [
      ...(c.rubros || []).map(([id, label]) => ({ id, label })),
      ...(c.grupos || []).flatMap((g) => g.rubros.map(([id, label]) => ({ id, label, grupoId: g.id, grupo: g.label }))),
    ],
  }
}

export function compactarCategoria(c: CategoriaProducto): CategoriaCompacta {
  const grupos = new Map<string, GrupoCompacto>()
  const sueltos: [string, string][] = []
  for (const r of c.rubros) {
    if (!r.grupoId) { sueltos.push([r.id, r.label]); continue }
    if (!grupos.has(r.grupoId)) grupos.set(r.grupoId, { id: r.grupoId, label: r.grupo || r.grupoId, rubros: [] })
    grupos.get(r.grupoId)!.rubros.push([r.id, r.label])
  }
  return { id: c.id, label: c.label, rubros: sueltos, grupos: [...grupos.values()] }
}

// Subcategorías de una categoría (con sus rubros), en orden.
export function gruposDe(c: CategoriaProducto): { id: string; label: string; rubros: RubroProducto[] }[] {
  const m = new Map<string, { id: string; label: string; rubros: RubroProducto[] }>()
  for (const r of c.rubros) {
    if (!r.grupoId) continue
    if (!m.has(r.grupoId)) m.set(r.grupoId, { id: r.grupoId, label: r.grupo || r.grupoId, rubros: [] })
    m.get(r.grupoId)!.rubros.push(r)
  }
  return [...m.values()]
}

// "Otros" / "Otra ropa" al final de cada lista.
export const esOtro = (label: string) => /^otr[oa]s?\b/i.test(label.trim())
export const ordenarRubros = (a: RubroProducto, b: RubroProducto) =>
  esOtro(a.label) === esOtro(b.label) ? a.label.localeCompare(b.label, 'es') : esOtro(a.label) ? 1 : -1

// Nombre para mostrar: un rubro "Otros" solo no dice nada, así que va
// con su subcategoría ("Calzado · otros").
export const nombreRubro = (r?: { label: string; grupo?: string } | null) =>
  !r ? '' : esOtro(r.label) && r.grupo ? `${r.grupo} · otros` : r.label
