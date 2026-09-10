import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'

export const dynamic = 'force-dynamic'

function slugify(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// GET: público — el árbol completo de categorías y rubros de
// PRODUCTOS, ya combinado (base + lo agregado en /admin). Lo consumen
// /vender, /producto/[id], el catálogo y la pestaña de productos de
// /admin.
export async function GET() {
  try {
    const arbol = await construirArbolCategoriasProductos()
    return NextResponse.json(arbol)
  } catch (err) {
    console.error('GET /api/categorias-productos', err)
    return NextResponse.json({ categorias: CATEGORIAS_PRODUCTOS_BASE, rubrosFlat: [] })
  }
}

// POST: solo admin — agregar categoría de producto nueva, agregar un
// rubro nuevo dentro de una categoría, mover un rubro existente a
// otra categoría, o renombrar una categoría. Mismo esquema de
// acciones que /api/categorias, en colecciones separadas.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const db = getDb()

    if (body.accion === 'crear_categoria') {
      const label = (body.label || '').trim()
      if (!label) return NextResponse.json({ error: 'Escribí el nombre de la categoría.' }, { status: 400 })
      const slug = slugify(label)
      if (!slug) return NextResponse.json({ error: 'Ese nombre no es válido.' }, { status: 400 })
      await db.collection('categorias_productos_personalizadas').doc(slug).set(
        { label, createdAt: new Date().toISOString() },
        { merge: true }
      )
      return NextResponse.json({ id: slug })
    }

    if (body.accion === 'crear_rubro') {
      const label = (body.label || '').trim()
      const categoriaId = (body.categoriaId || '').trim()
      if (!label || !categoriaId) {
        return NextResponse.json({ error: 'Faltan datos (nombre del rubro y categoría).' }, { status: 400 })
      }
      const slug = slugify(label)
      if (!slug) return NextResponse.json({ error: 'Ese nombre no es válido.' }, { status: 400 })
      await db.collection('rubros_productos_personalizados').doc(slug).set(
        { label, categoriaId, createdAt: new Date().toISOString() },
        { merge: true }
      )
      return NextResponse.json({ id: slug })
    }

    if (body.accion === 'mover_rubro') {
      const rubroId = (body.rubroId || '').trim()
      const categoriaId = (body.categoriaId || '').trim()
      if (!rubroId || !categoriaId) {
        return NextResponse.json({ error: 'Faltan datos (rubro y categoría destino).' }, { status: 400 })
      }
      const refPersonalizado = db.collection('rubros_productos_personalizados').doc(rubroId)
      const docPersonalizado = await refPersonalizado.get()
      if (docPersonalizado.exists) {
        await refPersonalizado.set({ categoriaId }, { merge: true })
      } else {
        await db.collection('rubro_producto_categoria_overrides').doc(rubroId).set(
          { categoriaId },
          { merge: true }
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (body.accion === 'renombrar_categoria') {
      const categoriaId = (body.categoriaId || '').trim()
      const label = (body.label || '').trim()
      if (!categoriaId || !label) {
        return NextResponse.json({ error: 'Faltan datos (categoría y nombre nuevo).' }, { status: 400 })
      }
      await db.collection('categorias_productos_personalizadas').doc(categoriaId).set(
        { label },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/categorias-productos', err)
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 })
  }
}
