import { generarEtiquetasBusquedaIA } from '@/lib/moderacionIA'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Arma el contexto (nombres de categoría y rubro) y pide las etiquetas.
export async function etiquetasParaProducto(p: any): Promise<string[]> {
  let categorias: CategoriaProducto[] = CATEGORIAS_PRODUCTOS_BASE
  try { categorias = (await construirArbolCategoriasProductos()).categorias } catch {}
  const cat = categorias.find((c) => c.rubros.some((r) => r.id === p.rubro))
  const rub = cat?.rubros.find((r) => r.id === p.rubro)
  return generarEtiquetasBusquedaIA({
    nombre: p.nombre,
    categoria: cat?.label,
    rubro: rub ? [rub.grupo, rub.label].filter(Boolean).join(' > ') : undefined,
    publico: p.publico,
    descripcion: [p.descripcionCorta, p.descripcionLarga].filter(Boolean).join(' — '),
    colores: p.colores,
    materiales: p.materiales,
  })
}
