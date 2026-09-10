'use client'

import { useEffect, useState } from 'react'

export type RubroProducto = { id: string; label: string }
export type CategoriaProducto = { id: string; label: string; rubros: RubroProducto[] }
export type RubroProductoFlat = { id: string; label: string; categoriaId: string; categoriaLabel: string }

// Igual que useCategorias.ts pero para el árbol de PRODUCTOS. Un solo
// lugar para que /vender, /producto/[id], el catálogo y /admin
// siempre muestren exactamente la misma clasificación.
export function useCategoriasProductos() {
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([])
  const [rubrosFlat, setRubrosFlat] = useState<RubroProductoFlat[]>([])
  const [cargando, setCargando] = useState(true)

  function recargar() {
    setCargando(true)
    fetch('/api/categorias-productos')
      .then((r) => r.json())
      .then((data) => {
        setCategorias(data.categorias || [])
        setRubrosFlat(data.rubrosFlat || [])
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buscarRubroProducto(rubroId: string | undefined): RubroProductoFlat | undefined {
    if (!rubroId) return undefined
    return rubrosFlat.find((r) => r.id === rubroId)
  }

  return { categorias, rubrosFlat, cargando, recargar, buscarRubroProducto }
}
