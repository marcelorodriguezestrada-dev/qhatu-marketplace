import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { PRODUCTOS_SEED } from '@/data/productos'

export const dynamic = 'force-dynamic'

// GET público: devuelve el catálogo completo (de todos los vendedores),
// ordenado por más recientes primero. Si todavía no hay productos
// cargados por usuarios, cae al catálogo semilla para que la tienda no
// se vea vacía en desarrollo.
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('productos').get()
    if (snap.empty) {
      return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed' })
    }
    const productos = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => p.estado !== 'rechazado' && p.estado !== 'oculto')
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
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
    const { nombre, categoria, precio, icono, imagenUrl, precioOriginal } = body
    if (!nombre || !categoria || !precio) {
      return NextResponse.json({ error: 'Faltan datos del producto.' }, { status: 400 })
    }
    // El descuento tiene que ser real: si mandan un precioOriginal, tiene
    // que ser mayor al precio actual, o lo ignoramos.
    const precioOriginalValido =
      precioOriginal && Number(precioOriginal) > Number(precio) ? Number(precioOriginal) : null

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
      estado: 'activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/productos', err)
    return NextResponse.json({ error: 'No se pudo crear el producto.' }, { status: 500 })
  }
}
