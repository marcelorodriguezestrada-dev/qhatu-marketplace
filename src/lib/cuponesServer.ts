import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { normalizarCodigo, type Cupon } from '@/lib/cupones'

export async function buscarCuponPorCodigo(codigo: unknown): Promise<Cupon | null> {
  const cod = normalizarCodigo(codigo)
  if (!cod) return null
  const snap = await getDb().collection('cupones').where('codigo', '==', cod).limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Cupon
}

export async function yaUsoCupon(cuponId: string, uid: string): Promise<boolean> {
  const snap = await getDb().collection('cupones').doc(cuponId).collection('usos').where('uid', '==', uid).limit(1).get()
  return !snap.empty
}

// Registra UNA compra con el cupón. Una compra con productos de varios
// vendedores se parte en varios pedidos, así que el uso se identifica
// por el checkoutId: el primer pedido lo cuenta y los demás de la misma
// compra no suman de nuevo. En transacción para que el límite de usos
// no se pase si dos personas compran a la vez.
export async function registrarUsoCupon(
  cupon: Cupon,
  datos: { checkoutId: string; uid: string; email: string | null; pedidoId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb()
  const cuponRef = db.collection('cupones').doc(cupon.id)
  const usoRef = cuponRef.collection('usos').doc(datos.checkoutId)
  return db.runTransaction(async (tx) => {
    const [cuponDoc, usoDoc] = await Promise.all([tx.get(cuponRef), tx.get(usoRef)])
    if (!cuponDoc.exists) return { ok: false as const, error: 'El cupón ya no existe.' }
    if (usoDoc.exists) {
      if (usoDoc.data()?.uid !== datos.uid) return { ok: false as const, error: 'Cupón inválido para esta compra.' }
      tx.update(usoRef, { pedidoIds: FieldValue.arrayUnion(datos.pedidoId) })
      return { ok: true as const }
    }
    const c = cuponDoc.data() as Cupon
    if (c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos) {
      return { ok: false as const, error: 'Este cupón ya alcanzó su límite de usos.' }
    }
    if (c.unaVezPorUsuario) {
      const previos = await tx.get(cuponRef.collection('usos').where('uid', '==', datos.uid).limit(1))
      if (!previos.empty) return { ok: false as const, error: 'Ya usaste este cupón en otra compra.' }
    }
    tx.set(usoRef, { uid: datos.uid, email: datos.email, pedidoIds: [datos.pedidoId], createdAt: new Date().toISOString() })
    tx.update(cuponRef, { usosCount: FieldValue.increment(1) })
    return { ok: true as const }
  })
}
