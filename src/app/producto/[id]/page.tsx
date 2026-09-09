'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ProductIcon } from '@/components/ProductIcon'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'

const MapaProfesionales = dynamic(() => import('@/components/MapaProfesionales').then((m) => m.MapaProfesionales), {
  ssr: false,
  loading: () => <div className="w-full h-[260px] rounded-xl border border-line bg-panelalt flex items-center justify-center font-body text-sm text-inksoft">Cargando mapa...</div>,
})

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function esNuevo(createdAt?: string) {
  if (!createdAt) return false
  const dias = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return dias <= 7
}

function haceCuanto(createdAt?: string) {
  if (!createdAt) return ''
  const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

const TIPOS_VENTA_LABEL: Record<string, string> = {
  mayorista: 'Mayorista',
  minorista: 'Minorista',
  haceEnvios: 'Hace envíos',
  aceptaCambios: 'Acepta cambios',
  permiteProbar: 'Permite probar',
  pagoQr: 'Pago con QR',
  videollamada: 'Hace videollamada',
  pagoTarjeta: 'Pago con tarjeta',
}

export default function ProductoDetallePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { agregar } = useCarrito()
  const { usuario } = useAuth()

  const [producto, setProducto] = useState<any>(null)
  const [tienda, setTienda] = useState<any>(null)
  const [relacionados, setRelacionados] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [cantidad, setCantidad] = useState(1)
  const [imagenRota, setImagenRota] = useState(false)
  const [agregado, setAgregado] = useState(false)
  const [tab, setTab] = useState<'publicacion' | 'tienda'>('publicacion')

  useEffect(() => {
    if (!id) return
    setCargando(true)
    setAgregado(false)
    setCantidad(1)
    setImagenRota(false)
    setTab('publicacion')

    fetch(`/api/productos/${id}`)
      .then((r) => r.json())
      .then(async (detalle) => {
        setProducto(detalle)
        if (!detalle.error) {
          const catalogo = await fetch('/api/productos').then((r) => r.json())
          const otros = (catalogo.productos || []).filter(
            (p: any) => p.categoria === detalle.categoria && p.id !== detalle.id
          )
          setRelacionados(otros.slice(0, 4))
          fetch(`/api/productos/${id}/vista`, { method: 'POST' }).catch(() => {})

          if (detalle.vendedorId) {
            const t = await fetch(`/api/vendedores/${detalle.vendedorId}`).then((r) => r.json())
            setTienda(t)
          }
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
    const minimo = producto.compraMinima && producto.compraMinima > 1 ? producto.compraMinima : cantidad
    for (let i = 0; i < Math.max(cantidad, minimo); i++) agregar(producto)
    setAgregado(true)
  }

  function comprarAhora() {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!producto) return
    const minimo = producto.compraMinima && producto.compraMinima > 1 ? producto.compraMinima : cantidad
    for (let i = 0; i < Math.max(cantidad, minimo); i++) agregar(producto)
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
  const linkWhatsappVendedor = tienda?.qrImageUrl || tienda?.cbu ? null : null // el whatsapp de contacto directo del vendedor no se guarda hoy, se usa el chat/checkout

  return (
    <div className="max-w-[960px] mx-auto px-5 py-8">
      <Link href="/" className="font-body text-[13px] text-inksoft mb-5 inline-block">← Volver al catálogo</Link>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 border-b border-line">
        <button
          onClick={() => setTab('publicacion')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'publicacion' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Publicación
        </button>
        <button
          onClick={() => setTab('tienda')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'tienda' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Info. Tienda
        </button>
      </div>

      {tab === 'publicacion' && (
        <>
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
              <div className="font-body text-xs text-inksoft mb-1 flex items-center gap-1.5">
                {(tienda?.logoUrl || producto.tiendaLogoUrl) && (
                  <img
                    src={tienda?.logoUrl || producto.tiendaLogoUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                {producto.categoria} · {tienda?.nombreNegocio || producto.tiendaNombre || producto.vendedor}
                {tienda?.verificado && (
                  <span className="inline-flex items-center gap-1 text-teal font-semibold">
                    ✓ Verificado
                  </span>
                )}
              </div>
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

              {producto.descripcionLarga && (
                <div className="mb-6 font-body text-sm text-inksoft whitespace-pre-line">{producto.descripcionLarga}</div>
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

          {/* Detalle del producto */}
          <div className="mt-10 max-w-[600px]">
            <div className="font-display text-lg font-bold text-ink mb-3">Detalle del producto</div>
            <div className="divide-y divide-line border-t border-b border-line">
              {producto.talles?.length > 0 && (
                <div className="py-3 flex items-center gap-3">
                  <span className="text-lg">🏷️</span>
                  <span className="font-body text-sm text-ink"><strong>Talles:</strong> {producto.talles.join(', ')}</span>
                </div>
              )}
              {producto.colores?.length > 0 && (
                <div className="py-3 flex items-center gap-3">
                  <span className="text-lg">🎨</span>
                  <span className="font-body text-sm text-ink"><strong>Colores:</strong> {producto.colores.join(', ')}</span>
                </div>
              )}
              {producto.materiales && (
                <div className="py-3 flex items-center gap-3">
                  <span className="text-lg">✅</span>
                  <span className="font-body text-sm text-ink"><strong>Materiales:</strong> {producto.materiales}</span>
                </div>
              )}
              {producto.compraMinima > 1 && (
                <div className="py-3 flex items-center gap-3">
                  <span className="text-lg">📦</span>
                  <span className="font-body text-sm text-ink"><strong>Compra mínima:</strong> {producto.compraMinima}</span>
                </div>
              )}
              <div className="py-3 flex items-center gap-3">
                <span className="text-lg">📋</span>
                <span className="font-body text-sm text-ink"><strong>Rubro:</strong> {producto.categoria}</span>
              </div>
              <div className="py-3 flex items-center gap-3">
                <span className="text-lg">📅</span>
                <span className="font-body text-sm text-ink"><strong>Publicado:</strong> {haceCuanto(producto.createdAt)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'tienda' && (
        <div className="max-w-[600px]">
          {tienda?.lat != null && tienda?.lng != null && (
            <div className="mb-5">
              <MapaProfesionales
                profesionales={[{ id: producto.vendedorId, nombre: tienda?.nombreNegocio || producto.tiendaNombre || producto.vendedor, rubro: producto.categoria, lat: tienda.lat, lng: tienda.lng }]}
                centro={{ lat: tienda.lat, lng: tienda.lng }}
              />
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            {tienda?.logoUrl && (
              <img src={tienda.logoUrl} alt={producto.vendedor} className="w-14 h-14 rounded-full object-cover border border-line" />
            )}
            <div>
              <div className="font-display text-lg font-bold text-ink flex items-center gap-1.5">
                {tienda?.nombreNegocio || producto.tiendaNombre || producto.vendedor}
                {tienda?.verificado && <span className="text-teal text-sm">✓</span>}
              </div>
              {tienda?.direccion && <div className="font-body text-xs text-inksoft">{tienda.direccion}</div>}
            </div>
          </div>

          {tienda?.horarios && (
            <div className="mb-5">
              <div className="font-display text-base font-bold text-ink mb-1.5">Horarios</div>
              <div className="font-body text-sm text-inksoft">{tienda.horarios}</div>
            </div>
          )}

          {tienda?.tiposVenta && Object.values(tienda.tiposVenta).some(Boolean) && (
            <div className="mb-5">
              <div className="font-display text-base font-bold text-ink mb-2">Tipo de ventas</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(tienda.tiposVenta)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} className="bg-tealsoft text-teal font-body text-xs font-semibold px-2.5 py-1 rounded-full">
                      ✓ {TIPOS_VENTA_LABEL[k] || k}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {!tienda?.direccion && !tienda?.horarios && !tienda?.lat && (
            <div className="font-body text-sm text-inksoft">
              Este vendedor todavía no cargó información de su tienda.
            </div>
          )}
        </div>
      )}

      {relacionados.length > 0 && (
        <div className="mt-14">
          <div className="font-display text-lg font-bold text-ink mb-4">Más publicaciones del vendedor</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {relacionados.map((r) => (
              <Link
                key={r.id}
                href={`/producto/${r.id}`}
                className="bg-panel border border-line rounded-lg overflow-hidden"
              >
                <div className="bg-panelalt h-32 flex items-center justify-center text-maroon overflow-hidden">
                  {r.imagenUrl ? (
                    <img src={r.thumbUrl || r.imagenUrl} alt={r.nombre} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
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
