'use client'

import { useEffect, useState } from 'react'

export type Rubro = { id: string; label: string }
export type Categoria = { id: string; label: string; rubros: Rubro[] }
export type RubroFlat = { id: string; label: string; categoriaId: string; categoriaLabel: string }

// Trae el árbol Categoría > Rubro ya armado (base del código + lo que
// se agregó desde /admin) desde /api/categorias. Un solo lugar para
// que el selector de /servicios, /publicar-servicio y /admin, y las
// migas de pan de los perfiles, siempre muestren exactamente lo mismo.
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [rubrosFlat, setRubrosFlat] = useState<RubroFlat[]>([])
  const [cargando, setCargando] = useState(true)

  function recargar() {
    setCargando(true)
    fetch('/api/categorias')
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

  function buscarRubro(rubroId: string): RubroFlat | undefined {
    return rubrosFlat.find((r) => r.id === rubroId)
  }

  return { categorias, rubrosFlat, cargando, recargar, buscarRubro }
}
