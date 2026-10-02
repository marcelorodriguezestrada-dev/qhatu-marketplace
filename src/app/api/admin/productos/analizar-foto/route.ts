import { NextRequest, NextResponse } from 'next/server'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { analizarFotoProducto, LimiteIA } from '@/lib/fotoProductoIA'

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
  let categorias = CATEGORIAS_PRODUCTOS_BASE
  try { categorias = (await construirArbolCategoriasProductos()).categorias } catch {}
  try {
    const r = await analizarFotoProducto(imagenUrl, categorias, typeof pista === 'string' ? pista.slice(0, 120) : undefined)
    return NextResponse.json(r || { rubroId: null, nombre: '', publico: null, colores: [], descripcion: '' })
  } catch (err) {
    if (err instanceof LimiteIA) return NextResponse.json({ error: 'limite' }, { status: 429 })
    return NextResponse.json({ error: 'No se pudo analizar la foto.' }, { status: 500 })
  }
}
