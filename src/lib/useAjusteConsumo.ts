'use client'

import { useEffect, useState } from 'react'
import { AJUSTES, type IdAjuste } from '@/lib/ajustesConsumo'

// Cada cuánto preguntar (en ms), según Admin → Consumo de la base. Se pide
// una vez por carga de página; mientras tanto, el valor de siempre.
let pedido: Promise<Record<string, number>> | null = null

export function useAjusteConsumo(id: 'campanita' | 'seguimiento' | 'alarma'): number {
  const [segundos, setSegundos] = useState(AJUSTES[id as IdAjuste].defecto)
  useEffect(() => {
    let vivo = true
    pedido = pedido || fetch('/api/ajustes-consumo').then((r) => r.json()).catch(() => ({}))
    pedido.then((d) => { if (vivo && typeof d?.[id] === 'number' && d[id] > 0) setSegundos(d[id]) })
    return () => { vivo = false }
  }, [id])
  return segundos * 1000
}
