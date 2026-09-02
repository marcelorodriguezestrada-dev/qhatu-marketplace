import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { PRODUCTOS_SEED } from '@/data/productos'

export const dynamic = 'force-dynamic'

// GET público: devuelve el catálogo. Si todavía no cargaste productos
// propios en Firestore, cae al catálogo semilla para que la tienda no
// se vea vacía en desarrollo.
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('productos').get()
    if (snap.empty) {
      return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed' })
    }
    const productos = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ productos, fuente: 'firestore' })
  } catch (err) {
    console.error('GET /api/productos', err)
    // Si Firebase todavía no está configurado, igual mostramos el catálogo
    // semilla en vez de romper la página — útil para probar el frontend
    // antes de terminar de configurar el backend.
    return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed-fallback' })
  }
}

// POST: alta de un producto nuevo (uso administrativo — sumale
// autenticación real antes de exponer esto a vendedores externos).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, vendedor, categoria, precio, icono } = body
    if (!nombre || !vendedor || !categoria || !precio) {
      return NextResponse.json({ error: 'Faltan datos del producto.' }, { status: 400 })
    }
    const db = getDb()
    const ref = await db.collection('productos').add({
      nombre, vendedor, categoria, precio, icono: icono || 'shoe',
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/productos', err)
    return NextResponse.json({ error: 'No se pudo crear el producto.' }, { status: 500 })
  }
}
