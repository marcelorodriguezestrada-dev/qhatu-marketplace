import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { PRODUCTOS_SEED } from '@/data/productos'
import { LEGACY_CATEGORIA_A_RUBRO } from '@/data/categoriasProductos'
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
    // Asegurar que exista `thumbUrl` en la respuesta para optimizar listados
    productos = productos.map((p) => ({ ...p, thumbUrl: p.thumbUrl || p.imagenUrl || '' }))
    // Compatibilidad: productos publicados antes de la clasificación por
    // rubro no tienen `rubro`, solo el `categoria` viejo. Les asignamos
    // el rubro "Otro ___" de esa misma categoría para no perderlos del
    // filtro nuevo; el vendedor puede después editarlos y elegir uno
    // más específico.
    productos = productos.map((p) =>
      p.rubro ? p : { ...p, rubro: LEGACY_CATEGORIA_A_RUBRO[p.categoria as string] || 'otro-producto' }
    )
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
    const { nombre, rubro, precio, icono, imagenUrl, precioOriginal, plan, descripcionCorta, descripcionLarga, thumbUrl, talles, colores, materiales, compraMinima } = body
    if (!nombre || !rubro || !precio) {
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
      `Producto: ${nombre}\nRubro: ${rubro}\nPrecio: Bs ${precio}${precioOriginalValido ? ` (antes Bs ${precioOriginalValido})` : ''}`
    )

    const db = getDb()

    // Copiamos el nombre/logo de la tienda del vendedor (si ya la
    // configuró) para mostrarlo en el catálogo en vez del email — así
    // el comprador ve "Zapatería Doña Rosa" en vez de
    // "marcelo@gmail.com". Si el vendedor todavía no configuró su
    // tienda, queda vacío y el catálogo cae al email como respaldo.
    let tiendaNombre = ''
    let tiendaLogoUrl = ''
    try {
      const vendedorDoc = await db.collection('vendedores').doc(usuario.uid).get()
      if (vendedorDoc.exists) {
        const vd = vendedorDoc.data() as any
        tiendaNombre = vd.nombreNegocio || ''
        tiendaLogoUrl = vd.logoUrl || ''
      }
    } catch {
      // si falla, no bloqueamos la publicación por esto
    }

    const ref = await db.collection('productos').add({
      nombre,
      rubro,
      precio,
      precioOriginal: precioOriginalValido,
      icono: icono || 'shoe',
      imagenUrl: imagenUrl || '',
      thumbUrl: thumbUrl || '',
      descripcionCorta: descripcionCorta || '',
      descripcionLarga: descripcionLarga || '',
      talles: Array.isArray(talles) ? talles.filter(Boolean) : [],
      colores: Array.isArray(colores) ? colores.filter(Boolean) : [],
      materiales: materiales || '',
      compraMinima: compraMinima ? Math.max(1, Number(compraMinima)) : 1,
      vendedorId: usuario.uid,
      vendedor: usuario.email,
      tiendaNombre,
      tiendaLogoUrl,
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
