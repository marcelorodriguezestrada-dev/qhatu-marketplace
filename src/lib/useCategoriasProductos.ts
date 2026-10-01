'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { expandirCategoria, type CategoriaCompacta, type CategoriaProducto, type RubroProductoFlat } from '@/lib/arbolCategorias'

export type { RubroProducto, CategoriaProducto, RubroProductoFlat } from '@/lib/arbolCategorias'

// Igual que useCategorias.ts pero para el árbol de PRODUCTOS. Un solo
// lugar para que /vender, /producto/[id], el catálogo y /admin
// siempre muestren exactamente la misma clasificación.
type Arbol = { categorias: CategoriaProducto[]; rubrosFlat: RubroProductoFlat[] }

// Una sola descarga por visita (el árbol tiene ~3.200 rubros): todas las
// partes de la página que usan el hook comparten la misma respuesta.
let enCurso: Promise<Arbol> | null = null
function bajarArbol(forzar = false): Promise<Arbol> {
  if (!enCurso || forzar) {
    // Al recargar (admin) salteamos el caché del CDN con ?t=.
    enCurso = fetch(forzar ? `/api/categorias-productos?t=${Date.now()}` : '/api/categorias-productos', forzar ? { cache: 'no-store' } : undefined)
      .then((r) => r.json())
      .then((data) => {
        const categorias: CategoriaProducto[] = (data.arbol || []).map((c: CategoriaCompacta) => expandirCategoria(c))
        return { categorias, rubrosFlat: categorias.flatMap((c) => c.rubros.map((r) => ({ ...r, categoriaId: c.id, categoriaLabel: c.label }))) }
      })
      .catch((err) => {
        enCurso = null
        throw err
      })
  }
  return enCurso
}

export function useCategoriasProductos() {
  const [arbol, setArbol] = useState<Arbol>({ categorias: [], rubrosFlat: [] })
  const [cargando, setCargando] = useState(true)

  function recargar(forzar = true) {
    setCargando(true)
    bajarArbol(forzar)
      .then(setArbol)
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    recargar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const porId = useMemo(() => new Map(arbol.rubrosFlat.map((r) => [r.id, r])), [arbol])
  const buscarRubroProducto = useCallback((rubroId: string | undefined): RubroProductoFlat | undefined => (rubroId ? porId.get(rubroId) : undefined), [porId])

  return { categorias: arbol.categorias, rubrosFlat: arbol.rubrosFlat, cargando, recargar, buscarRubroProducto }
}
