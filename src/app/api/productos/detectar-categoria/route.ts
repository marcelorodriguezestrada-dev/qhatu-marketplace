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
  // En dos pasos (son ~3.200 rubros, no entran en una sola consulta):
  // 1) la IA elige entre las subcategorías y los rubros sueltos;
  // 2) si eligió una subcategoría, elige el rubro dentro de ella.
  const paso1 = categorias.flatMap((c) => {
    const vistos = new Set<string>()
    const out: { id: string; label: string; categoriaLabel: string }[] = []
    for (const r of c.rubros) {
      if (!r.grupoId) out.push({ id: r.id, label: r.label, categoriaLabel: c.label })
      else if (!vistos.has(r.grupoId)) { vistos.add(r.grupoId); out.push({ id: `g:${r.grupoId}`, label: r.grupo || r.grupoId, categoriaLabel: c.label }) }
    }
    return out
  })
  const r1 = await detectarRubroProductoIA(imagenUrl, paso1)
  if (!r1) return NextResponse.json({ rubroId: null })
  let rubroId = r1.rubroId
  if (rubroId.startsWith('g:')) {
    const grupoId = rubroId.slice(2)
    const cat = categorias.find((c) => c.rubros.some((r) => r.grupoId === grupoId))!
    const hojas = cat.rubros.filter((r) => r.grupoId === grupoId)
    const r2 = await detectarRubroProductoIA(imagenUrl, hojas.map((h) => ({ id: h.id, label: h.label, categoriaLabel: `${cat.label} > ${h.grupo}` })))
    // Si el 2º paso falla, queda en "Otros" de esa subcategoría (su id es el de la subcategoría).
    rubroId = r2?.rubroId || (hojas.find((h) => h.id === grupoId) || hojas[hojas.length - 1]).id
  }
  const categoriaId = categorias.find((c) => c.rubros.some((r) => r.id === rubroId))?.id
  return NextResponse.json({ rubroId, categoriaId, nombre: r1.nombre })
}
