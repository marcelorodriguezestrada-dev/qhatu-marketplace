// Registro de eventos (event tracking) con control de consumo.
//
// Se controla desde Admin → Analítica y está pensado para gastar lo
// menos posible del plan gratis de Firebase:
//  - modo: apagado / siempre / solo en un horario / solo mientras hay
//    una campaña activa (un cupón "banner" vigente).
//  - tope diario de eventos: al llegar, se pausa solo hasta mañana.
//  - el celular junta los eventos y los manda en tandas; el servidor
//    guarda cada tanda como UN resumen (contadores por día/hora/evento),
//    así cada tanda cuesta 1 escritura en vez de 1 por clic.
//  - "guardar detalle" (cada evento con sus parámetros) es opcional y
//    viene apagado: suma 1 escritura más por tanda.

export const EVENTOS = [
  { id: 'ver_producto', label: 'Ver producto' },
  { id: 'agregar_carrito', label: 'Agregar al carrito' },
  { id: 'guardar_favorito', label: 'Guardar en favoritos' },
  { id: 'iniciar_checkout', label: 'Iniciar checkout' },
  { id: 'aplicar_cupon', label: 'Aplicar cupón' },
  { id: 'subir_comprobante', label: 'Subir comprobante' },
  { id: 'comprobante_rechazado', label: 'Comprobante rechazado' },
  { id: 'compra_confirmada', label: 'Compra (pago informado)' },
  { id: 'click_banner', label: 'Clic en banner de cupón' },
  { id: 'abrir_notificacion', label: 'Abrir notificación' },
] as const

export type NombreEvento = (typeof EVENTOS)[number]['id']

export type ModoTracking = 'apagado' | 'siempre' | 'horario' | 'campana'

export type ConfigTracking = {
  modo: ModoTracking
  // Solo modo 'horario': HH:MM hora de Bolivia. Si desde > hasta, cruza la medianoche.
  horaDesde: string
  horaHasta: string
  limiteDiario: number
  guardarDetalle: boolean
  // Eventos que se registran (los demás se ignoran).
  eventos: NombreEvento[]
}

export const CONFIG_DEFECTO: ConfigTracking = {
  modo: 'apagado',
  horaDesde: '08:00',
  horaHasta: '22:00',
  limiteDiario: 2000,
  guardarDetalle: false,
  eventos: EVENTOS.map((e) => e.id),
}

// Plan gratis (Spark) de Firestore, por día.
export const CUOTA_GRATIS = { escrituras: 20000, lecturas: 50000 }

export function horaBoliviaHHMM(ahora = Date.now()): string {
  return new Date(ahora - 4 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

export function diaBoliviaISO(ahora = Date.now()): string {
  return new Date(ahora - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// ¿Corresponde registrar eventos ahora? (sin mirar el tope diario)
export function trackingActivoAhora(c: ConfigTracking, hayCampanaActiva: boolean, ahora = Date.now()): boolean {
  if (c.modo === 'siempre') return true
  if (c.modo === 'campana') return hayCampanaActiva
  if (c.modo === 'horario') {
    const h = horaBoliviaHHMM(ahora)
    return c.horaDesde <= c.horaHasta ? h >= c.horaDesde && h < c.horaHasta : h >= c.horaDesde || h < c.horaHasta
  }
  return false
}

export function sanearConfigTracking(body: any): ConfigTracking {
  const hora = (v: unknown, def: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : def)
  const modos: ModoTracking[] = ['apagado', 'siempre', 'horario', 'campana']
  const ids = EVENTOS.map((e) => e.id) as string[]
  const limite = Math.floor(Number(body?.limiteDiario))
  return {
    modo: modos.includes(body?.modo) ? body.modo : 'apagado',
    horaDesde: hora(body?.horaDesde, CONFIG_DEFECTO.horaDesde),
    horaHasta: hora(body?.horaHasta, CONFIG_DEFECTO.horaHasta),
    limiteDiario: Number.isFinite(limite) ? Math.max(100, Math.min(100000, limite)) : CONFIG_DEFECTO.limiteDiario,
    guardarDetalle: !!body?.guardarDetalle,
    eventos: Array.isArray(body?.eventos) ? (body.eventos.filter((e: unknown) => typeof e === 'string' && ids.includes(e)) as NombreEvento[]) : CONFIG_DEFECTO.eventos,
  }
}
