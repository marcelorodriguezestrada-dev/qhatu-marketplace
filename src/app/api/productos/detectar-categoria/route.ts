import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { detectarRubroProductoIA } from '@/lib/moderacionIA'

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
  const rubros = categorias.flatMap((c) => c.rubros.map((r) => ({ id: r.id, label: r.label, categoriaId: c.id, categoriaLabel: c.label })))
  const r = await detectarRubroProductoIA(imagenUrl, rubros)
  if (!r) return NextResponse.json({ rubroId: null })
  const categoriaId = rubros.find((x) => x.id === r.rubroId)!.categoriaId
  return NextResponse.json({ rubroId: r.rubroId, categoriaId, nombre: r.nombre })
}
