'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Producto } from '@/data/productos'

export type ItemCarrito = Producto & {
  cantidad: number
  // La talla/color que la persona eligió para ESTA línea del carrito —
  // distinto de `talles`/`colores`, que son todas las opciones
  // disponibles del producto. Opcionales: hay productos sin variantes.
  tallaElegida?: string
  colorElegida?: string
  // Cuándo se agregó (ms): el carrito guarda cada producto 15 días.
  agregadoAt?: number
}

// Identifica una línea del carrito — dos unidades del mismo producto
// con la MISMA talla y color son una sola línea (se suma la cantidad);
// con talla o color distintos, son líneas separadas (no se mezclan).
function claveLinea(i: { id: number | string; tallaElegida?: string; colorElegida?: string }): string {
  return `${i.id}__${i.tallaElegida || ''}__${i.colorElegida || ''}`
}

type CarritoContextType = {
  items: ItemCarrito[]
  agregar: (p: Producto, opciones?: { talla?: string; color?: string }) => void
  cambiarCantidad: (item: ItemCarrito, delta: number) => void
  quitar: (item: ItemCarrito) => void
  vaciar: () => void
  // Vacía solo los productos de UNA tienda — se usa después de pagarle
  // a esa tienda en particular, dejando intactos los productos de
  // otras tiendas que sigan pendientes en el carrito. `null` para el
  // "cajón" de productos sin vendedorId asignado (vendidos directo por
  // la plataforma).
  vaciarTienda: (vendedorId: string | null) => void
  total: number
}

const CarritoContext = createContext<CarritoContextType | null>(null)

const STORAGE_KEY = 'clasiclick_carrito'
// Cada producto queda en el carrito 15 días desde que se agregó (o se le
// cambió la cantidad); después se saca solo, para no ofrecer precios o
// stock viejos. Los de antes de esta regla cuentan desde hoy.
export const DIAS_CARRITO = 15

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)

  // Cargar el carrito guardado al montar (solo corre en el browser).
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) {
        const ahora = Date.now()
        const lista: ItemCarrito[] = JSON.parse(guardado)
        setItems(lista.map((i) => ({ ...i, agregadoAt: i.agregadoAt || ahora })).filter((i) => ahora - (i.agregadoAt as number) < DIAS_CARRITO * 86400000))
      }
    } catch {
      // Si el JSON está corrupto, arrancamos con carrito vacío en vez de romper la app.
    }
    setCargado(true)
  }, [])

  // Persistir cada cambio, una vez que ya cargamos el estado inicial
  // (para no pisar lo guardado con un array vacío en el primer render).
  useEffect(() => {
    if (cargado) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, cargado])

  function agregar(p: Producto, opciones?: { talla?: string; color?: string }) {
    const nuevo: ItemCarrito = { ...p, cantidad: 1, tallaElegida: opciones?.talla, colorElegida: opciones?.color, agregadoAt: Date.now() }
    const clave = claveLinea(nuevo)
    setItems((prev) => {
      const existe = prev.find((i) => claveLinea(i) === clave)
      // Tope por el stock que se conocía al agregar (el servidor lo vuelve
      // a controlar al comprar).
      const tope = (i: ItemCarrito) => (typeof p.stock === 'number' ? Math.min(i.cantidad + 1, Math.max(1, p.stock)) : i.cantidad + 1)
      if (existe) return prev.map((i) => (claveLinea(i) === clave ? { ...i, cantidad: tope(i), agregadoAt: Date.now() } : i))
      return [...prev, nuevo]
    })
  }

  function cambiarCantidad(item: ItemCarrito, delta: number) {
    const clave = claveLinea(item)
    setItems((prev) =>
      prev.map((i) =>
        claveLinea(i) === clave
          ? { ...i, agregadoAt: Date.now(), cantidad: Math.max(1, typeof i.stock === 'number' ? Math.min(Math.max(1, i.stock), i.cantidad + delta) : i.cantidad + delta) }
          : i
      )
    )
  }

  function quitar(item: ItemCarrito) {
    const clave = claveLinea(item)
    setItems((prev) => prev.filter((i) => claveLinea(i) !== clave))
  }

  function vaciar() {
    setItems([])
  }

  function vaciarTienda(vendedorId: string | null) {
    setItems((prev) => prev.filter((i) => (i.vendedorId || null) !== vendedorId))
  }

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  return (
    <CarritoContext.Provider value={{ items, agregar, cambiarCantidad, quitar, vaciar, vaciarTienda, total }}>
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
