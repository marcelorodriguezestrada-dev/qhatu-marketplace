'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Producto } from '@/data/productos'
import { PRODUCTOS_SEED } from '@/data/productos'
import { ProductCard } from '@/components/ProductCard'
import { CartDrawer } from '@/components/CartDrawer'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'

const CATEGORIAS = ['Todo', 'Calzado', 'Ropa', 'Accesorios', 'Hogar']

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_SEED)
  const [categoria, setCategoria] = useState('Todo')
  const [busqueda, setBusqueda] = useState('')
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const { items } = useCarrito()
  const { usuario, logout } = useAuth()

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        if (data.productos) setProductos(data.productos)
      })
      .catch(() => {
        // Si falla la carga (por ejemplo, Firebase no configurado todavía
        // en desarrollo), nos quedamos con el catálogo semilla local.
      })
  }, [])

  const filtrados = productos.filter((p) => {
    const matchCat = categoria === 'Todo' || p.categoria === categoria
    const matchBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.vendedor.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchBusqueda
  })

  // Solo entran acá los descuentos reales (precioOriginal cargado por
  // el propio vendedor y mayor al precio actual) — nada de porcentajes
  // inventados para la sección de ofertas.
  const ofertas = productos.filter((p) => p.precioOriginal && p.precioOriginal > p.precio).slice(0, 8)

  const cantidadCarrito = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-4 sm:px-5 py-3">
        <div className="max-w-[960px] mx-auto">
          <div className="flex items-center gap-3 mb-2.5">
            <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos o vendedores"
              className="flex-1 px-3.5 py-2 rounded-lg border-none bg-white/10 text-white font-body text-sm outline-none placeholder:text-white/50 min-w-0"
            />
            <button
              onClick={() => setCarritoAbierto(true)}
              className="border-none bg-white/10 text-white px-3 sm:px-4 py-2 rounded-lg font-body text-sm shrink-0 whitespace-nowrap"
            >
              🛒 {cantidadCarrito > 0 && `(${cantidadCarrito})`}
            </button>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
            <Link href="/servicios" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
              Servicios
            </Link>
            <Link href="/vender" className="border-none bg-white/10 text-white px-3 py-1.5 rounded-lg font-body text-[13px] shrink-0 whitespace-nowrap">
              Vender
            </Link>
            {usuario ? (
              <>
                <Link href="/mis-pedidos" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
                  Mis pedidos
                </Link>
                <button onClick={() => logout()} className="border-none bg-transparent text-white/60 font-body text-[12px] shrink-0 whitespace-nowrap">
                  {usuario.email?.split('@')[0]} · salir
                </button>
              </>
            ) : (
              <Link href="/login" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-12">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-panel border-2 border-maroon rounded-xl p-4 sm:p-5 text-center">
            <div className="text-2xl mb-1">🛍️</div>
            <div className="font-display text-sm sm:text-base font-bold text-ink">Productos</div>
            <div className="font-body text-[11px] sm:text-xs text-inksoft">Comprá acá abajo</div>
          </div>
          <Link
            href="/servicios"
            className="bg-teal border-2 border-teal rounded-xl p-4 sm:p-5 text-center"
          >
            <div className="text-2xl mb-1">🧑‍🔧</div>
            <div className="font-display text-sm sm:text-base font-bold text-white">Servicios</div>
            <div className="font-body text-[11px] sm:text-xs text-white/80">Profesionales cerca tuyo</div>
          </Link>
        </div>

        {ofertas.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🔥</span>
              <div className="font-display text-base font-bold text-ink">Ofertas</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
              {ofertas.map((p) => (
                <div key={p.id} className="w-40 sm:w-44 shrink-0">
                  <ProductCard p={p} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-5 flex-wrap">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium ${
                categoria === c ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtrados.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="text-center py-14 text-inksoft font-body text-sm">
            No encontramos productos para esa búsqueda.
          </div>
        )}
      </div>

      {carritoAbierto && <CartDrawer onClose={() => setCarritoAbierto(false)} />}
    </div>
  )
}
