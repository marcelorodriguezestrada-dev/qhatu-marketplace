'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Producto } from '@/data/productos'
import { ProductIcon } from './ProductIcon'
import { useCarrito } from '@/lib/store'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function esNuevo(createdAt?: string) {
  if (!createdAt) return false
  const dias = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return dias <= 7
}

export function ProductCard({ p }: { p: Producto }) {
  const { agregar } = useCarrito()
  const [imagenRota, setImagenRota] = useState(false)
  const mostrarFoto = p.imagenUrl && !imagenRota

  const tieneDescuento = p.precioOriginal && p.precioOriginal > p.precio
  const porcentajeOff = tieneDescuento
    ? Math.round((1 - p.precio / (p.precioOriginal as number)) * 100)
    : 0

  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-md">
      <Link href={`/producto/${p.id}`} className="bg-panelalt flex justify-center items-center text-maroon overflow-hidden h-48 relative">
        {mostrarFoto ? (
          <img
            src={p.imagenUrl}
            alt={p.nombre}
            className="w-full h-full object-cover"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <ProductIcon kind={p.icono} size={44} />
        )}
        {p.plan === 'premium' && (
          <span className="absolute top-2.5 left-2.5 bg-ochre text-white text-[11px] font-bold px-2 py-0.5 rounded font-body">
            Premium
          </span>
        )}
        {tieneDescuento && (
          <span className="absolute top-2.5 left-2.5 bg-teal text-white text-[11px] font-bold px-2 py-0.5 rounded font-body">
            {porcentajeOff}% OFF
          </span>
        )}
        {!tieneDescuento && esNuevo(p.createdAt) && (
          <span className="absolute top-2.5 left-2.5 bg-ochre text-white text-[11px] font-bold px-2 py-0.5 rounded font-body">
            Nuevo
          </span>
        )}
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11px] text-inksoft font-body mb-1">{p.vendedor}</div>
        <Link href={`/producto/${p.id}`} className="font-body text-[14px] font-medium text-ink mb-2 flex-1 leading-snug hover:underline">
          {p.nombre}
        </Link>

        {tieneDescuento && (
          <div className="font-body text-[12px] text-inksoft line-through mb-0.5">
            {bs(p.precioOriginal as number)}
          </div>
        )}
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="font-display text-[19px] font-bold text-ink">{bs(p.precio)}</span>
          {tieneDescuento && (
            <span className="font-body text-[12px] font-semibold text-teal">{porcentajeOff}% OFF</span>
          )}
        </div>

        <button
          onClick={() => agregar(p)}
          className="w-full py-2 rounded-md bg-maroon text-white font-body text-xs font-semibold"
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  )
}
