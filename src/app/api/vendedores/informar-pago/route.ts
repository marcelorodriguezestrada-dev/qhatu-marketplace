import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// POST — el vendedor logueado avisa "ya pagué". A propósito es el
// ÚNICO campo que puede tocar él mismo acá: `plan` y
// `planVigenciaHasta` solo los puede poner el admin al confirmar (ver
// PATCH /api/vendedores/[id]), para que nadie se autootorgue Premium.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    await getDb().collection('vendedores').doc(usuario.uid).set(
      { planEstadoPago: 'informado_pago' },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/vendedores/informar-pago', err)
    return NextResponse.json({ error: 'No se pudo avisar el pago.' }, { status: 500 })
  }
}
