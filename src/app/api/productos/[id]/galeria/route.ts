import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { MAX_FOTOS_ADICIONALES_PREMIUM } from '@/lib/planPremium'

export const dynamic = 'force-dynamic'

// Mismo criterio que la galería de profesionales: las fotos extra son
// un beneficio Premium, y lo chequeamos del lado del servidor (no solo
// en la UI) para que sea imposible saltárselo armando el pedido a mano.
// A diferencia de los profesionales (que tienen vigencia y pago propio),
// el plan de un producto es el mismo campo `plan` que ya se usa para
// destacarlo en el listado — "premium" ahí es lo que habilita esto.
async function verificarDueñoPremium(ref: FirebaseFirestore.DocumentReference, uid: string) {
  const doc = await ref.get()
  if (!doc.exists) return { error: 'No encontrado.', status: 404 as const }
  const data = doc.data()!
  if (data.vendedorId !== uid) return { error: 'Este producto no te pertenece.', status: 403 as const }
  if (data.plan !== 'premium') {
    return { error: 'Las fotos adicionales son un beneficio Premium para este producto.', status: 403 as const }
  }
  return { data }
}

// POST { url: string } — agrega una foto a la galería del producto
// (hasta el máximo).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const ref = db.collection('productos').doc(params.id)
    const chequeo = await verificarDueñoPremium(ref, usuario.uid)
    if ('error' in chequeo) return NextResponse.json({ error: chequeo.error }, { status: chequeo.status })

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Falta la URL de la imagen.' }, { status: 400 })

    const actuales: string[] = chequeo.data.fotosAdicionales || []
    if (actuales.length >= MAX_FOTOS_ADICIONALES_PREMIUM) {
      return NextResponse.json({ error: `Máximo ${MAX_FOTOS_ADICIONALES_PREMIUM} fotos adicionales.` }, { status: 400 })
    }

    const nuevas = [...actuales, url]
    await ref.update({ fotosAdicionales: nuevas })
    return NextResponse.json({ fotosAdicionales: nuevas })
  } catch (err: any) {
    console.error('POST /api/productos/[id]/galeria', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}

// DELETE { url: string } — saca una foto puntual de la galería.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const ref = db.collection('productos').doc(params.id)
    const chequeo = await verificarDueñoPremium(ref, usuario.uid)
    if ('error' in chequeo) return NextResponse.json({ error: chequeo.error }, { status: chequeo.status })

    const { url } = await req.json()
    const actuales: string[] = chequeo.data.fotosAdicionales || []
    const nuevas = actuales.filter((f) => f !== url)
    await ref.update({ fotosAdicionales: nuevas })
    return NextResponse.json({ fotosAdicionales: nuevas })
  } catch (err: any) {
    console.error('DELETE /api/productos/[id]/galeria', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
