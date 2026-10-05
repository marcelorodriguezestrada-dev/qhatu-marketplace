import { NextRequest, NextResponse } from 'next/server'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { analizarFotoProducto, ErrorIA, LimiteIA } from '@/lib/fotoProductoIA'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST { imagenUrl, pista? } → { rubroId, nombre, publico, colores, descripcion }
// Para "📁 Importar carpeta" del admin. 429 = esperar y reintentar.
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 })
  const { imagenUrl, pista } = await req.json().catch(() => ({}))
  if (typeof imagenUrl !== 'string' || !/^https:\/\//.test(imagenUrl)) return NextResponse.json({ error: 'Imagen inválida.' }, { status: 400 })
  // Foto de Drive (Armar planilla): la IA no puede abrir el link de Drive,
  // así que la bajamos acá y se la mandamos como imagen.
  let url = imagenUrl
  const idDrive = imagenUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([a-zA-Z0-9_-]{10,})/)?.[1]
  if (idDrive) {
    try {
      const r = await fetch(`https://drive.google.com/thumbnail?id=${idDrive}&sz=w800`, { redirect: 'follow' })
      const tipo = (r.headers.get('content-type') || '').split(';')[0]
      if (!r.ok || !tipo.startsWith('image/')) return NextResponse.json({ error: 'La foto de Drive no es pública: compartí la carpeta como “Cualquier persona con el enlace”.' }, { status: 400 })
      url = `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
    } catch {
      return NextResponse.json({ error: 'No se pudo bajar la foto de Drive.' }, { status: 502 })
    }
  }
  let categorias = CATEGORIAS_PRODUCTOS_BASE
  try { categorias = (await construirArbolCategoriasProductos()).categorias } catch {}
  try {
    return NextResponse.json(await analizarFotoProducto(url, categorias, typeof pista === 'string' ? pista.slice(0, 120) : undefined))
  } catch (err) {
    if (err instanceof LimiteIA) return NextResponse.json({ error: 'limite' }, { status: 429 })
    // El motivo llega al panel (antes fallaba sin avisar).
    if (err instanceof ErrorIA) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('POST /api/admin/productos/analizar-foto', err)
    return NextResponse.json({ error: 'No se pudo analizar la foto.' }, { status: 500 })
  }
}
