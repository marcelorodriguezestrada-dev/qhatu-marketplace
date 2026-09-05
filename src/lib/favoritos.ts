'use client'

import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'clasiclick_favoritos'

function leerFavoritos(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const guardado = localStorage.getItem(STORAGE_KEY)
    return guardado ? JSON.parse(guardado) : []
  } catch {
    return []
  }
}

// Favoritos guardados en el navegador (localStorage), no en Firestore —
// es una preferencia local del dispositivo, no hace falta cuenta ni
// backend para algo tan liviano. Si en algún momento se quiere que los
// favoritos viajen entre dispositivos, ahí sí conviene moverlos a
// Firestore atados al usuario logueado.
export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>([])

  useEffect(() => {
    setFavoritos(leerFavoritos())
  }, [])

  const toggleFavorito = useCallback((id: string | number) => {
    setFavoritos((prev) => {
      const idStr = String(id)
      const next = prev.includes(idStr) ? prev.filter((f) => f !== idStr) : [...prev, idStr]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const esFavorito = useCallback((id: string | number) => favoritos.includes(String(id)), [favoritos])

  return { favoritos, toggleFavorito, esFavorito }
}
