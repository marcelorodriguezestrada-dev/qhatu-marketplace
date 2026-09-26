import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET ?desde=<ISO> — solo admin. Los pedidos creados o modificados
// después de `desde` (por updatedAt). Lo usa la alarma de /admin cada
// 20 s: como trae solo lo que cambió, cuesta ~1 lectura por consulta en
// vez de leer todos los pedidos cada vez (cuidando el plan gratis).
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const desde = req.nextUrl.searchParams.get('desde') || new Date(Date.now() - 60_000).toISOString()
    const snap = await getDb().collection('pedidos').where('updatedAt', '>', desde).orderBy('updatedAt', 'asc').limit(50).get()
    const pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ pedidos, ahora: new Date().toISOString() })
  } catch (err) {
    console.error('GET /api/pedidos/novedades', err)
    return NextResponse.json({ error: 'No se pudieron consultar los pedidos.' }, { status: 500 })
  }
}
