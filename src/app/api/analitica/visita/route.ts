import { NextResponse } from 'next/server'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — el navegador lo llama una sola vez
// por pestaña/sesión (ver src/components/RegistrarVisita.tsx), así que
// esto se acerca más a "sesiones" que a "vistas de página" — no cuenta
// cada clic interno, solo que alguien entró al sitio. No guarda IP,
// user-agent ni ningún otro dato: es un contador de un solo campo.
export async function POST() {
  await sumarMetricaDiaria('visitas').catch(() => {})
  return NextResponse.json({ ok: true })
}
