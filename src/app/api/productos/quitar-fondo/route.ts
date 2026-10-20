import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { fondoBlanco, SinFondoError } from '@/lib/fondoBlancoIA'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST (con sesión) FormData { image } → { dataUrl } con el producto sobre
// fondo blanco (Gemini, ver src/lib/fondoBlancoIA.ts). Lo usa Vender →
// "Quitar fondo"; el vendedor ve el resultado antes de usarlo.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Iniciá sesión para quitar el fondo.' }, { status: 401 })
  try {
    const file = (await req.formData()).get('image') as File | null
    if (!file || !file.size) return NextResponse.json({ error: 'Falta la foto.' }, { status: 400 })
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'La foto es muy grande (máx. 12 MB).' }, { status: 400 })
    const buf = await fondoBlanco(Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}` })
  } catch (err) {
    const msg = err instanceof SinFondoError ? err.message : 'No se pudo quitar el fondo.'
    if (!(err instanceof SinFondoError)) console.error('POST /api/productos/quitar-fondo', err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
