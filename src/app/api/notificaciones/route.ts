import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { enCache, olvidarCache } from '@/lib/cacheLecturas'

export const dynamic = 'force-dynamic'

// GET — las notificaciones del usuario logueado, más recientes primero.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    // La campanita pregunta cada 2 min y en cada página: 1 minuto en
    // memoria por persona (cada consulta lee TODAS sus notificaciones).
    const docs = await enCache(`notificaciones:${usuario.uid}`, 60_000, async () =>
      (await db.collection('notificaciones').where('uid', '==', usuario.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }))
    )
    // Las programadas (ej. el aviso de "¡Ya abrimos!" de las 8:00) no se
    // muestran antes de su hora.
    const ahora = new Date().toISOString()
    const notificaciones = docs
      .filter((n: any) => !n.visibleDesde || n.visibleDesde <= ahora)
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ notificaciones })
  } catch (err) {
    console.error('GET /api/notificaciones', err)
    return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
  }
}

// PATCH { todasLeidas: true } — marca todas las del usuario como leídas
// de una vez (para el botón "Marcar todas como leídas").
export async function PATCH(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const snap = await db.collection('notificaciones').where('uid', '==', usuario.uid).where('leida', '==', false).get()
    const batch = db.batch()
    const ahora = new Date().toISOString()
    snap.docs.filter((d) => !d.data().visibleDesde || d.data().visibleDesde <= ahora).forEach((d) => batch.update(d.ref, { leida: true }))
    await batch.commit()
    olvidarCache(`notificaciones:${usuario.uid}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/notificaciones', err)
    return NextResponse.json({ error: 'No se pudieron actualizar las notificaciones.' }, { status: 500 })
  }
}
