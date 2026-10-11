import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { diaBolivia } from '@/lib/fechaBolivia'
import type { TipoItemEstadistica, CampoEstadistica } from '@/lib/estadisticas'

// Estadísticas de cada usuario (las que ve en /mis-estadisticas): un
// documento por día en estadisticasUsuarios/{uid}/dias/{YYYY-MM-DD},
// con un contador por producto / servicio / anuncio:
//   { items: { p_<productoId>: { vistas, contactos, carrito }, s_<id>: {...}, a_<id>: {...} } }
// Igual que metricas_diarias: es un contador, no guarda quién lo generó.
export async function sumarEstadisticaUsuario(
  uid: string | null | undefined,
  tipo: TipoItemEstadistica,
  itemId: string | null | undefined,
  campo: CampoEstadistica
) {
  if (!uid) return
  const clave = `${tipo}_${String(itemId || 'general').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'general'}`
  try {
    await getDb()
      .collection('estadisticasUsuarios').doc(uid)
      .collection('dias').doc(diaBolivia())
      .set({ items: { [clave]: { [campo]: FieldValue.increment(1) } } }, { merge: true })
  } catch {
    // Es solo una métrica — nunca debe romper la experiencia real del sitio.
  }
}

// Todos los días guardados de un usuario (id = fecha) con sus contadores.
export async function leerDiasUsuario(uid: string, desde: string) {
  const snap = await getDb().collection('estadisticasUsuarios').doc(uid).collection('dias').get()
  return snap.docs
    .filter((d) => d.id >= desde)
    .map((d) => ({ fecha: d.id, items: ((d.data() as any)?.items || {}) as Record<string, Partial<Record<CampoEstadistica, number>>> }))
}
