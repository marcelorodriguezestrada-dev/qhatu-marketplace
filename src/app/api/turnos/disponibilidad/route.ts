import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET ?profesionalId=X — público. A propósito devuelve SOLO fecha+hora
// ocupadas, nunca el nombre ni el contacto de quien reservó. Los datos
// completos del turno solo los ve el propio profesional en
// GET /api/turnos (protegido).
export async function GET(req: NextRequest) {
  const profesionalId = req.nextUrl.searchParams.get('profesionalId')
  if (!profesionalId) {
    return NextResponse.json({ error: 'Falta profesionalId.' }, { status: 400 })
  }
  try {
    const db = getDb()
    const snap = await db
      .collection('turnos')
      .where('profesionalId', '==', profesionalId)
      .select('fecha', 'hora')
      .get()
    const ocupados = snap.docs.map((doc) => {
      const d = doc.data()
      return `${d.fecha}|${d.hora}`
    })
    return NextResponse.json({ ocupados })
  } catch (err) {
    console.error('GET /api/turnos/disponibilidad', err)
    return NextResponse.json({ error: 'No se pudo cargar la disponibilidad.' }, { status: 500 })
  }
}
