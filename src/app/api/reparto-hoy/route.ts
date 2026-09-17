import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { ordenarPorCercania, calcularFranja, DEPOSITO } from '@/lib/reparto'

export const dynamic = 'force-dynamic'

// Pensado para el repartidor, que no tiene (ni necesita) la contraseña
// completa de /admin: este link se comparte con la clave puesta en la
// URL, y con eso alcanza para ver la ruta del día — sin login, sin
// contraseña que tipear a mano en el celular.
export async function GET(req: NextRequest) {
  const clave = req.nextUrl.searchParams.get('clave')
  if (!clave || clave !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Link inválido o vencido. Pedile al admin que te pase el link de nuevo.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const snap = await db.collection('pedidos').where('metodoEntrega', '==', 'envio').where('estado', '==', 'pagado').get()
    const listos = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

    const porFranja = (franja: '08:00' | '14:00') =>
      ordenarPorCercania(
        listos.filter((p) => calcularFranja(new Date(p.pagadoAt || p.createdAt)) === franja),
        DEPOSITO
      )

    return NextResponse.json({
      salida8: porFranja('08:00'),
      salida14: porFranja('14:00'),
    })
  } catch (err) {
    console.error('GET /api/reparto-hoy', err)
    return NextResponse.json({ error: 'No se pudo cargar el reparto.' }, { status: 500 })
  }
}
