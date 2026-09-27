import { getDb } from '@/lib/firebaseAdmin'

// Cuando cambia el email de una cuenta (lo cambia el admin o la persona
// desde "Mi cuenta") o el nombre de la tienda, lo copiamos a donde lo
// tenemos duplicado para mostrarlo: su perfil de vendedor, sus productos
// (campo `vendedor`, que el catálogo muestra si no hay nombre de tienda)
// y sus anuncios (`autorEmail`).
export async function sincronizarDatosCuenta(uid: string, cambios: { email?: string | null; tiendaNombre?: string }) {
  const db = getDb()
  const actualizarProductos: Record<string, any> = {}
  if (cambios.email) actualizarProductos.vendedor = cambios.email
  if (cambios.tiendaNombre !== undefined) actualizarProductos.tiendaNombre = cambios.tiendaNombre

  const [productos, anuncios] = await Promise.all([
    Object.keys(actualizarProductos).length ? db.collection('productos').where('vendedorId', '==', uid).get() : null,
    cambios.email ? db.collection('anuncios').where('autorUid', '==', uid).get().catch(() => null) : null,
  ])
  const refs: { ref: FirebaseFirestore.DocumentReference; datos: Record<string, any> }[] = []
  productos?.docs.forEach((d) => refs.push({ ref: d.ref, datos: actualizarProductos }))
  anuncios?.docs.forEach((d) => refs.push({ ref: d.ref, datos: { autorEmail: cambios.email } }))
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch()
    refs.slice(i, i + 450).forEach((r) => batch.update(r.ref, r.datos))
    await batch.commit()
  }

  if (cambios.email) {
    const v = db.collection('vendedores').doc(uid)
    if ((await v.get()).exists) await v.set({ email: cambios.email }, { merge: true })
    await db.collection('usuarios').doc(uid).set({ email: cambios.email }, { merge: true })
  }
}
