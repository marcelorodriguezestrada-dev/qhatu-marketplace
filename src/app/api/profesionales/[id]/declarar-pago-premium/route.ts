import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// POST — el profesional avisa "ya pagué" desde /mi-perfil. Esto NO activa
// Premium solo: deja planEstadoPago en 'informado_pago' para que el
// admin lo confirme desde /admin viendo su comprobante/cuenta (mismo
// criterio que ya usás para los pedidos de productos).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const ref = db.collection('profesionales').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    }

    // Solo el dueño de este perfil puede declarar su propio pago — sin
    // este chequeo, cualquier usuario logueado podría marcar como
    // "pagado" el perfil de otro con solo saber su id.
    if (doc.data()?.solicitanteUid !== usuario.uid) {
      return NextResponse.json({ error: 'Este perfil no te pertenece.' }, { status: 403 })
    }

    await ref.update({ planEstadoPago: 'informado_pago' })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('POST /api/profesionales/[id]/declarar-pago-premium', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
