'use client'

import { auth } from '@/lib/firebaseClient'
import type { TipoInteres } from '@/lib/recuperacion'

// Avisa al servidor que el usuario (logueado) se interesó en un producto,
// para "Estabas mirando esto" (ver src/lib/recuperacion.ts). Filtra acá
// para no gastar escrituras:
//  - "visto": solo desde la 2ª vez que abre el mismo producto (en 3 días),
//    y después como mucho una vez por día.
//  - "carrito": como mucho una vez cada 6 horas por producto.
export function registrarInteres(productoId: string | number, tipo: TipoInteres, nombre?: string) {
  if (typeof window === 'undefined') return
  const usuario = auth?.currentUser
  if (!usuario) return
  const pid = String(productoId)
  const ahora = Date.now()
  try {
    const clave = `cc_interes_${pid}`
    const d = JSON.parse(localStorage.getItem(clave) || '{}') as { vistas?: number[]; enviadoVisto?: number; enviadoCarrito?: number }
    if (tipo === 'visto') {
      d.vistas = [...(d.vistas || []).filter((t) => ahora - t < 3 * 86400_000), ahora].slice(-5)
      localStorage.setItem(clave, JSON.stringify(d))
      if (d.vistas.length < 2 || (d.enviadoVisto && ahora - d.enviadoVisto < 86400_000)) return
      d.enviadoVisto = ahora
    } else {
      if (d.enviadoCarrito && ahora - d.enviadoCarrito < 6 * 3600_000) return
      d.enviadoCarrito = ahora
    }
    localStorage.setItem(clave, JSON.stringify(d))
  } catch {
    return
  }
  usuario
    .getIdToken()
    .then((token) =>
      fetch('/api/interes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productoId: pid, tipo, nombre: nombre || '' }),
        keepalive: true,
      })
    )
    .catch(() => {})
}
