import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { validarWhatsappPorPais, numeroConCodigoPais } from '@/lib/validarWhatsapp'
import { buscarPais, PAIS_FALLBACK_ID } from '@/data/paises'

export const dynamic = 'force-dynamic'

// POST: el vendedor logueado carga o actualiza su propio perfil de
// tienda (cobro QR/CBU, dirección, horarios, tipos de venta, logo). Es
// un "upsert" — un solo documento por vendedor, con su uid como id, en
// la colección "vendedores".
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { qrImageUrl, cbu, nombreNegocio, direccion, lat, lng, horarios, tiposVenta, logoUrl, whatsapp, whatsappPais } = body
    // El whatsapp es opcional (no todos quieren que les escriban antes
    // de comprar), pero si lo cargan, lo validamos según el país
    // elegido y lo guardamos con su código de país adelante (ver
    // src/data/paises.ts — hoy solo Bolivia, pero queda listo para más).
    const paisId = whatsappPais || PAIS_FALLBACK_ID
    let whatsappCompleto = ''
    if (whatsapp) {
      const validacion = validarWhatsappPorPais(whatsapp, paisId)
      if (!validacion.valido) {
        return NextResponse.json({ error: validacion.motivo }, { status: 400 })
      }
      whatsappCompleto = numeroConCodigoPais(whatsapp, buscarPais(paisId).codigo)
    }
    const db = getDb()
    await db.collection('vendedores').doc(usuario.uid).set(
      {
        qrImageUrl: qrImageUrl || '',
        cbu: cbu || '',
        nombreNegocio: nombreNegocio || '',
        whatsapp: whatsappCompleto,
        whatsappPais: whatsapp ? paisId : '',
        direccion: direccion || '',
        lat: lat != null ? Number(lat) : null,
        lng: lng != null ? Number(lng) : null,
        horarios: horarios || '',
        tiposVenta: tiposVenta && typeof tiposVenta === 'object' ? tiposVenta : {},
        logoUrl: logoUrl || '',
        email: usuario.email,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )

    // Si el vendedor ya tenía productos publicados, les actualizamos el
    // nombre/logo de tienda para que se vean consistentes con el
    // catálogo — sin esto, un producto viejo se quedaría mostrando el
    // nombre de tienda desactualizado (o el email, si todavía no tenía
    // tienda configurada cuando lo publicó).
    const productosDelVendedor = await db.collection('productos').where('vendedorId', '==', usuario.uid).get()
    if (!productosDelVendedor.empty) {
      const batch = db.batch()
      productosDelVendedor.docs.forEach((doc) => {
        batch.update(doc.ref, { tiendaNombre: nombreNegocio || '', tiendaLogoUrl: logoUrl || '' })
      })
      await batch.commit()
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/vendedores', err)
    return NextResponse.json({ error: 'No se pudo guardar tu perfil de tienda.' }, { status: 500 })
  }
}
