import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { PRODUCTOS_SEED } from '@/data/productos'
import { evaluarConIA } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// GET: público sin filtrar rechazados/ocultos (para el catálogo). Si se
// manda la contraseña de admin, devuelve TODOS sin ese filtro — así el
// panel /admin puede seguir viendo y gestionando un producto después de
// rechazarlo u ocultarlo, en vez de que desaparezca de su propia lista
// de moderación.
export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const snap = await db.collection('productos').get()
    if (snap.empty) {
      return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed' })
    }

    const password = req.headers.get('x-admin-password')
    const esAdmin = !!password && password === process.env.ADMIN_PASSWORD

    let productos = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[]
    if (!esAdmin) {
      productos = productos.filter((p) => p.estado !== 'rechazado' && p.estado !== 'oculto')
    }
    productos = productos.sort((a, b) => {
      const premiumDiff = Number(b.plan === 'premium') - Number(a.plan === 'premium')
      if (premiumDiff !== 0) return premiumDiff
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })

    return NextResponse.json({ productos, fuente: 'firestore' })
  } catch (err) {
    console.error('GET /api/productos', err)
    return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed-fallback' })
  }
}

// POST: publica un producto nuevo. Requiere estar logueado — el
// producto queda asociado al usuario que lo publicó (vendedorId), así
// que cada uno solo puede después editar o borrar lo suyo.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para publicar un producto.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { nombre, categoria, precio, icono, imagenUrl, precioOriginal, plan } = body
    if (!nombre || !categoria || !precio) {
      return NextResponse.json({ error: 'Faltan datos del producto.' }, { status: 400 })
    }
    const planValido = plan === 'premium' ? 'premium' : 'basico'
    // El descuento tiene que ser real: si mandan un precioOriginal, tiene
    // que ser mayor al precio actual, o lo ignoramos.
    const precioOriginalValido =
      precioOriginal && Number(precioOriginal) > Number(precio) ? Number(precioOriginal) : null

    // Pre-filtro de moderación con IA — no bloquea la publicación, solo
    // le pone una etiqueta de riesgo para priorizar tu revisión en /admin.
    const moderacionIA = await evaluarConIA(
      `Producto: ${nombre}\nCategoría: ${categoria}\nPrecio: Bs ${precio}${precioOriginalValido ? ` (antes Bs ${precioOriginalValido})` : ''}`
    )

    const db = getDb()
    const ref = await db.collection('productos').add({
      nombre,
      categoria,
      precio,
      precioOriginal: precioOriginalValido,
      icono: icono || 'shoe',
      imagenUrl: imagenUrl || '',
      vendedorId: usuario.uid,
      vendedor: usuario.email,
      plan: planValido,
      estado: 'activo',
      moderacionIA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/productos', err)
    return NextResponse.json({ error: 'No se pudo crear el producto.' }, { status: 500 })
  }
}
