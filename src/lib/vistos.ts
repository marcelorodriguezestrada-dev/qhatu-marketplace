'use client'

// "Visto recientemente" del inicio: los últimos productos que abrió esta
// persona, guardados en este navegador (no hace falta estar logueado).
const CLAVE = 'clasiclick_vistos'
const MAX = 20

export function leerVistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '[]')
    return Array.isArray(v) ? v.map(String).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function registrarVisto(id: string | number) {
  try {
    const s = String(id)
    localStorage.setItem(CLAVE, JSON.stringify([s, ...leerVistos().filter((x) => x !== s)].slice(0, MAX)))
  } catch {}
}
