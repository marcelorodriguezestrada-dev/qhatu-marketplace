import { NextRequest, NextResponse } from 'next/server'
import { sumarCampana } from '@/lib/campanasServer'
import { esCodigoCampana } from '@/lib/campanas'

export const dynamic = 'force-dynamic'

// POST { codigo } — alguien entró por el link de una campaña (?c=).
// El navegador lo manda una sola vez por sesión (ver RegistrarCampana).
export async function POST(req: NextRequest) {
  try {
    const { codigo } = await req.json()
    if (esCodigoCampana(codigo)) await sumarCampana(codigo, { visitas: 1 })
  } catch {}
  return NextResponse.json({ ok: true })
}
