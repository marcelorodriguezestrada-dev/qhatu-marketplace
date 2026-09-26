import { NextResponse } from 'next/server'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'
import { intentarRecuperacionAutomatica } from '@/lib/recuperacionServer'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — el navegador lo llama una sola vez
// por pestaña/sesión (ver src/components/RegistrarVisita.tsx), así que
// esto se acerca más a "sesiones" que a "vistas de página" — no cuenta
// cada clic interno, solo que alguien entró al sitio. No guarda IP,
// user-agent ni ningún otro dato: es un contador de un solo campo.
export async function POST() {
  await sumarMetricaDiaria('visitas').catch(() => {})
  // Avisos "Estabas mirando esto": si es la hora de envío elegida y hoy
  // todavía no se mandaron, los manda ahora (el tráfico del sitio hace de
  // reloj, sin cron). Casi siempre vuelve al instante sin leer nada.
  await intentarRecuperacionAutomatica().catch((err) => console.error('recuperación automática', err))
  return NextResponse.json({ ok: true })
}
