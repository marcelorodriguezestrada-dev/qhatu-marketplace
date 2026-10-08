import { getAuthAdmin } from '@/lib/firebaseAdmin'

// Cuentas de prueba: pueden comprar a cualquier hora (sin el horario de
// atención 8–20 ni el corte de las 17:00 / domingos del envío express),
// para probar el circuito completo. Se marcan y desmarcan desde
// Admin → Usuarios ("Hacer de prueba" / "Quitar prueba"), que guarda la
// marca en la propia cuenta de Firebase Auth (custom claim `esPrueba`):
// no gasta lecturas de Firestore. Sus pedidos quedan marcados como
// "prueba" en el admin.
//
// Solo servidor. En el navegador, la marca llega por useAuth().esPrueba.
export async function esCuentaPruebaServidor(usuario: { uid: string } | null | undefined): Promise<boolean> {
  if (!usuario?.uid) return false
  try {
    const u = await getAuthAdmin().getUser(usuario.uid)
    return u.customClaims?.esPrueba === true
  } catch {
    return false
  }
}

// Casa de prueba de una cuenta de prueba: la usa el checkout para probar
// el envío en su ciudad (se guarda en usuarios/{uid}.ubicacionPrueba).
export type UbicacionPruebaGuardada = { lat: number; lng: number; direccion: string; zona: string; ciudad: string; exacta: true }

export function sanearUbicacionPrueba(v: any, ciudad: string): UbicacionPruebaGuardada | null {
  const lat = Number(v?.lat)
  const lng = Number(v?.lng)
  const direccion = String(v?.direccion || '').trim().slice(0, 120)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !direccion) return null
  return { lat, lng, direccion, zona: String(v?.zona || '').trim().slice(0, 60), ciudad, exacta: true }
}
