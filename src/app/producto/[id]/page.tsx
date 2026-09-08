'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProductIcon } from '@/components/ProductIcon'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function esNuevo(createdAt?: string) {
  if (!createdAt) return false
  const dias = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return dias <= 7
}

export default function ProductoDetallePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { agregar } = useCarrito()
  const { usuario } = useAuth()

  const [producto, setProducto] = useState<any>(null)
  const [relacionados, setRelacionados] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [cantidad, setCantidad] = useState(1)
  const [imagenRota, setImagenRota] = useState(false)
  const [agregado, setAgregado] = useState(false)

  useEffect(() => {
    if (!id) return
    setCargando(true)
    setAgregado(false)
    setCantidad(1)
    setImagenRota(false)

    Promise.all([
      fetch(`/api/productos/${id}`).then((r) => r.json()),
      fetch('/api/productos').then((r) => r.json()),
    ]).then(([detalle, catalogo]) => {
      setProducto(detalle)
      if (!detalle.error) {
        const otros = (catalogo.productos || []).filter(
          (p: any) => p.categoria === detalle.categoria && p.id !== detalle.id
        )
        setRelacionados(otros.slice(0, 4))
        // Sumamos +1 a las vistas de este producto — no bloqueamos la
        // carga de la página por esto, ni mostramos error si falla.
        fetch(`/api/productos/${id}/vista`, { method: 'POST' }).catch(() => {})
      }
      setCargando(false)
    })
  }, [id])

  function agregarAlCarrito() {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!producto) return
    for (let i = 0; i < cantidad; i++) agregar(producto)
    setAgregado(true)
  }

  function comprarAhora() {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!producto) return
    for (let i = 0; i < cantidad; i++) agregar(producto)
    router.push('/checkout')
  }

  if (cargando) {
    return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }
  if (!producto || producto.error) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="font-body text-sm text-inksoft mb-4">No encontramos este producto.</div>
        <Link href="/" className="font-body text-sm text-maroon underline">Volver al catálogo</Link>
      </div>
    )
  }

  const mostrarFoto = producto.imagenUrl && !imagenRota
  const tieneDescuento = producto.precioOriginal && producto.precioOriginal > producto.precio
  const porcentajeOff = tieneDescuento
    ? Math.round((1 - producto.precio / producto.precioOriginal) * 100)
    : 0

  return (
    <div className="max-w-[960px] mx-auto px-5 py-8">
      <Link href="/" className="font-body text-[13px] text-inksoft mb-5 inline-block">← Volver al catálogo</Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-panelalt rounded-xl overflow-hidden flex items-center justify-center h-[48vh] md:h-[380px] relative">
          {mostrarFoto ? (
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="max-w-full max-h-full object-contain"
              onError={() => setImagenRota(true)}
            />
          ) : (
            <ProductIcon kind={producto.icono} size={72} />
          )}
          {tieneDescuento && (
            <span className="absolute top-3 left-3 bg-teal text-white text-xs font-bold px-2.5 py-1 rounded font-body">
              {porcentajeOff}% OFF
            </span>
          )}
          {!tieneDescuento && esNuevo(producto.createdAt) && (
            <span className="absolute top-3 left-3 bg-ochre text-white text-xs font-bold px-2.5 py-1 rounded font-body">
              Nuevo
            </span>
          )}
        </div>

        <div>
          <div className="font-body text-xs text-inksoft mb-1">{producto.categoria} · {producto.vendedor}</div>
          <h1 className="font-display text-2xl font-bold text-ink mb-4">{producto.nombre}</h1>

          <div className="flex items-center gap-2 mb-3">
            {producto.rating && (
              <span className="bg-panelalt px-2 py-1 rounded font-body text-sm font-semibold">{producto.rating} ★</span>
            )}
            {producto.tiendaAprobada && (
              <span className="bg-ochre text-white text-xs font-bold px-2.5 py-1 rounded font-body">TIENDA APROBADA</span>
            )}
          </div>

          {tieneDescuento && (
            <div className="font-body text-sm text-inksoft line-through mb-1">{bs(producto.precioOriginal)}</div>
          )}
          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-display text-3xl font-bold text-ink">{bs(producto.precio)}</span>
            {tieneDescuento && (
              <span className="font-body text-sm font-semibold text-teal">{porcentajeOff}% OFF</span>
            )}
          </div>

          {producto.descripcionLarga && (
            <div className="mb-6 font-body text-sm text-inksoft whitespace-pre-line">{producto.descripcionLarga}</div>
          )}

          {/* Tarjeta del vendedor / tienda */}
          <div className="mt-4 bg-panel border border-line rounded-lg p-3.5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden text-maroon">{producto.vendedor ? producto.vendedor[0] : 'V'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm font-medium text-ink truncate">{producto.vendedor || 'Vendedor'}</div>
                {producto.direccion && <div className="font-body text-xs text-inksoft">{producto.direccion}</div>}
                {producto.zona && <div className="font-body text-xs text-inksoft">{producto.zona}</div>}
              </div>
              <div className="shrink-0">
                <button className="font-body text-xs text-maroon underline">Seguir local</button>
              </div>
            </div>
            {producto.followers && <div className="font-body text-xs text-inksoft mt-2 font-semibold">{producto.followers} seguidores</div>}
          </div>

          {/* Información adicional: horarios / tipo de ventas */}
          {(producto.horarios || producto.tipoVentas) && (
            <div className="mb-6">
              {producto.horarios && <div className="font-body text-sm text-ink mb-1">Horarios</div>}
              {producto.horarios && <div className="font-body text-sm text-inksoft mb-2">{producto.horarios}</div>}
              {producto.tipoVentas && <div className="font-body text-sm text-ink mb-1">Tipo de ventas</div>}
              {producto.tipoVentas && <div className="font-body text-sm text-inksoft">{producto.tipoVentas}</div>}
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <span className="font-body text-sm text-inksoft">Cantidad</span>
            <div className="flex items-center gap-2 border border-line rounded-lg px-2 py-1">
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="w-7 h-7 border-none bg-transparent text-lg text-ink"
              >
                −
              </button>
              <span className="font-body text-sm w-6 text-center">{cantidad}</span>
              <button
                onClick={() => setCantidad((c) => c + 1)}
                className="w-7 h-7 border-none bg-transparent text-lg text-ink"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mb-4">
            <button
              onClick={comprarAhora}
              className="w-full py-3 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
            >
              Comprar ahora
            </button>
            <button
              onClick={agregarAlCarrito}
              className="w-full py-3 rounded-lg border border-line bg-panel text-ink font-body text-sm font-semibold"
            >
              {agregado ? 'Agregado ✓' : 'Agregar al carrito'}
            </button>
          </div>

          {agregado && (
            <div className="font-body text-xs text-teal">
              {cantidad > 1 ? `${cantidad} unidades agregadas.` : 'Producto agregado.'}{' '}
              <Link href="/checkout" className="underline">Ir a pagar</Link>
            </div>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <div className="mt-14">
          <div className="font-display text-lg font-bold text-ink mb-4">También te puede interesar</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {relacionados.map((r) => (
              <Link
                key={r.id}
                href={`/producto/${r.id}`}
                className="bg-panel border border-line rounded-lg overflow-hidden"
              >
                <div className="bg-panelalt h-32 flex items-center justify-center text-maroon overflow-hidden">
                  {r.imagenUrl ? (
                    <img src={r.thumbUrl || r.imagenUrl} alt={r.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <ProductIcon kind={r.icono} size={30} />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-body text-xs text-ink mb-1 leading-snug">{r.nombre}</div>
                  <div className="font-display text-sm font-bold text-ink">{bs(r.precio)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
