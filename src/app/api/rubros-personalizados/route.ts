import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET público — categorías que algún usuario escribió a mano al elegir
// "Otro" en el formulario de publicar servicio. Se guardan una sola vez
// (por id normalizado) y de ahí en más aparecen en el selector para
// cualquiera, en vez de que cada uno tenga que reescribirlas.
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('rubros_personalizados').orderBy('label').get()
    const rubros = snap.docs.map((d) => ({ id: d.id, label: (d.data() as any).label }))
    return NextResponse.json({ rubros })
  } catch (err) {
    console.error('GET /api/rubros-personalizados', err)
    return NextResponse.json({ rubros: [] })
  }
}
