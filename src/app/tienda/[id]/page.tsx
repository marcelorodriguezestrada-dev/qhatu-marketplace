'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Producto } from '@/data/productos'
import { ProductCard } from '@/components/ProductCard'

interface PerfilTienda {
  existe: boolean
  nombreNegocio: string
  direccion: string
  zona: string
  horarios: string
  tipoVentas: string
  tiendaAprobada: boolean
  verificado: boolean
  rating: number | null
  logoUrl: string
  followers: number
}

export default function TiendaPage() {
  const params = useParams()
  const vendedorId = params.id as string

  const [perfil, setPerfil] = useState<PerfilTienda | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!vendedorId) return

    Promise.all([
      fetch(`/api/vendedores/${vendedorId}`).then((r) => r.json()),
      fetch('/api/productos').then((r) => r.json()),
    ])
      .then(([datosVendedor, datosProductos]) => {
        setPerfil(datosVendedor)
        const todos: Producto[] = datosProductos.productos || []
        setProductos(todos.filter((p) => p.vendedorId === vendedorId))
      })
      .finally(() => setCargando(false))
  }, [vendedorId])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-inksoft font-body text-sm">
        Cargando tienda...
      </div>
    )
  }

  if (!perfil || !perfil.existe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <div className="font-body text-sm text-inksoft">No encontramos esta tienda.</div>
        <Link href="/" className="font-body text-sm text-maroon underline">
          Volver al catálogo
        </Link>
      </div>
    )
  }

  const nombre = perfil.nombreNegocio || 'Tienda'

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-4 sm:px-5 py-3">
        <div className="max-w-[960px] mx-auto">
          <Link href="/" className="font-display text-xl font-bold text-white">
            Clasi Click
          </Link>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 sm:px-5 py-6 pb-12">
        {/* Perfil de la tienda — acá vive toda la info que antes se repetía en cada producto */}
        <div className="bg-panel border border-line rounded-xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-panelalt flex items-center justify-center overflow-hidden text-maroon text-2xl font-display font-bold shrink-0">
              {perfil.logoUrl ? (
                <img src={perfil.logoUrl} alt={nombre} className="w-full h-full object-cover" />
              ) : (
                nombre[0]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-xl font-bold text-ink">{nombre}</h1>
                {perfil.verificado && (
                  <span className="bg-teal text-white text-[10px] font-bold px-2 py-0.5 rounded font-body">
                    Verificado
                  </span>
                )}
                {perfil.tiendaAprobada && (
                  <span className="bg-ochre text-white text-[10px] font-bold px-2 py-0.5 rounded font-body">
                    TIENDA APROBADA
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap font-body text-xs text-inksoft">
                {perfil.rating && <span>{perfil.rating} ★</span>}
                {perfil.followers > 0 && <span>{perfil.followers} seguidores</span>}
              </div>
            </div>
            <button className="font-body text-xs text-maroon underline shrink-0">Seguir local</button>
          </div>

          {(perfil.direccion || perfil.zona || perfil.horarios || perfil.tipoVentas) && (
            <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-2">
              {perfil.direccion && (
                <div className="font-body text-sm text-inksoft">📍 {perfil.direccion}</div>
              )}
              {perfil.zona && <div className="font-body text-sm text-inksoft">🗺️ {perfil.zona}</div>}
              {perfil.horarios && (
                <div className="font-body text-sm text-inksoft">🕐 {perfil.horarios}</div>
              )}
              {perfil.tipoVentas && (
                <div className="font-body text-sm text-inksoft">🛍️ {perfil.tipoVentas}</div>
              )}
            </div>
          )}
        </div>

        <div className="font-display text-base font-bold text-ink mb-3">
          Productos ({productos.length})
        </div>

        {productos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {productos.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="text-center py-14 text-inksoft font-body text-sm">
            Esta tienda todavía no tiene productos publicados.
          </div>
        )}
      </div>
    </div>
  )
}
