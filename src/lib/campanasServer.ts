import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { diaBolivia } from '@/lib/fechaBolivia'
import { esCodigoCampana, type MetricaCampana } from '@/lib/campanas'

// Suma a los contadores de una campaña (total y por día). Nunca frena
// nada: si el código no existe o falla, se ignora.
export async function sumarCampana(codigo: unknown, cambios: Partial<Record<MetricaCampana, number>>) {
  if (!esCodigoCampana(codigo)) return
  try {
    const db = getDb()
    const ref = db.collection('campanas').doc(codigo)
    const doc = await ref.get()
    if (!doc.exists || doc.data()?.activa === false) return
    const inc: Record<string, any> = {}
    for (const [k, v] of Object.entries(cambios)) if (v) inc[k] = FieldValue.increment(v)
    if (!Object.keys(inc).length) return
    await Promise.all([
      ref.update(inc),
      ref.collection('dias').doc(diaBolivia()).set(inc, { merge: true }),
    ])
  } catch (err) {
    console.error('sumarCampana', err)
  }
}
