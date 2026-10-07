// Opciones del checkout que el admin prende o apaga (Admin → Envíos y
// checkout). Se guardan en config/checkout.
export type OpcionesCheckout = {
  gps: boolean // botón "📍 Estoy ahí: usar mi ubicación"
  mapa: boolean // botón "🗺️ Marcar mi casa en el mapa"
  express: boolean // opción "⚡ Envío express"
  retiro: boolean // opción "🏬 Retiro en tienda"
}
export const OPCIONES_CHECKOUT_DEFECTO: OpcionesCheckout = { gps: true, mapa: true, express: true, retiro: true }

export const ETIQUETAS_OPCIONES: { id: keyof OpcionesCheckout; label: string; ayuda: string }[] = [
  { id: 'gps', label: '📍 “Estoy ahí: usar mi ubicación”', ayuda: 'Toma la ubicación del celular para calcular el envío.' },
  { id: 'mapa', label: '🗺️ “Marcar mi casa en el mapa”', ayuda: 'El comprador marca su casa con un pin.' },
  { id: 'express', label: '⚡ Envío express', ayuda: 'Entrega el mismo día (pedidos antes de las 17:00).' },
  { id: 'retiro', label: '🏬 Retiro en tienda', ayuda: 'El comprador lo pasa a buscar sin costo de envío.' },
]

export function sanearOpciones(b: any): OpcionesCheckout {
  const o = { ...OPCIONES_CHECKOUT_DEFECTO }
  for (const k of Object.keys(o) as (keyof OpcionesCheckout)[]) if (typeof b?.[k] === 'boolean') o[k] = b[k]
  return o
}
