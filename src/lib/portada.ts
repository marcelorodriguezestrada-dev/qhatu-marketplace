'use client'

import { useEffect, useState } from 'react'

// Qué secciones de la portada se muestran (Admin → Banners → "Qué se ve
// en la portada"). Se guarda en Firestore config/portada; sin nada
// guardado, se ve todo.
export const SECCIONES_PORTADA = [
  { id: 'hero', label: '🟢 Portada con el lema (“Ahorrá tiempo. Viví más feliz.”)', ayuda: 'El cartel grande de arriba con el logo y los botones Ver productos / Vendé gratis.' },
  { id: 'tarjetas', label: '🧾 Tarjetas informativas', ayuda: 'Tu carrito, visto recientemente, medios de pago, envío, menos de Bs 50, vendé gratis.' },
  { id: 'categorias', label: '🗂️ Categorías con íconos', ayuda: 'El bloque de categorías con productos.' },
  { id: 'carruseles', label: '✨ “Inspirado en lo que viste” y “Recién llegados”', ayuda: 'Las filas de productos antes de la grilla.' },
  { id: 'ofertas', label: '🔥 Ofertas', ayuda: 'La fila de productos con descuento.' },
  { id: 'cupon', label: '🚚 Banner del cupón (envío gratis / descuento)', ayuda: 'El aviso del cupón destacado, en la portada y en cada producto.' },
  { id: 'banners', label: '🖼️ Banners de Clasi Click', ayuda: 'El carrusel de imágenes que cargás acá abajo.' },
  { id: 'accesos', label: '🛍️ Accesos con íconos', ayuda: 'La fila de íconos: Productos, Ofertas, Servicios, Anuncios, Vender…' },
] as const

export type SeccionPortada = (typeof SECCIONES_PORTADA)[number]['id']
export type ConfigPortada = Record<SeccionPortada, boolean>

export const PORTADA_POR_DEFECTO: ConfigPortada = { hero: true, tarjetas: true, categorias: true, carruseles: true, ofertas: true, cupon: true, banners: true, accesos: true }

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
