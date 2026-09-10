import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { diaBolivia } from '@/lib/fechaBolivia'

// Suma +incremento a un contador del día de hoy (hora boliviana), en
// la colección `metricas_diarias` (un documento por día, id = YYYY-MM-DD,
// un campo por tipo de evento). Es la fuente de la línea de tiempo que
// se ve en /admin → Métricas: "visitas", "vistas de productos /
// profesionales", "clics a WhatsApp" y "búsquedas por categoría" día a
// día — cosas que antes solo se guardaban como un total acumulado de
// toda la vida (ej: profesional.vistas), sin forma de saber qué día
// tuvieron más o menos movimiento.
//
// A propósito no guarda quién generó el evento, ni ninguna otra info:
// es un contador, nada más.
export async function sumarMetricaDiaria(campo: string, incremento = 1) {
  try {
    await getDb().collection('metricas_diarias').doc(diaBolivia()).set(
      { [campo]: FieldValue.increment(incremento) },
      { merge: true }
    )
  } catch {
    // Es solo una métrica — nunca debe romper la experiencia real del sitio.
  }
}
