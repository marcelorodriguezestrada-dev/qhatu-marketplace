import { NextRequest, NextResponse } from 'next/server'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { ciudadDe } from '@/data/ciudades'
import { sanearStock } from '@/lib/stock'
import { sanearFotosAdicionales } from '@/lib/planPremium'
import { etiquetasParaProducto } from '@/lib/etiquetasProducto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Admin → Productos → Edición rápida → "➕ Agregar productos": crea
// varios productos de una para un vendedor, sin entrar a su cuenta.
// Quedan a su nombre (heredan nombre/logo/ciudad de su tienda) y
// marcados "cargado por admin", igual que si los cargara él.
// POST { vendedorId, productos: [{ nombre, rubro, publico, precio, precioOriginal?, stock?, talles?, colores?, imagenUrl?, thumbUrl? }] }
const lista = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60) : [])
const imgOk = (u: unknown) => (typeof u === 'string' && /^https:\/\//i.test(u) && u.length <= 500 ? u : '')

export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const vendedorId = typeof body.vendedorId === 'string' ? body.vendedorId : ''
  const entradas: any[] = Array.isArray(body.productos) ? body.productos.slice(0, 300) : []
  if (!vendedorId) return NextResponse.json({ error: 'Elegí el vendedor de los productos nuevos.' }, { status: 400 })
  if (!entradas.length) return NextResponse.json({ error: 'No hay productos para agregar.' }, { status: 400 })

  const db = getDb()
  const vd = ((await db.collection('vendedores').doc(vendedorId).get()).data() || {}) as any
  let email = vd.email || ''
  if (!email) {
    try { email = (await getAuthAdmin().getUser(vendedorId)).email || '' } catch {
      return NextResponse.json({ error: 'Ese vendedor no existe.' }, { status: 400 })
    }
  }

  const ahora = new Date().toISOString()
  const errores: { indice: number; error: string }[] = []
  const creados: { indice: number; id: string }[] = []
  const lote = db.batch()
  const paraEtiquetas: { ref: FirebaseFirestore.DocumentReference; datos: any }[] = []
  entradas.forEach((e, indice) => {
    const nombre = String(e?.nombre || '').trim().slice(0, 120)
    const precio = Math.round(Number(e?.precio) * 100) / 100
    if (nombre.length < 2) return errores.push({ indice, error: 'Falta el nombre' })
    if (!e?.rubro) return errores.push({ indice, error: 'Falta la categoría' })
    if (!(precio > 0)) return errores.push({ indice, error: 'Falta el precio' })
    const antes = Number(e.precioOriginal)
    const ref = db.collection('productos').doc()
    lote.set(ref, {
      nombre,
      rubro: String(e.rubro),
      publico: ['mujer', 'hombre', 'ninos', 'unisex'].includes(e.publico) ? e.publico : 'unisex',
      precio,
      precioOriginal: antes > precio ? Math.round(antes * 100) / 100 : null,
      icono: 'shoe',
      imagenUrl: imgOk(e.imagenUrl),
      imagenViewerUrl: imgOk(e.imagenViewerUrl),
      thumbUrl: imgOk(e.thumbUrl) || imgOk(e.imagenUrl),
      descripcionCorta: String(e.descripcionCorta || '').slice(0, 300),
      descripcionLarga: '',
      talles: lista(e.talles),
      colores: lista(e.colores),
      materiales: '',
      compraMinima: 1,
      stock: sanearStock(e.stock),
      // El admin puede cargar fotos extra (importación desde carpetas).
      fotosAdicionales: sanearFotosAdicionales(e.fotosAdicionales),
      vendedorId,
      vendedor: email,
      cargadoPorAdmin: true,
      // Para reconocerlo al reimportar la misma carpeta/planilla.
      ...(typeof e.claveImportacion === 'string' && e.claveImportacion ? { claveImportacion: e.claveImportacion.slice(0, 120) } : {}),
      tiendaNombre: vd.nombreNegocio || '',
      tiendaLogoUrl: vd.logoUrl || '',
      ciudad: ciudadDe(vd),
      enviaATodoBolivia: !!vd.tiposVenta?.haceEnvios && vd.envioPropio?.alcance === 'bolivia',
      plan: 'basico',
      estado: 'activo',
      moderacionIA: null,
      createdAt: ahora,
      updatedAt: ahora,
    })
    creados.push({ indice, id: ref.id })
    paraEtiquetas.push({ ref, datos: { nombre, rubro: String(e.rubro), publico: e.publico, colores: lista(e.colores) } })
  })
  if (creados.length) {
    try {
      await lote.commit()
    } catch (err) {
      console.error('POST /api/admin/productos/nuevos', err)
      return NextResponse.json({ error: 'No se pudieron guardar los productos. Probá de nuevo.' }, { status: 500 })
    }
  }
  // Palabras de búsqueda con IA para los primeros (en paralelo; cada una
  // corta a los 6 s). Los que queden sin, se completan con "Generar para
  // los que faltan" en Admin → Productos.
  await Promise.allSettled(
    paraEtiquetas.slice(0, 15).map(async ({ ref, datos }) => {
      const etiquetasBusqueda = await etiquetasParaProducto(datos)
      if (etiquetasBusqueda.length) await ref.update({ etiquetasBusqueda })
    })
  )
  return NextResponse.json({ ok: true, creados, errores })
}
