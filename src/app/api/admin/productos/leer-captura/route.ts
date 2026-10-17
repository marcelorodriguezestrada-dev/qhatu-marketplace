import { NextRequest, NextResponse } from 'next/server'
import { leerCapturaCatalogo, ErrorIA, LimiteIA } from '@/lib/fotoProductoIA'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST { imagen: data:image/... } → { vista, productos: [{ nombre, precio, precioAntes, descripcion, caja }] }
// Para "📲 Capturas de catálogo" del admin (Importar). 429 = esperar y reintentar.
export async function POST(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 })
  const { imagen } = await req.json().catch(() => ({}))
  if (typeof imagen !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(imagen) || imagen.length > 4_000_000) {
    return NextResponse.json({ error: 'Captura inválida o muy pesada.' }, { status: 400 })
  }
  try {
    return NextResponse.json(await leerCapturaCatalogo(imagen))
  } catch (err) {
    if (err instanceof LimiteIA) return NextResponse.json({ error: 'limite' }, { status: 429 })
    if (err instanceof ErrorIA) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('POST /api/admin/productos/leer-captura', err)
    return NextResponse.json({ error: 'No se pudo leer la captura.' }, { status: 500 })
  }
}
