import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama una vez cada vez que
// alguien entra a la página de detalle de un producto. Solo suma +1 a
// un contador; no guarda quién lo vio ni ninguna otra info personal.
// Es el dato que después alimenta "productos más vistos" en las
// métricas de /admin.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getDb().collection('productos').doc(params.id).update({
      vistas: FieldValue.increment(1),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Si falla (por ejemplo, el producto no existe más), no rompemos la
    // experiencia del comprador por esto — es solo una métrica.
    return NextResponse.json({ ok: false })
  }
}
