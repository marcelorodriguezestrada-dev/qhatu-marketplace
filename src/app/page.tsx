'use client'

import { useEffect, useState } from 'react'
import { Producto } from '@/data/productos'
import { PRODUCTOS_SEED } from '@/data/productos'
import { ProductCard } from '@/components/ProductCard'
import { CartDrawer } from '@/components/CartDrawer'
import { useCarrito } from '@/lib/store'

const CATEGORIAS = ['Todo', 'Calzado', 'Ropa', 'Accesorios', 'Hogar']

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_SEED)
  const [categoria, setCategoria] = useState('Todo')
  const [busqueda, setBusqueda] = useState('')
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const { items } = useCarrito()

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

  const cantidadCarrito = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-5 py-3.5">
        <div className="max-w-[960px] mx-auto flex items-center gap-4">
          <span className="font-display text-xl font-bold text-white">Qhatu</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos o vendedores"
            className="flex-1 px-3.5 py-2 rounded-lg border-none bg-white/10 text-white font-body text-sm outline-none placeholder:text-white/50"
          />
          <button
            onClick={() => setCarritoAbierto(true)}
            className="border-none bg-white/10 text-white px-4 py-2 rounded-lg font-body text-sm"
          >
            Carrito {cantidadCarrito > 0 && `(${cantidadCarrito})`}
          </button>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-5 py-6 pb-12">
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

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
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
