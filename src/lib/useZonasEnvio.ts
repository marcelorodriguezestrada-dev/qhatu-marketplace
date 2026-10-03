'use client'

import { useEffect, useState } from 'react'
import { armarZonas, type ZonaEnvio, type ZonaExtra } from '@/lib/zonasEnvio'

// Lista de zonas de envío (las fijas + las que agregó el admin). Arranca
// con las fijas y suma las agregadas apenas llegan; se pide una sola vez.
let cache: Promise<ZonaExtra[]> | null = null

export function useZonasEnvio(): ZonaEnvio[] {
  const [zonas, setZonas] = useState<ZonaEnvio[]>(() => armarZonas())
  useEffect(() => {
    cache ||= fetch('/api/zonas-envio').then((r) => r.json()).then((d) => d.extras || []).catch(() => [])
    let vivo = true
    cache.then((extras) => { if (vivo && extras.length) setZonas(armarZonas(extras)) })
    return () => { vivo = false }
  }, [])
  return zonas
}
