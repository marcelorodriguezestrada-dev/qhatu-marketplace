import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET público — el checkout lo usa para saber a qué QR/CBU pagarle a
// este vendedor en particular. Si el vendedor todavía no configuró su
// cobro, devolvemos "configurado: false" y el checkout cae al QR
// genérico de la plataforma como respaldo.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const doc = await db.collection('vendedores').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ configurado: false })
    }
    const data = doc.data() as any
    if (!data.qrImageUrl && !data.cbu) {
      return NextResponse.json({ configurado: false })
    }
    return NextResponse.json({
      configurado: true,
      qrImageUrl: data.qrImageUrl || '',
      cbu: data.cbu || '',
      nombreNegocio: data.nombreNegocio || '',
    })
  } catch (err) {
    console.error('GET /api/vendedores/[id]', err)
    return NextResponse.json({ configurado: false })
  }
}

// PATCH: permite al admin actualizar datos del perfil de cobro/perfil público.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  const esAdmin = !!password && password === process.env.ADMIN_PASSWORD
  if (!esAdmin) {
    return NextResponse.json({ error: 'Necesitás ser admin.' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const {
      nombreNegocio,
      qrImageUrl,
      cbu,
      direccion,
      zona,
      horarios,
      tipoVentas,
      tiendaAprobada,
      verificado,
      rating,
      logoUrl,
      followers,
    } = body
    const db = getDb()
    const cambios: Record<string, unknown> = {}
    if (nombreNegocio !== undefined) cambios.nombreNegocio = nombreNegocio
    if (qrImageUrl !== undefined) cambios.qrImageUrl = qrImageUrl
    if (cbu !== undefined) cambios.cbu = cbu
    if (direccion !== undefined) cambios.direccion = direccion
    if (zona !== undefined) cambios.zona = zona
    if (horarios !== undefined) cambios.horarios = horarios
    if (tipoVentas !== undefined) cambios.tipoVentas = tipoVentas
    if (tiendaAprobada !== undefined) cambios.tiendaAprobada = tiendaAprobada
    if (verificado !== undefined) cambios.verificado = verificado
    if (rating !== undefined) cambios.rating = rating
    if (logoUrl !== undefined) cambios.logoUrl = logoUrl
    if (followers !== undefined) cambios.followers = followers
    cambios.updatedAt = new Date().toISOString()
    await db.collection('vendedores').doc(params.id).set(cambios, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/vendedores/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el vendedor.' }, { status: 500 })
  }
}

// GET propio con detalle completo para precargar el formulario en
// /vender — el mismo endpoint de arriba ya alcanza para eso en
// realidad (es público), así que no hace falta una ruta separada.
