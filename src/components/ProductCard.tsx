'use client'

import { useState } from 'react'
import { Producto } from '@/data/productos'
import { ProductIcon } from './ProductIcon'
import { useCarrito } from '@/lib/store'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export function ProductCard({ p }: { p: Producto }) {
  const { agregar } = useCarrito()
  const [imagenRota, setImagenRota] = useState(false)
  const mostrarFoto = p.imagenUrl && !imagenRota

  return (
    <div className="bg-panel border border-line rounded-[10px] overflow-hidden flex flex-col">
      <div className="bg-panelalt flex justify-center items-center text-maroon overflow-hidden h-36">
        {mostrarFoto ? (
          <img
            src={p.imagenUrl}
            alt={p.nombre}
            className="w-full h-full object-cover"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <ProductIcon kind={p.icono} />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11px] text-inksoft font-body mb-1">{p.vendedor}</div>
        <div className="font-display text-[15px] font-semibold text-ink mb-2.5 flex-1">{p.nombre}</div>
        <div className="flex items-center justify-between">
          <span className="font-display text-[17px] font-bold text-ink">{bs(p.precio)}</span>
          <button
            onClick={() => agregar(p)}
            className="px-3.5 py-1.5 rounded-md bg-maroon text-white font-body text-xs font-semibold"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
