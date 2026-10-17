import { NextRequest, NextResponse } from 'next/server'
import { leerCapturaCatalogo, ordenarTextoCaptura, ErrorIA, LimiteIA, SinVision } from '@/lib/fotoProductoIA'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Para "📲 Capturas de catálogo" del admin (Importar). 429 = esperar y reintentar.
//   POST { imagen: data:image/... } → la IA mira la captura (Gemini o Groq):
//        { vista, productos: [{ nombre, precio, precioAntes, descripcion, caja }] }
//        Si ninguna IA mira fotos → 503 { sinVision: true } y el panel la
//        lee en el navegador (Tesseract) y manda el texto:
//   POST { renglones: [{ texto, y, x }] } → { vista, productos: [{ …, renglon }] }
export async function POST(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  try {
    if (Array.isArray(body.renglones)) {
      if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 })
      const renglones = body.renglones
        .slice(0, 150)
        .map((r: any) => ({ texto: String(r?.texto || '').slice(0, 200), y: Number(r?.y) || 0, x: Number(r?.x) || 0 }))
        .filter((r: any) => r.texto.trim())
      if (!renglones.length) return NextResponse.json({ vista: 'detalle', productos: [] })
      return NextResponse.json(await ordenarTextoCaptura(renglones))
    }
    const { imagen } = body
    if (typeof imagen !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(imagen) || imagen.length > 4_000_000) {
      return NextResponse.json({ error: 'Captura inválida o muy pesada.' }, { status: 400 })
    }
    return NextResponse.json(await leerCapturaCatalogo(imagen))
  } catch (err) {
    if (err instanceof LimiteIA) return NextResponse.json({ error: 'limite' }, { status: 429 })
    if (err instanceof SinVision) return NextResponse.json({ error: err.message, sinVision: true }, { status: 503 })
    if (err instanceof ErrorIA) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('POST /api/admin/productos/leer-captura', err)
    return NextResponse.json({ error: 'No se pudo leer la captura.' }, { status: 500 })
  }
}
