import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { esPremiumVigente, calcularNuevaVigencia, PRECIO_PREMIUM_BS } from '@/lib/planPremium'

export const dynamic = 'force-dynamic'

// GET público — devuelve el perfil de tienda completo de un vendedor:
// datos de cobro (para el checkout) y datos de la tienda (para la
// pestaña "Info. Tienda" de cada producto: dirección, mapa, horarios,
// tipos de venta). "configurado" indica específicamente si YA cargó su
// cobro propio (QR o CBU) — eso es lo que usa el checkout para decidir
// si le paga a él directo o cae al QR general de la plataforma.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const doc = await db.collection('vendedores').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ configurado: false, existe: false })
    }
    const data = doc.data() as any
    return NextResponse.json({
      existe: true,
      configurado: !!(data.qrImageUrl || data.cbu),
      qrImageUrl: data.qrImageUrl || '',
      cbu: data.cbu || '',
      nombreNegocio: data.nombreNegocio || '',
      whatsapp: data.whatsapp || '',
      whatsappPais: data.whatsappPais || '',
      direccion: data.direccion || '',
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      horarios: data.horarios || '',
      tiposVenta: data.tiposVenta || {},
      logoUrl: data.logoUrl || '',
      verificado: !!data.verificado,
      plan: data.plan === 'premium' ? 'premium' : 'basico',
      planVigenciaHasta: data.planVigenciaHasta || null,
      planEstadoPago: data.planEstadoPago || 'ninguno',
      premiumVigente: esPremiumVigente(data),
    })
  } catch (err) {
    console.error('GET /api/vendedores/[id]', err)
    return NextResponse.json({ configurado: false, existe: false })
  }
}

// PATCH: solo admin — marca (o desmarca) a un vendedor como
// "verificado". A diferencia de otras plataformas donde esto es
// automático, acá es una decisión manual tuya, para que el badge
// signifique algo real.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { verificado, plan, planVigenciaHasta, planEstadoPago } = body
    const cambios: Record<string, unknown> = {}
    if (verificado !== undefined) cambios.verificado = !!verificado
    if (plan !== undefined) cambios.plan = plan === 'premium' ? 'premium' : 'basico'
    if (planVigenciaHasta !== undefined) cambios.planVigenciaHasta = planVigenciaHasta
    if (planEstadoPago !== undefined) cambios.planEstadoPago = planEstadoPago

    // Mismo criterio que con profesionales: si se activa Premium sin
    // una vigencia explícita (por ejemplo, tildándolo a mano en vez de
    // pasar por "Confirmar pago"), igual lo activamos ya mismo — para
    // que no quede guardado "premium" pero sin efecto real.
    const ref = getDb().collection('vendedores').doc(params.id)
    if (cambios.plan === 'premium' && planVigenciaHasta === undefined) {
      const actual = (await ref.get()).data() || {}
      if (!esPremiumVigente(actual)) {
        cambios.planVigenciaHasta = calcularNuevaVigencia(actual.planVigenciaHasta)
      }
    }

    await ref.set(cambios, { merge: true })

    // Registro contable: solo cuando es un pago real confirmado
    // ("Confirmar pago recibido" manda planEstadoPago:'ninguno' +
    // una vigencia ya calculada) — no cuando se activa a mano sin pago.
    if (cambios.plan === 'premium' && planEstadoPago === 'ninguno' && planVigenciaHasta !== undefined) {
      const vendedorDoc = await ref.get()
      await getDb().collection('pagos_premium').add({
        tipo: 'vendedor',
        vendedorId: params.id,
        vendedorNombre: vendedorDoc.data()?.nombreNegocio || null,
        monto: PRECIO_PREMIUM_BS,
        vigenciaHasta: planVigenciaHasta,
        fecha: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/vendedores/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
  }
}
