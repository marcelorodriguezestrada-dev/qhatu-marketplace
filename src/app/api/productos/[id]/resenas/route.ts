import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { contieneInsultos } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// Reseñas de productos. Solo puede reseñar quien COMPRÓ el producto y lo
// RECIBIÓ (un pedido suyo en estado "entregado" que lo incluya): así las
// estrellas son de compradores reales. Una reseña por persona y producto
// (el id del documento es su uid; si vuelve a opinar, se actualiza).
// En el producto se guardan ratingPromedio y cantidadResenas para
// mostrar las estrellas en la grilla sin leer las reseñas.

// "Vania Martínez" → "Vania M."
function nombreCorto(nombre: string | null | undefined): string {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'Comprador'
  return partes.length > 1 ? `${partes[0]} ${partes[1][0].toUpperCase()}.` : partes[0]
}

// Pedido entregado de este usuario que incluya el producto (o null).
async function compraEntregada(email: string | null, productoId: string) {
  if (!email) return null
  const snap = await getDb().collection('pedidos').where('comprador', '==', email).get()
  const doc = snap.docs.find((d) => {
    const p = d.data()
    return p.estado === 'entregado' && Array.isArray(p.items) && p.items.some((it: any) => String(it?.id) === productoId)
  })
  return doc ? { id: doc.id, ...doc.data() } as Record<string, any> : null
}

// GET — reseñas públicas del producto (más nuevas primero). Con sesión
// iniciada, también dice si esa persona puede reseñar y su reseña actual.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const snap = await db.collection('productos').doc(params.id).collection('resenas').get()
    const resenas = snap.docs
      .map((d) => {
        const r = d.data()
        return { id: d.id, autorNombre: r.autorNombre, calificacion: r.calificacion, comentario: r.comentario, detalle: r.detalle || '', createdAt: r.createdAt }
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    let puedeResenar = false
    let miResena = null
    const usuario = await getUsuarioDesdeRequest(req)
    if (usuario) {
      miResena = resenas.find((r) => r.id === usuario.uid) || null
      puedeResenar = !!(await compraEntregada(usuario.email, params.id))
    }
    return NextResponse.json({ resenas, puedeResenar, miResena })
  } catch (err) {
    console.error('GET /api/productos/[id]/resenas', err)
    return NextResponse.json({ resenas: [], puedeResenar: false, miResena: null })
  }
}

// POST { calificacion: 1-5, comentario } — requiere haber recibido el producto.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Iniciá sesión para dejar tu reseña.' }, { status: 401 })
  try {
    const body = await req.json()
    const calificacion = Math.round(Number(body.calificacion))
    const comentario = String(body.comentario || '').trim().slice(0, 500)
    if (!(calificacion >= 1 && calificacion <= 5)) {
      return NextResponse.json({ error: 'Elegí de 1 a 5 estrellas.' }, { status: 400 })
    }

    const pedido = await compraEntregada(usuario.email, params.id)
    if (!pedido) {
      return NextResponse.json({ error: 'Podés opinar sobre este producto cuando lo hayas comprado y recibido.' }, { status: 403 })
    }

    // Mismo filtro de insultos que las reseñas de profesionales.
    if (comentario && (await contieneInsultos(comentario))) {
      return NextResponse.json({ error: 'Tu comentario parece incluir lenguaje ofensivo. Reformulalo y volvé a intentar.' }, { status: 400 })
    }

    // Talla/color que compró (ayuda a otros: "Talla 37 · Marrón").
    const item = (pedido.items || []).find((it: any) => String(it?.id) === params.id)
    const detalle = [item?.tallaElegida && `Talla ${item.tallaElegida}`, item?.colorElegida].filter(Boolean).join(' · ')

    const db = getDb()
    const productoRef = db.collection('productos').doc(params.id)
    const resenaRef = productoRef.collection('resenas').doc(usuario.uid)
    await db.runTransaction(async (tx) => {
      const [prod, previa] = await Promise.all([tx.get(productoRef), tx.get(resenaRef)])
      if (!prod.exists) throw new Error('no-existe')
      const p = prod.data()!
      const cantidad = p.cantidadResenas || 0
      const suma = typeof p.sumaCalificaciones === 'number' ? p.sumaCalificaciones : (p.ratingPromedio || 0) * cantidad
      const anterior = previa.exists ? previa.data()!.calificacion || 0 : null
      const nuevaCantidad = anterior === null ? cantidad + 1 : cantidad
      const nuevaSuma = anterior === null ? suma + calificacion : suma - anterior + calificacion
      tx.set(resenaRef, {
        autorUid: usuario.uid,
        autorEmail: usuario.email,
        autorNombre: nombreCorto(pedido.nombreComprador),
        calificacion,
        comentario,
        detalle,
        pedidoId: pedido.id,
        createdAt: previa.exists ? previa.data()!.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      tx.update(productoRef, {
        cantidadResenas: nuevaCantidad,
        sumaCalificaciones: nuevaSuma,
        ratingPromedio: nuevaCantidad > 0 ? Math.round((nuevaSuma / nuevaCantidad) * 10) / 10 : 0,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err?.message === 'no-existe') return NextResponse.json({ error: 'El producto ya no existe.' }, { status: 404 })
    console.error('POST /api/productos/[id]/resenas', err)
    return NextResponse.json({ error: 'No se pudo guardar la reseña.' }, { status: 500 })
  }
}

// DELETE ?resenaId=<uid> — solo admin (moderación).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const resenaId = req.nextUrl.searchParams.get('resenaId')
  if (!resenaId) return NextResponse.json({ error: 'Falta resenaId.' }, { status: 400 })
  try {
    const db = getDb()
    const productoRef = db.collection('productos').doc(params.id)
    const resenaRef = productoRef.collection('resenas').doc(resenaId)
    await db.runTransaction(async (tx) => {
      const [prod, resena] = await Promise.all([tx.get(productoRef), tx.get(resenaRef)])
      if (!resena.exists) return
      const p = prod.data() || {}
      const cantidad = Math.max(0, (p.cantidadResenas || 0) - 1)
      const sumaPrevia = typeof p.sumaCalificaciones === 'number' ? p.sumaCalificaciones : (p.ratingPromedio || 0) * (p.cantidadResenas || 0)
      const suma = Math.max(0, sumaPrevia - (resena.data()!.calificacion || 0))
      tx.delete(resenaRef)
      if (prod.exists) {
        tx.update(productoRef, {
          cantidadResenas: cantidad,
          sumaCalificaciones: suma,
          ratingPromedio: cantidad > 0 ? Math.round((suma / cantidad) * 10) / 10 : FieldValue.delete(),
        })
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/productos/[id]/resenas', err)
    return NextResponse.json({ error: 'No se pudo borrar la reseña.' }, { status: 500 })
  }
}
