import { NextRequest, NextResponse } from 'next/server'
import { reescribirMarketingIA } from '@/lib/moderacionIA'
import { buscarCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'

export const dynamic = 'force-dynamic'

// POST (admin) { base, red, tono, ciudad } → otra versión del texto con IA.
export async function POST(req: NextRequest) {
  await cargarCiudadesServidor().catch(() => null) // nombres de las ciudades agregadas desde el admin
  const p = req.headers.get('x-admin-password')
  if (!p || p !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json()
  const base = String(body.base || '').slice(0, 2000)
  if (base.length < 10) return NextResponse.json({ error: 'Falta el texto.' }, { status: 400 })
  const tono = ({ cercano: 'cercano y amable', entusiasta: 'entusiasta', profesional: 'profesional y confiable', urgente: 'de oportunidad, con urgencia (sin inventar plazos)' } as Record<string, string>)[body.tono] || 'cercano y amable'
  const texto = await reescribirMarketingIA(base, String(body.red || 'Facebook'), tono, buscarCiudad(body.ciudad).nombre)
  if (!texto) return NextResponse.json({ error: 'La IA no está disponible ahora. Usá la plantilla.' }, { status: 503 })
  return NextResponse.json({ texto })
}
