import { NextRequest, NextResponse } from 'next/server'
import { calendarioPlantilla, esFecha } from '@/lib/lanzamiento'
import { calendarioIA, leerConfigLanzamiento } from '@/lib/lanzamientoServer'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST (admin) { desde, dias, extra }: propuesta de calendario (no se
// guarda: el admin la revisa y la agrega). Sin IA, una semana tipo.
export async function POST(req: NextRequest) {
  const p = req.headers.get('x-admin-password')
  if (!p || p !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const cfg = await leerConfigLanzamiento()
    await cargarCiudadesServidor().catch(() => null)
    const desde = esFecha(body.desde) ? body.desde : new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
    const dias = Math.min(31, Math.max(1, Number(body.dias) || 7))
    const ia = await calendarioIA(cfg, desde, dias, String(body.extra || ''))
    if (ia && ia.length) return NextResponse.json({ propuestas: ia, conIA: true })
    return NextResponse.json({ propuestas: calendarioPlantilla(cfg, desde, dias), conIA: false })
  } catch (err) {
    console.error('POST /api/admin/lanzamiento/ia', err)
    return NextResponse.json({ error: 'No se pudo armar el calendario.' }, { status: 500 })
  }
}
