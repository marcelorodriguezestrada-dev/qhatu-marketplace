import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { ajustesActuales, cargarConfigConsumo } from '@/lib/consumoFirestore'

export const dynamic = 'force-dynamic'

// GET — público: cada cuánto preguntan la campanita, el seguimiento de un
// pedido y la alarma del admin (se cambian en Admin → Consumo de la base).
// 5 min en el CDN: casi no cuesta lecturas.
export async function GET() {
  await cargarConfigConsumo(getDb()).catch(() => null)
  const a = ajustesActuales()
  return NextResponse.json(
    { campanita: a.campanita, seguimiento: a.seguimiento, alarma: a.alarma },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
