'use client'

import { useRouter } from 'next/navigation'
import { useCarrito, ItemCarrito } from '@/lib/store'
import { ProductIcon } from './ProductIcon'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

type Tienda = {
  clave: string
  vendedorId: string | null
  nombre: string
  items: ItemCarrito[]
  subtotal: number
}

// Cada tienda del carrito se paga por separado — no hay un botón único
// de "Comprar" para todo junto. Si tenés productos de 2 vendedores,
// son 2 compras independientes, cada una con su propia entrega y su
// propio pago; pagarle a uno no obliga a pagarle al otro en el mismo
// momento.
function agruparPorTienda(items: ItemCarrito[]): Tienda[] {
  const mapa = new Map<string, Tienda>()
  for (const it of items) {
    const vendedorId = it.vendedorId || null
    const clave = vendedorId || 'plataforma'
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, vendedorId, nombre: it.tiendaNombre || it.vendedor || 'Clasi Click', items: [], subtotal: 0 })
    }
    const tienda = mapa.get(clave)!
    tienda.items.push(it)
    tienda.subtotal += it.precio * it.cantidad
  }
  return [...mapa.values()]
}

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, cambiarCantidad, quitar, total } = useCarrito()
  const router = useRouter()
  const tiendas = agruparPorTienda(items)

  function irAPagar(tienda: Tienda) {
    onClose()
    router.push(`/checkout?tienda=${encodeURIComponent(tienda.clave)}`)
  }

  return (
    <div className="fixed inset-0 bg-ink/35 flex justify-end z-20" onClick={onClose}>
      <div className="w-80 max-w-[88%] bg-panel h-full p-5 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <span className="font-display text-lg font-bold text-ink">Tu carrito</span>
          <button onClick={onClose} className="border-none bg-transparent text-xl text-inksoft">×</button>
        </div>

        {items.length === 0 && (
          <div className="text-inksoft font-body text-sm">Todavía no agregaste productos.</div>
        )}

        {tiendas.length > 1 && (
          <div className="font-body text-[11px] text-inksoft bg-panelalt border border-line rounded-lg p-2.5 mb-3">
            Tenés productos de {tiendas.length} tiendas distintas — cada una se paga por separado, con su propia entrega.
          </div>
        )}

        {/* min-h-0 es lo que hace que este bloque realmente scrollee en
            vez de empujar el contenido de abajo fuera de la pantalla —
            sin esto, en celulares (donde hay menos alto disponible) el
            carrito quedaba "cortado" apenas había un par de productos. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {tiendas.map((tienda) => (
            <div key={tienda.clave} className="mb-4 pb-4 border-b border-line last:border-b-0">
              <div className="font-body text-[12px] font-bold text-ink mb-2 truncate">{tienda.nombre}</div>

              {tienda.items.map((it) => (
                <div key={it.id} className="flex gap-2.5 py-2">
                  <div className="w-11 h-11 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden">
                    {it.thumbUrl || it.imagenUrl ? (
                      <img src={it.thumbUrl || it.imagenUrl} alt={it.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <ProductIcon kind={it.icono} size={22} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-body text-[13px] font-medium text-ink">{it.nombre}</div>
                    <div className="font-body text-xs text-inksoft mb-1.5">{bs(it.precio)}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => cambiarCantidad(it.id, -1)} className="w-5.5 h-5.5 border border-line rounded text-sm">−</button>
                      <span className="font-body text-[13px]">{it.cantidad}</span>
                      <button onClick={() => cambiarCantidad(it.id, 1)} className="w-5.5 h-5.5 border border-line rounded text-sm">+</button>
                      <button onClick={() => quitar(it.id)} className="ml-auto text-[11px] text-maroon underline">quitar</button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-between items-center mt-2.5">
                <div className="font-body text-[13px] text-inksoft">
                  Subtotal: <span className="font-bold text-ink">{bs(tienda.subtotal)}</span>
                </div>
                <button
                  onClick={() => irAPagar(tienda)}
                  className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold"
                >
                  Comprar en esta tienda
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line pt-3 mt-1 flex justify-between font-body text-xs text-inksoft">
            <span>Total de todo el carrito</span>
            <span className="font-bold text-ink">{bs(total)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
