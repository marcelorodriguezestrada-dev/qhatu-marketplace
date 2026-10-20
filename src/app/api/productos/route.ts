import { NextRequest, NextResponse } from 'next/server'
import { sumarCampana } from '@/lib/campanasServer'
import { ciudadDe, sanearCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { esPremiumVigente, sanearFotosAdicionales } from '@/lib/planPremium'

async function vendedorPremium(uid: string): Promise<boolean> {
  const doc = await getDb().collection('vendedores').doc(uid).get()
  return esPremiumVigente(doc.data() || {})
}
import { sanearStock } from '@/lib/stock'
import { PRODUCTOS_SEED } from '@/data/productos'
import { LEGACY_CATEGORIA_A_RUBRO, RUBRO_DE_GRUPO } from '@/data/categoriasProductos'
import { evaluarConIA } from '@/lib/moderacionIA'
import { etiquetasParaProducto } from '@/lib/etiquetasProducto'
import { esClaveAdmin } from '@/lib/adminAuth'
import { cabeceraCDN, enCache } from '@/lib/cacheLecturas'

export const dynamic = 'force-dynamic'

// GET: público sin filtrar rechazados/ocultos (para el catálogo). Si se
// manda la contraseña de admin, devuelve TODOS sin ese filtro — así el
// panel /admin puede seguir viendo y gestionando un producto después de
// rechazarlo u ocultarlo, en vez de que desaparezca de su propia lista
// de moderación.
//
// Es lo que más lecturas gasta (lo pide el inicio, cada tienda, cada
// producto y categorías, y lee TODOS los productos): para el público se
// guarda 1 minuto en memoria y en el CDN. El admin (?admin=1 + clave) y
// el vendedor (?fresco=1) lo leen siempre al día.
export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const password = req.headers.get('x-admin-password')
    const esAdmin = (await esClaveAdmin(password))
    const fresco = esAdmin || req.nextUrl.searchParams.has('fresco')
    // ?vendedor=uid: solo los de esa tienda (panel del vendedor), sin leer todo el catálogo.
    const vendedor = req.nextUrl.searchParams.get('vendedor')
    const leer = async () => (await (vendedor ? db.collection('productos').where('vendedorId', '==', vendedor) : db.collection('productos')).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    const docs = fresco || vendedor ? await leer() : await enCache('productos', 60_000, leer)
    if (!docs.length) {
      if (vendedor) return NextResponse.json({ productos: [], fuente: 'firestore' }, { headers: { 'Cache-Control': 'no-store' } })
      return NextResponse.json({ productos: PRODUCTOS_SEED, fuente: 'seed' })
    }

    let productos = docs as any[]
    // Asegurar que exista `thumbUrl` en la respuesta para optimizar listados
    productos = productos.map((p) => ({ ...p, thumbUrl: p.thumbUrl || p.imagenUrl || '' }))
    // Compatibilidad: productos publicados antes de la clasificación por
    // rubro no tienen `rubro`, solo el `categoria` viejo. Les asignamos
    // el rubro "Otro ___" de esa misma categoría para no perderlos del
    // filtro nuevo; el vendedor puede después editarlos y elegir uno
    // más específico.
    productos = productos.map((p) =>
      p.rubro ? (RUBRO_DE_GRUPO[p.rubro] ? { ...p, rubro: RUBRO_DE_GRUPO[p.rubro] } : p) : { ...p, rubro: LEGACY_CATEGORIA_A_RUBRO[p.categoria as string] || 'otro-producto' }
    )
    // Compatibilidad: productos publicados antes del campo `publico`.
    productos = productos.map((p) => (p.publico ? p : { ...p, publico: 'unisex' }))
    if (!esAdmin) {
      productos = productos.filter((p) => p.estado !== 'rechazado' && p.estado !== 'oculto')
    }
    productos = productos.sort((a, b) => {
      const premiumDiff = Number(b.plan === 'premium') - Number(a.plan === 'premium')
      if (premiumDiff !== 0) return premiumDiff
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })

    return NextResponse.json({ productos, fuente: 'firestore' }, { headers: fresco || vendedor || password ? { 'Cache-Control': 'no-store' } : cabeceraCDN(60) })
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
    const { nombre, rubro, publico, precio, icono, imagenUrl, imagenViewerUrl, precioOriginal, plan, descripcionCorta, descripcionLarga, thumbUrl, talles, colores, materiales, compraMinima, stock, fotosAdicionales } = body
    if (!nombre || !rubro || !precio) {
      return NextResponse.json({ error: 'Faltan datos del producto.' }, { status: 400 })
    }
    const publicosValidos = ['mujer', 'hombre', 'ninos', 'unisex']
    const publicoValido = publicosValidos.includes(publico) ? publico : 'unisex'
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

    // Palabras de búsqueda ocultas (IA): arrancan en paralelo y se
    // guardan apenas estén — si fallan, el producto queda igual.
    const etiquetasPromesa = etiquetasParaProducto({ nombre, rubro, publico: publicoValido, descripcionCorta, descripcionLarga, colores, materiales }).catch(() => [])

    const db = getDb()

    // Copiamos el nombre/logo de la tienda del vendedor (si ya la
    // configuró) para mostrarlo en el catálogo en vez del email — así
    // el comprador ve "Zapatería Doña Rosa" en vez de
    // "marcelo@gmail.com". Si el vendedor todavía no configuró su
    // tienda, queda vacío y el catálogo cae al email como respaldo.
    let tiendaNombre = ''
    let tiendaLogoUrl = ''
    // El producto hereda la ciudad de la tienda (Potosí si no cargó).
    // Si todavía no guardó su tienda, vale la ciudad que manda el formulario.
    await cargarCiudadesServidor() // ciudades agregadas desde el admin
    let ciudad = sanearCiudad(body.ciudad)
    let enviaATodoBolivia = false
    let visibleEn: string[] = []
    try {
      const vendedorDoc = await db.collection('vendedores').doc(usuario.uid).get()
      if (vendedorDoc.exists) {
        const vd = vendedorDoc.data() as any
        tiendaNombre = vd.nombreNegocio || ''
        tiendaLogoUrl = vd.logoUrl || ''
        if (vd.ciudad) ciudad = ciudadDe(vd)
        enviaATodoBolivia = !!vd.tiposVenta?.haceEnvios && vd.envioPropio?.alcance === 'bolivia'
        visibleEn = Array.isArray(vd.visibleEn) ? vd.visibleEn : []
      }
    } catch {
      // si falla, no bloqueamos la publicación por esto
    }

    const esPrimerProducto = (await db.collection('productos').where('vendedorId', '==', usuario.uid).limit(1).get()).empty
    const ref = await db.collection('productos').add({
      nombre,
      rubro,
      publico: publicoValido,
      precio,
      precioOriginal: precioOriginalValido,
      icono: icono || 'shoe',
      imagenUrl: imagenUrl || '',
      imagenViewerUrl: imagenViewerUrl || '',
      thumbUrl: thumbUrl || '',
      descripcionCorta: descripcionCorta || '',
      descripcionLarga: descripcionLarga || '',
      talles: Array.isArray(talles) ? talles.filter(Boolean) : [],
      colores: Array.isArray(colores) ? colores.filter(Boolean) : [],
      materiales: materiales || '',
      compraMinima: compraMinima ? Math.max(1, Number(compraMinima)) : 1,
      // Unidades disponibles; null = sin control de stock (ver src/lib/stock.ts).
      stock: sanearStock(stock),
      // Galería extra: solo si el vendedor tiene Premium vigente (se
      // verifica acá, no alcanza con que lo mande el formulario).
      fotosAdicionales: Array.isArray(fotosAdicionales) && fotosAdicionales.length > 0 && (await vendedorPremium(usuario.uid)) ? sanearFotosAdicionales(fotosAdicionales) : [],
      vendedorId: usuario.uid,
      vendedor: usuario.email,
      ...(usuario.cargaAdmin ? { cargadoPorAdmin: true } : {}),
      tiendaNombre,
      tiendaLogoUrl,
      ciudad,
      enviaATodoBolivia,
      ...(visibleEn.length ? { visibleEn } : {}),
      plan: planValido,
      estado: 'activo',
      moderacionIA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const etiquetasBusqueda = await etiquetasPromesa
    if (etiquetasBusqueda.length) await ref.update({ etiquetasBusqueda }).catch(() => {})
    // Vendedor nuevo (primer producto) que llegó por una campaña.
    if (esPrimerProducto && body.campana) await sumarCampana(body.campana, { vendedores: 1 })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/productos', err)
    return NextResponse.json({ error: 'No se pudo crear el producto.' }, { status: 500 })
  }
}
