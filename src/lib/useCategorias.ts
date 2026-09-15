'use client'

import { useEffect, useState } from 'react'

export type Grupo = { id: string; label: string }
export type Rubro = { id: string; label: string; grupo?: Grupo }
export type Categoria = { id: string; label: string; rubros: Rubro[] }
export type RubroFlat = {
  id: string
  label: string
  categoriaId: string
  categoriaLabel: string
  grupoId: string | null
  grupoLabel: string | null
}

// Trae el árbol Categoría > Grupo (opcional) > Rubro ya armado (base del
// código + lo que se agregó desde /admin) desde /api/categorias. Un solo
// lugar para que el selector de /servicios, /publicar-servicio y /admin,
// y las migas de pan de los perfiles, siempre muestren exactamente lo
// mismo.
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

/**
 * Parte los rubros de una categoría en bloques por grupo, manteniendo el
 * orden que ya trae el servidor. Los rubros sin grupo van al final, en
 * un bloque con label null (para renderizarlos sueltos, sin <optgroup>).
 *
 * Lo usan los <select> de servicios / publicar-servicio / admin para
 * mostrar el tercer nivel como <optgroup>: "Salud" abre el grupo
 * "Médicos" y ahí adentro están Ginecólogo, Neurocirujano, etc.
 */
export function agruparRubros(rubros: Rubro[]): { grupoId: string | null; grupoLabel: string | null; rubros: Rubro[] }[] {
  const bloques: { grupoId: string | null; grupoLabel: string | null; rubros: Rubro[] }[] = []
  for (const rubro of rubros) {
    const gid = rubro.grupo?.id || null
    const ultimo = bloques[bloques.length - 1]
    if (ultimo && ultimo.grupoId === gid) {
      ultimo.rubros.push(rubro)
    } else {
      bloques.push({ grupoId: gid, grupoLabel: rubro.grupo?.label || null, rubros: [rubro] })
    }
  }
  return bloques
}
