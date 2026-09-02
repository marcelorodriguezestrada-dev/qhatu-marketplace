'use client'

import { Producto } from '@/data/productos'
import { ProductIcon } from './ProductIcon'
import { useCarrito } from '@/lib/store'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export function ProductCard({ p }: { p: Producto }) {
  const { agregar } = useCarrito()
  return (
    <div className="bg-panel border border-line rounded-[10px] overflow-hidden flex flex-col">
      <div className="bg-panelalt py-7 flex justify-center text-maroon">
        <ProductIcon kind={p.icono} />
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
