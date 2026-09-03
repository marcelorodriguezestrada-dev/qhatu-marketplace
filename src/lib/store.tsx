'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Producto } from '@/data/productos'

export type ItemCarrito = Producto & { cantidad: number }

type CarritoContextType = {
  items: ItemCarrito[]
  agregar: (p: Producto) => void
  cambiarCantidad: (id: number | string, delta: number) => void
  quitar: (id: number | string) => void
  vaciar: () => void
  total: number
}

const CarritoContext = createContext<CarritoContextType | null>(null)

const STORAGE_KEY = 'qhatu_carrito'

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)

  // Cargar el carrito guardado al montar (solo corre en el browser).
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) setItems(JSON.parse(guardado))
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

  function agregar(p: Producto) {
    setItems((prev) => {
      const existe = prev.find((i) => i.id === p.id)
      if (existe) return prev.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...prev, { ...p, cantidad: 1 }]
    })
  }

  function cambiarCantidad(id: number | string, delta: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
    )
  }

  function quitar(id: number | string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function vaciar() {
    setItems([])
  }

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  return (
    <CarritoContext.Provider value={{ items, agregar, cambiarCantidad, quitar, vaciar, total }}>
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
