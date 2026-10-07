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
// se suma a las sugeridas con su punto. Cuando la escribieron en
// PEDIDOS_PARA_AGREGAR pedidos distintos y sus puntos quedan cerca entre
// sí (≤ RADIO_KM del promedio), se agrega sola a la lista (config/
// zonasEnvio.extras) — un nombre inventado una vez no entra, uno real
// que usa la gente sí. El admin igual la puede agregar o descartar antes
// en Admin → Zonas de envío.
const PEDIDOS_PARA_AGREGAR = 3
const RADIO_KM = 1.2

export async function registrarZonaSugerida(zona: string, lat: number, lng: number) {
  const nombre = String(zona || '').trim().slice(0, 60)
  const id = normZona(nombre).replace(/ /g, '-').slice(0, 60)
  if (!id || typeof lat !== 'number' || typeof lng !== 'number') return
  const extras = await leerZonasExtra()
  if (buscarZonaEn(armarZonas(extras), nombre)) return
  const db = getDb()
  const ref = db.collection('zonasSugeridas').doc(id)
  await ref.set(
    { nombre, pedidos: FieldValue.increment(1), sumaLat: FieldValue.increment(lat), sumaLng: FieldValue.increment(lng), puntos: FieldValue.arrayUnion({ lat, lng }), ultimoPedido: new Date().toISOString() },
    { merge: true }
  )
  const x = (await ref.get()).data() as any
  const n = Number(x?.pedidos) || 0
  const puntos: { lat: number; lng: number }[] = Array.isArray(x?.puntos) ? x.puntos : []
  if (n < PEDIDOS_PARA_AGREGAR || puntos.length < PEDIDOS_PARA_AGREGAR) return
  const cLat = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length
  const cLng = puntos.reduce((s, p) => s + p.lng, 0) / puntos.length
  const juntos = puntos.every((p) => distKm(p.lat, p.lng, cLat, cLng) <= RADIO_KM)
  if (!juntos) return
  const nueva: ZonaExtra = { nombre: x.nombre || nombre, lat: Math.round(cLat * 1e5) / 1e5, lng: Math.round(cLng * 1e5) / 1e5 } as ZonaExtra
  await db.collection('config').doc('zonasEnvio').set({ extras: [...extras, { ...nueva, agregadaSola: true, agregadaAt: new Date().toISOString() }] }, { merge: true })
  await ref.delete()
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
