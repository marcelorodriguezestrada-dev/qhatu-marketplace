'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Producto } from '@/data/productos'
import { ProductIcon } from './ProductIcon'
import { useCarrito } from '@/lib/store'
import { useFavoritos } from '@/lib/favoritos'
import { useAuth } from '@/lib/auth'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function esNuevo(createdAt?: string) {
  if (!createdAt) return false
  const dias = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return dias <= 7
}

function CorazonIcon({ relleno }: { relleno: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={relleno ? '#A23B2E' : 'none'} stroke={relleno ? '#A23B2E' : '#1E2233'} strokeWidth="1.8">
      <path d="M12 20s-7-4.35-9.5-8.5C.8 8.2 2.3 5 5.5 5c2 0 3.3 1 4.5 2.5C11.2 6 12.5 5 14.5 5 17.7 5 19.2 8.2 21.5 11.5 19 15.65 12 20 12 20z" strokeLinejoin="round" />
    </svg>
  )
}

export function ProductCard({ p }: { p: Producto }) {
  const { agregar } = useCarrito()
  const { esFavorito, toggleFavorito } = useFavoritos()
  const { usuario } = useAuth()
  const router = useRouter()
  const [imagenRota, setImagenRota] = useState(false)
  const mostrarFoto = p.imagenUrl && !imagenRota
  const favorito = esFavorito(p.id)

  // Navegar y ver productos es libre, sin login — pero agregar al
  // carrito sí lo requiere (evita fraudes y asocia el carrito a una
  // cuenta real, como se definió para toda la plataforma).
  function agregarAlCarrito() {
    if (!usuario) {
      router.push('/login')
      return
    }
    agregar(p)
  }

  const tieneDescuento = p.precioOriginal && p.precioOriginal > p.precio
  const porcentajeOff = tieneDescuento
    ? Math.round((1 - p.precio / (p.precioOriginal as number)) * 100)
    : 0

  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-md">
      <Link href={`/producto/${p.id}`} className="bg-panelalt flex justify-center items-center text-maroon overflow-hidden h-36 sm:h-48 relative">
        {mostrarFoto ? (
          <img
            src={p.imagenUrl}
            alt={p.nombre}
            className="w-full h-full object-cover"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <ProductIcon kind={p.icono} size={40} />
        )}
        {p.plan === 'premium' && (
          <span className="absolute top-2 left-2 bg-ochre text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-body">
            Premium
          </span>
        )}
        {tieneDescuento && (
          <span className="absolute top-2 left-2 bg-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-body">
            {porcentajeOff}% OFF
          </span>
        )}
        {!tieneDescuento && esNuevo(p.createdAt) && (
          <span className="absolute top-2 left-2 bg-ochre text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-body">
            Nuevo
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            toggleFavorito(p.id)
          }}
          aria-label={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
        >
          <CorazonIcon relleno={favorito} />
        </button>
      </Link>
      <div className="p-2.5 sm:p-4 flex flex-col flex-1">
        <div className="text-[10px] sm:text-[11px] text-inksoft font-body mb-0.5 sm:mb-1 truncate">{p.vendedor}</div>
        <Link href={`/producto/${p.id}`} className="font-body text-[13px] sm:text-[14px] font-medium text-ink mb-1.5 sm:mb-2 flex-1 leading-snug hover:underline">
          {p.nombre}
        </Link>

        {tieneDescuento && (
          <div className="font-body text-[11px] sm:text-[12px] text-inksoft line-through mb-0.5">
            {bs(p.precioOriginal as number)}
          </div>
        )}
        <div className="flex items-baseline gap-1.5 mb-2 sm:mb-3 flex-wrap">
          <span className="font-display text-[16px] sm:text-[19px] font-bold text-ink">{bs(p.precio)}</span>
          {tieneDescuento && (
            <span className="font-body text-[11px] sm:text-[12px] font-semibold text-teal">{porcentajeOff}% OFF</span>
          )}
        </div>

        <button
          onClick={agregarAlCarrito}
          className="w-full py-1.5 sm:py-2 rounded-md bg-maroon text-white font-body text-[11px] sm:text-xs font-semibold"
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  )
}
