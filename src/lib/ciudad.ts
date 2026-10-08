'use client'

import { useEffect, useState } from 'react'
import { CIUDAD_POR_DEFECTO, buscarCiudad, esCiudadId, registrarCiudades, todasLasCiudades, type Ciudad, type CiudadId, type EstadoCiudad, type ZonaCiudad } from '@/data/ciudades'
import { useAuth } from '@/lib/auth'

// Ciudad del comprador. Orden de prioridad:
// 1. La que eligió a mano (se guarda en este navegador).
// 2. Si no eligió: Potosí (donde están hoy los usuarios). La sugerida por
//    IP (cookie del middleware) solo se usa para PROPONERLA en el cartel,
//    porque en Bolivia la IP del celular suele caer en La Paz.
// Solo se ofrecen las ciudades abiertas (/api/ciudades); si hay una
// sola, no se muestra nada de esto.

const CLAVE = 'clasiclick_ciudad'
const EVENTO = 'clasiclick:ciudad'

export type CiudadPublica = {
  id: CiudadId
  nombre: string
  departamento: string
  pais: string
  estado: EstadoCiudad
  // abierta para todos / solo para cuentas de prueba
  activa: boolean
  prueba: boolean
  envioClasiClick: boolean
  extra: boolean
  centro: Ciudad['centro']
  zonas: ZonaCiudad[]
}
export type PaisPublico = { id: string; nombre: string; bandera: string; moneda: string; simboloMoneda: string; prefijoTel: string; digitosTel: number; zonaHoraria: string }

let cachePaises: PaisPublico[] = []
export const paisesCargados = () => cachePaises

let cacheCiudades: Promise<CiudadPublica[]> | null = null
export function cargarCiudades(fresco = false): Promise<CiudadPublica[]> {
  if (!cacheCiudades || fresco) {
    cacheCiudades = fetch(`/api/ciudades${fresco ? `?t=${Date.now()}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        const cs = (d.ciudades || []) as CiudadPublica[]
        cachePaises = (d.paises || []) as PaisPublico[]
        // Las ciudades agregadas desde el admin: así buscarCiudad() las conoce.
        registrarCiudades(cs.filter((c) => c.extra).map((c) => ({ ...c, activa: c.activa, regionesIP: [], ciudadesIP: [] })))
        return cs
      })
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
  // Las ciudades "en prueba" solo las ven las cuentas de prueba; una
  // cuenta de prueba de una ciudad (ej. test-buenos-aires@test.com)
  // arranca en esa ciudad.
  const { esPrueba, ciudadPrueba } = useAuth()
  const [elegida, setElegida] = useState<CiudadId | null>(null)
  const [sugerida, setSugerida] = useState<CiudadId | null>(null)
  const [todas, setTodas] = useState<CiudadPublica[]>([])
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const leer = () => {
      setElegida(leerElegida())
      setSugerida(leerSugerida())
    }
    leer()
    cargarCiudades().then((cs) => {
      setTodas(cs)
      setListo(true)
    })
    window.addEventListener(EVENTO, leer)
    window.addEventListener('storage', leer)
    return () => {
      window.removeEventListener(EVENTO, leer)
      window.removeEventListener('storage', leer)
    }
  }, [])

  const abiertas = todas.filter((c) => c.activa || (c.prueba && esPrueba))
  // Si eligió una ciudad que después se cerró, vuelve a Potosí (o a la de
  // su cuenta de prueba).
  const valida = elegida && abiertas.some((c) => c.id === elegida) ? elegida : null
  const dePrueba = esPrueba && ciudadPrueba && abiertas.some((c) => c.id === ciudadPrueba) ? ciudadPrueba : null
  const ciudadId: CiudadId = valida || dePrueba || CIUDAD_POR_DEFECTO
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

// Todas las ciudades conocidas (también las agregadas desde el admin y
// las cerradas), para los selectores del admin y de "viaja a".
export function useTodasLasCiudades(): Ciudad[] {
  const [lista, setLista] = useState<Ciudad[]>(() => todasLasCiudades())
  useEffect(() => {
    cargarCiudades().then(() => setLista(todasLasCiudades()))
  }, [])
  return lista
}
