import { getDb } from '@/lib/firebaseAdmin'
import { hoyBolivia, cuponVencido, type Cupon } from '@/lib/cupones'
import { CONFIG_DEFECTO, sanearConfigTracking, trackingActivoAhora, diaBoliviaISO, type ConfigTracking } from '@/lib/trackingConfig'

// Caché en memoria del servidor (dura lo que viva la función, ~minutos):
// así cada tanda de eventos no vuelve a leer la configuración ni los
// cupones de Firestore — menos lecturas del plan gratis.
let cacheConfig: { valor: ConfigTracking; hasta: number } | null = null
let cacheCampana: { valor: boolean; hasta: number } | null = null
let cacheTotalHoy: { dia: string; total: number; hasta: number } | null = null

export async function leerConfigTracking(forzar = false): Promise<ConfigTracking> {
  if (!forzar && cacheConfig && cacheConfig.hasta > Date.now()) return cacheConfig.valor
  const doc = await getDb().collection('configuracion').doc('tracking').get()
  const valor = doc.exists ? sanearConfigTracking(doc.data()) : CONFIG_DEFECTO
  cacheConfig = { valor, hasta: Date.now() + 60_000 }
  return valor
}

export function invalidarCacheTracking() {
  cacheConfig = null
  cacheCampana = null
  cacheTotalHoy = null
}

// Hay campaña activa = algún cupón marcado como banner y vigente.
export async function hayCampanaActiva(): Promise<boolean> {
  if (cacheCampana && cacheCampana.hasta > Date.now()) return cacheCampana.valor
  const snap = await getDb().collection('cupones').where('destacado', '==', true).get()
  const hoy = hoyBolivia()
  const valor = snap.docs.some((d) => {
    const c = d.data() as Cupon
    return c.activo && (!c.desde || hoy >= c.desde) && !cuponVencido(c) && !(c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos)
  })
  cacheCampana = { valor, hasta: Date.now() + 60_000 }
  return valor
}

// Total de eventos de hoy (con caché corta; el tope es aproximado por
// unos segundos, a cambio de no leer en cada tanda).
export async function totalEventosHoy(): Promise<number> {
  const dia = diaBoliviaISO()
  if (cacheTotalHoy && cacheTotalHoy.dia === dia && cacheTotalHoy.hasta > Date.now()) return cacheTotalHoy.total
  const doc = await getDb().collection('eventos_diarios').doc(dia).get()
  const total = (doc.exists && doc.data()?.total) || 0
  cacheTotalHoy = { dia, total, hasta: Date.now() + 20_000 }
  return total
}

export function sumarTotalEnCache(n: number) {
  if (cacheTotalHoy && cacheTotalHoy.dia === diaBoliviaISO()) cacheTotalHoy.total += n
}

export async function estadoTracking() {
  const config = await leerConfigTracking()
  if (config.modo === 'apagado') return { config, activo: false, motivo: 'apagado' as const, totalHoy: 0 }
  const campana = config.modo === 'campana' ? await hayCampanaActiva() : false
  if (!trackingActivoAhora(config, campana)) {
    return { config, activo: false, motivo: (config.modo === 'campana' ? 'sin_campana' : 'fuera_de_horario') as 'sin_campana' | 'fuera_de_horario', totalHoy: 0 }
  }
  const totalHoy = await totalEventosHoy()
  if (totalHoy >= config.limiteDiario) return { config, activo: false, motivo: 'limite' as const, totalHoy }
  return { config, activo: true, motivo: 'activo' as const, totalHoy }
}
