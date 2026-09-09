import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CATEGORIAS_BASE } from '@/data/categorias'
import { construirArbolCategorias } from '@/lib/categoriasServer'

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

// GET: público — el árbol completo de categorías y rubros, ya
// combinado. Es lo que consume el selector de /servicios,
// /publicar-servicio y /admin. El armado en sí vive en
// src/lib/categoriasServer.ts (ver el comentario ahí del porqué).
export async function GET() {
  try {
    const arbol = await construirArbolCategorias()
    return NextResponse.json(arbol)
  } catch (err) {
    console.error('GET /api/categorias', err)
    return NextResponse.json({ categorias: CATEGORIAS_BASE, rubrosFlat: [] })
  }
}

// POST: solo admin — agregar una categoría nueva, agregar un rubro
// nuevo dentro de una categoría, mover un rubro existente a otra
// categoría, o renombrar una categoría. Se manda todo por acá (en vez
// de un endpoint por acción) porque son operaciones chicas de
// mantenimiento de la taxonomía, todas detrás del mismo candado de
// contraseña de admin.
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
      await db.collection('categorias_personalizadas').doc(slug).set(
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
      await db.collection('rubros_personalizados').doc(slug).set(
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
      // Si es un rubro personalizado (tiene documento propio), le
      // actualizamos la categoría directo. Si es un rubro de la base
      // fija del código, no tiene documento — se guarda la reubicación
      // aparte, como excepción.
      const refPersonalizado = db.collection('rubros_personalizados').doc(rubroId)
      const docPersonalizado = await refPersonalizado.get()
      if (docPersonalizado.exists) {
        await refPersonalizado.set({ categoriaId }, { merge: true })
      } else {
        await db.collection('rubro_categoria_overrides').doc(rubroId).set(
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
      // Funciona tanto para una categoría de la base fija del código
      // (guarda el nombre nuevo con la misma id, y el armado del árbol
      // lo usa para pisar el label original) como para una categoría
      // que ya era personalizada.
      await db.collection('categorias_personalizadas').doc(categoriaId).set(
        { label },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/categorias', err)
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 })
  }
}
