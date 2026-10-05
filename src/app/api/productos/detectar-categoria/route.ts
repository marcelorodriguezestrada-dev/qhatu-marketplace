import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { analizarFotoProducto, LimiteIA } from '@/lib/fotoProductoIA'

export const dynamic = 'force-dynamic'

// POST { imagenUrl } → { rubroId, categoriaId, nombre } — /vender lo
// llama apenas se sube la foto principal para preseleccionar la
// categoría. Solo usuarios logueados o el admin (gasta cuota de Groq).
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  const pw = req.headers.get('x-admin-password')
  if (!usuario && !(pw && pw === process.env.ADMIN_PASSWORD)) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }
  const { imagenUrl } = await req.json().catch(() => ({}))
  if (typeof imagenUrl !== 'string' || !/^https:\/\/([a-z0-9-]+\.)?ibb\.co\//i.test(imagenUrl)) {
    return NextResponse.json({ error: 'Imagen inválida.' }, { status: 400 })
  }
  let categorias = CATEGORIAS_PRODUCTOS_BASE
  try {
    categorias = (await construirArbolCategoriasProductos()).categorias
  } catch {}
  // Mismo análisis que la importación del admin (ver src/lib/fotoProductoIA.ts):
  // la IA dice qué es la foto y la categoría se elige con eso (pedido chico,
  // no la lista entera de rubros).
  let r: Awaited<ReturnType<typeof analizarFotoProducto>>
  try {
    r = await analizarFotoProducto(imagenUrl, categorias)
  } catch (err) {
    if (!(err instanceof LimiteIA)) console.error('detectar-categoria', err)
    return NextResponse.json({ rubroId: null })
  }
  const rubroId = r.rubroId
  if (!rubroId) return NextResponse.json({ rubroId: null, nombre: r.nombre })
  const categoriaId = categorias.find((c) => c.rubros.some((x) => x.id === rubroId))?.id
  return NextResponse.json({ rubroId, categoriaId, nombre: r.nombre })
}
