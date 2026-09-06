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

      <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="bg-panelalt rounded-xl overflow-hidden flex items-center justify-center h-[380px] relative">
          {mostrarFoto ? (
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="w-full h-full object-cover"
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

          {tieneDescuento && (
            <div className="font-body text-sm text-inksoft line-through mb-1">{bs(producto.precioOriginal)}</div>
          )}
          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-display text-3xl font-bold text-ink">{bs(producto.precio)}</span>
            {tieneDescuento && (
              <span className="font-body text-sm font-semibold text-teal">{porcentajeOff}% OFF</span>
            )}
          </div>

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
                    <img src={r.imagenUrl} alt={r.nombre} className="w-full h-full object-cover" />
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
