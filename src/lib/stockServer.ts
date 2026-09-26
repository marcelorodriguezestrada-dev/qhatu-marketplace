import type { Transaction, DocumentReference } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'

// Cuántas unidades de cada producto pide una lista de ítems del carrito
// (sumando las líneas del mismo producto con distinta talla/color).
export function unidadesPorProducto(items: any[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of Array.isArray(items) ? items : []) {
    const id = it?.id != null ? String(it.id) : ''
    const cant = Math.max(0, Math.floor(Number(it?.cantidad) || 0))
    if (id && cant > 0) out[id] = (out[id] || 0) + cant
  }
  return out
}

// Dentro de una transacción: verifica que haya stock de todo y lo
// descuenta. Devuelve lo descontado (solo productos con stock cargado),
// o un error con el nombre del producto sin stock suficiente.
export async function descontarStock(
  tx: Transaction,
  unidades: Record<string, number>
): Promise<{ ok: true; descontado: Record<string, number> } | { ok: false; error: string }> {
  const db = getDb()
  const ids = Object.keys(unidades)
  if (ids.length === 0) return { ok: true, descontado: {} }
  const docs = await tx.getAll(...ids.map((id) => db.collection('productos').doc(id)))
  const descontado: Record<string, number> = {}
  for (const doc of docs) {
    if (!doc.exists) continue
    const p = doc.data()!
    if (typeof p.stock !== 'number') continue // sin control de stock
    const pedido = unidades[doc.id]
    if (p.stock < pedido) {
      return {
        ok: false,
        error: p.stock <= 0
          ? `"${p.nombre}" se agotó. Sacalo del carrito para continuar.`
          : `De "${p.nombre}" quedan solo ${p.stock} unidad${p.stock === 1 ? '' : 'es'}. Bajá la cantidad en el carrito para continuar.`,
      }
    }
    descontado[doc.id] = pedido
  }
  for (const [id, cant] of Object.entries(descontado)) {
    tx.update(db.collection('productos').doc(id), { stock: FieldValue.increment(-cant) })
  }
  return { ok: true, descontado }
}

// Devuelve al stock lo que se había descontado para un pedido (al
// cancelarlo o anularlo). Solo una vez por pedido (stockRepuesto).
export async function reponerStockDePedido(ref: DocumentReference): Promise<void> {
  const db = getDb()
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    const pedido = doc.data()
    const descontado = pedido?.stockDescontado as Record<string, number> | undefined
    if (!doc.exists || !descontado || pedido?.stockRepuesto) return
    for (const [id, cant] of Object.entries(descontado)) {
      if (cant > 0) tx.update(db.collection('productos').doc(id), { stock: FieldValue.increment(cant) })
    }
    tx.update(ref, { stockRepuesto: true })
  }).catch((err) => console.error('reponerStockDePedido', err))
}
