import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET público — zonas que algún usuario escribió a mano al elegir
// "Otra zona" (porque no estaba en la lista curada). Se guardan una
// sola vez y de ahí en más aparecen en el selector para cualquiera.
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('zonas_personalizadas').orderBy('label').get()
    const zonas = snap.docs.map((d) => (d.data() as any).label as string)
    return NextResponse.json({ zonas })
  } catch (err) {
    console.error('GET /api/zonas-personalizadas', err)
    return NextResponse.json({ zonas: [] })
  }
}
