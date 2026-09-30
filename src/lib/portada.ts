'use client'

import { useEffect, useState } from 'react'

// Qué secciones de la portada se muestran (Admin → Banners → "Qué se ve
// en la portada"). Se guarda en Firestore config/portada; sin nada
// guardado, se ve todo.
export const SECCIONES_PORTADA = [
  { id: 'ofertas', label: '🔥 Ofertas', ayuda: 'La fila de productos con descuento.' },
  { id: 'cupon', label: '🚚 Banner del cupón (envío gratis / descuento)', ayuda: 'El aviso del cupón destacado, en la portada y en cada producto.' },
  { id: 'banners', label: '🖼️ Banners de Clasi Click', ayuda: 'El carrusel de imágenes que cargás acá abajo.' },
  { id: 'accesos', label: '🛍️ Botones Productos / Servicios', ayuda: 'Los dos botones grandes de arriba.' },
] as const

export type SeccionPortada = (typeof SECCIONES_PORTADA)[number]['id']
export type ConfigPortada = Record<SeccionPortada, boolean>

export const PORTADA_POR_DEFECTO: ConfigPortada = { ofertas: true, cupon: true, banners: true, accesos: true }

let cache: Promise<ConfigPortada> | null = null
export function cargarPortada(forzar = false): Promise<ConfigPortada> {
  if (!cache || forzar) {
    cache = fetch('/api/portada', forzar ? { cache: 'no-store' } : undefined)
      .then((r) => r.json())
      .then((d) => ({ ...PORTADA_POR_DEFECTO, ...(d.portada || {}) }))
      .catch(() => PORTADA_POR_DEFECTO)
  }
  return cache
}

// null mientras carga: las secciones apagables esperan a saberlo para
// no aparecer y desaparecer.
export function usePortada(): ConfigPortada | null {
  const [config, setConfig] = useState<ConfigPortada | null>(null)
  useEffect(() => {
    let vivo = true
    cargarPortada().then((c) => vivo && setConfig(c))
    return () => { vivo = false }
  }, [])
  return config
}
