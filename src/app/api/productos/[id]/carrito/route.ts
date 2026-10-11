import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sumarEstadisticaUsuario } from '@/lib/estadisticasUsuario'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama cuando alguien agrega el
// producto al carrito. Solo suma +1 en las estadísticas del vendedor
// (/mis-estadisticas); no guarda quién fue.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doc = await getDb().collection('productos').doc(params.id).get()
    if (doc.exists) await sumarEstadisticaUsuario(doc.get('vendedorId'), 'p', params.id, 'carrito')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
