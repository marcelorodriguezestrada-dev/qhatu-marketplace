'use client'

import { useRouter } from 'next/navigation'
import { useCarrito } from '@/lib/store'
import { ProductIcon } from './ProductIcon'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, cambiarCantidad, quitar, total } = useCarrito()
  const router = useRouter()

  function irAPagar() {
    onClose()
    router.push('/checkout')
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

        {/* min-h-0 es lo que hace que este bloque realmente scrollee en
            vez de empujar el total y el botón de abajo fuera de la
            pantalla — sin esto, en celulares (donde hay menos alto
            disponible) el carrito quedaba "cortado" apenas había un par
            de productos, porque el flex item crecía más allá del alto
            del drawer en lugar de activar su propio scroll. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {items.map((it) => (
            <div key={it.id} className="flex gap-2.5 py-3 border-b border-line">
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
        </div>

        {/* pb con safe-area para que el botón no quede tapado por la
            barra de gestos/navegación de Android en celulares con
            "notch" o barra inferior. */}
        <div className="border-t border-line pt-3.5 mt-2.5 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-between mb-3.5 font-display">
            <span className="text-sm text-inksoft">Total</span>
            <span className="text-xl font-bold text-ink">{bs(total)}</span>
          </div>
          <button
            onClick={irAPagar}
            disabled={items.length === 0}
            className={`w-full py-3 rounded-lg font-body text-sm font-semibold text-white ${items.length === 0 ? 'bg-line cursor-default' : 'bg-teal'}`}
          >
            Comprar
          </button>
        </div>
      </div>
    </div>
  )
}
