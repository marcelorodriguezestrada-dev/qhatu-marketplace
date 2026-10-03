import { NextResponse } from 'next/server'
import { leerZonasExtra } from '@/lib/zonasEnvioServer'

export const dynamic = 'force-dynamic'

// Zonas agregadas por el admin (además de las de src/data/zonasPotosi.ts).
// GET → { extras: [{ nombre, lat, lng }] }
export async function GET() {
  try {
    return NextResponse.json({ extras: await leerZonasExtra() }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  } catch {
    return NextResponse.json({ extras: [] })
  }
}
