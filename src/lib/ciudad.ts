'use client'

import { useEffect, useState } from 'react'
import { CIUDAD_POR_DEFECTO, buscarCiudad, esCiudadId, type CiudadId } from '@/data/ciudades'

// Ciudad del comprador. Orden de prioridad:
// 1. La que eligió a mano (se guarda en este navegador).
// 2. Si no eligió: Potosí (donde están hoy los usuarios). La sugerida por
//    IP (cookie del middleware) solo se usa para PROPONERLA en el cartel,
//    porque en Bolivia la IP del celular suele caer en La Paz.
// Solo se ofrecen las ciudades abiertas (/api/ciudades); si hay una
// sola, no se muestra nada de esto.

const CLAVE = 'clasiclick_ciudad'
const EVENTO = 'clasiclick:ciudad'

export type CiudadPublica = { id: CiudadId; nombre: string; departamento: string; activa: boolean; envioClasiClick: boolean }

let cacheCiudades: Promise<CiudadPublica[]> | null = null
export function cargarCiudades(fresco = false): Promise<CiudadPublica[]> {
  if (!cacheCiudades || fresco) {
    cacheCiudades = fetch(`/api/ciudades${fresco ? `?t=${Date.now()}` : ''}`)
      .then((r) => r.json())
      .then((d) => (d.ciudades || []) as CiudadPublica[])
      .catch(() => [])
  }
  return cacheCiudades
}

function leerElegida(): CiudadId | null {
  try {
    const v = localStorage.getItem(CLAVE)
    return esCiudadId(v) ? v : null
  } catch {
    return null
  }
}

function leerSugerida(): CiudadId | null {
  const m = document.cookie.match(/(?:^|;\s*)clasiclick_ciudad_ip=([^;]+)/)
  const v = m ? decodeURIComponent(m[1]) : null
  return esCiudadId(v) ? v : null
}

export function elegirCiudad(id: CiudadId) {
  try { localStorage.setItem(CLAVE, id) } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO))
}

export function useCiudad() {
  const [elegida, setElegida] = useState<CiudadId | null>(null)
  const [sugerida, setSugerida] = useState<CiudadId | null>(null)
  const [abiertas, setAbiertas] = useState<CiudadPublica[]>([])
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const leer = () => {
      setElegida(leerElegida())
      setSugerida(leerSugerida())
    }
    leer()
    cargarCiudades().then((cs) => {
      setAbiertas(cs.filter((c) => c.activa))
      setListo(true)
    })
    window.addEventListener(EVENTO, leer)
    window.addEventListener('storage', leer)
    return () => {
      window.removeEventListener(EVENTO, leer)
      window.removeEventListener('storage', leer)
    }
  }, [])

  // Si eligió una ciudad que después se cerró, vuelve a Potosí.
  const valida = elegida && abiertas.some((c) => c.id === elegida) ? elegida : null
  const ciudadId: CiudadId = valida || CIUDAD_POR_DEFECTO
  return {
    ciudadId,
    ciudad: buscarCiudad(ciudadId),
    elegida: valida,
    sugerida: sugerida && abiertas.some((c) => c.id === sugerida) ? sugerida : null,
    abiertas,
    // Hay más de una ciudad abierta → mostrar selector y cartel.
    multiciudad: listo && abiertas.length > 1,
    elegir: elegirCiudad,
  }
}
