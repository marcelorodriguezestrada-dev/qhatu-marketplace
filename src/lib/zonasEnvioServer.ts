// Zonas de envío del lado del servidor: las agregadas por el admin
// (config/zonasEnvio.extras) y las sugeridas por los compradores
// (colección zonasSugeridas). Ver src/lib/zonasEnvio.ts.
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { armarZonas, buscarZonaEn, normZona, type ZonaExtra } from '@/lib/zonasEnvio'

export async function leerZonasExtra(): Promise<ZonaExtra[]> {
  const d = await getDb().collection('config').doc('zonasEnvio').get()
  const extras = d.data()?.extras
  return Array.isArray(extras) ? extras : []
}

// Un pedido con envío a una zona escrita a mano (no está en la lista):
// se suma a las sugeridas con su punto, para que el admin la agregue.
export async function registrarZonaSugerida(zona: string, lat: number, lng: number) {
  const nombre = String(zona || '').trim().slice(0, 60)
  const id = normZona(nombre).replace(/ /g, '-').slice(0, 60)
  if (!id || typeof lat !== 'number' || typeof lng !== 'number') return
  if (buscarZonaEn(armarZonas(await leerZonasExtra()), nombre)) return
  await getDb().collection('zonasSugeridas').doc(id).set(
    { nombre, pedidos: FieldValue.increment(1), sumaLat: FieldValue.increment(lat), sumaLng: FieldValue.increment(lng), ultimoPedido: new Date().toISOString() },
    { merge: true }
  )
}
