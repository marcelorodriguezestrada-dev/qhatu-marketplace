import { NextRequest, NextResponse } from 'next/server'
import { textosVolanteIA } from '@/lib/moderacionIA'
import { buscarCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { TEMAS_VOLANTE, sanearConfigVolante } from '@/lib/volantes'

export const dynamic = 'force-dynamic'

// POST (admin) { idea, ciudad } → { config } con los textos del volante.
export async function POST(req: NextRequest) {
  await cargarCiudadesServidor().catch(() => null) // nombres de las ciudades agregadas desde el admin
  const p = req.headers.get('x-admin-password')
  if (!p || p !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json()
  const idea = String(body.idea || '').trim()
  if (idea.length < 8) return NextResponse.json({ error: 'Contá en una frase de qué es el volante (ej: feria de artesanía, sumar costureras, ofertas de fin de mes).' }, { status: 400 })
  const r = await textosVolanteIA(idea, buscarCiudad(body.ciudad).nombre, TEMAS_VOLANTE.map((t) => t.id))
  if (!r) return NextResponse.json({ error: 'La IA no está disponible ahora. Probá en un rato o editá los textos a mano.' }, { status: 503 })
  const config = sanearConfigVolante({ modo: 'diseno', tema: r.tema, destino: r.destino, textos: r })
  if (!config.textos.titulo || config.textos.cajas.length === 0) return NextResponse.json({ error: 'La IA no armó bien el volante. Probá otra vez.' }, { status: 502 })
  return NextResponse.json({ config })
}
