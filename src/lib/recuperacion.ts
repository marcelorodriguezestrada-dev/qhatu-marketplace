// Recuperación de compras ("Estabas mirando esto"): a quien miró un
// producto 2 veces o lo agregó al carrito y no lo compró en X horas, le
// llega un aviso a la campanita con link directo al producto.
// Se controla desde Admin → Analítica. Pensado para el plan gratis:
//  - solo usuarios con sesión iniciada (a los anónimos no hay a quién avisar),
//  - se guarda 1 documento por persona+producto, y solo con señales
//    fuertes (carrito, o la 2ª vista del mismo producto),
//  - se envía una vez por día, en la hora elegida (tu hora pico): lo
//    dispara el propio tráfico del sitio en esa hora, sin cron pago.

export type ConfigRecuperacion = {
  activo: boolean
  // Hora de Bolivia (0-23) en la que se mandan los avisos del día.
  horaEnvio: number
  // Horas que se espera desde la última vez que miró/agregó antes de avisar.
  esperaHoras: number
  // Avisos de este tipo como máximo por persona cada 7 días.
  maxPorSemana: number
  // Si también cuenta "lo miró 2 veces" (además de "lo agregó al carrito").
  incluirVistos: boolean
}

export const RECUPERACION_DEFECTO: ConfigRecuperacion = {
  activo: false,
  horaEnvio: 18,
  esperaHoras: 24,
  maxPorSemana: 2,
  incluirVistos: true,
}

export function sanearConfigRecuperacion(b: any): ConfigRecuperacion {
  const entero = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.floor(Number(v))
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
  }
  return {
    activo: !!b?.activo,
    horaEnvio: entero(b?.horaEnvio, 0, 23, RECUPERACION_DEFECTO.horaEnvio),
    esperaHoras: entero(b?.esperaHoras, 2, 168, RECUPERACION_DEFECTO.esperaHoras),
    maxPorSemana: entero(b?.maxPorSemana, 1, 7, RECUPERACION_DEFECTO.maxPorSemana),
    incluirVistos: b?.incluirVistos !== false,
  }
}

export type TipoInteres = 'visto' | 'carrito'
