import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { describirCupon, hoyBolivia, cuponVencido, textoVencimiento, type Cupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

// GET — cupones que el usuario logueado puede usar ahora, para mostrarlos
// en el checkout como botones ("tocá y se aplica"):
//  - los marcados como banner (destacados), que son públicos, y
//  - los que el admin le avisó a ESTE usuario por la campanita.
// Solo vigentes (activos, en fecha, con usos) y sin los de "una vez por
// cliente" que ya usó. Los códigos secretos que nadie recibió no salen.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ cupones: [] })
  try {
    const db = getDb()
    const [destacados, avisos] = await Promise.all([
      db.collection('cupones').where('destacado', '==', true).get(),
      db.collection('notificaciones').where('uid', '==', usuario.uid).where('tipo', '==', 'cupon').get(),
    ])
    const idsAvisados = Array.from(new Set(avisos.docs.map((d) => d.data().cuponId).filter(Boolean))) as string[]
    const idsDestacados = new Set(destacados.docs.map((d) => d.id))
    const avisadosDocs = await Promise.all(
      idsAvisados.filter((id) => !idsDestacados.has(id)).map((id) => db.collection('cupones').doc(id).get())
    )

    const hoy = hoyBolivia()
    const todos = [...destacados.docs, ...avisadosDocs.filter((d) => d.exists)]
      .map((d) => ({ id: d.id, ...d.data() }) as Cupon)
      .filter((c) => c.activo && (!c.desde || hoy >= c.desde) && !cuponVencido(c) && !(c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos))

    const usados = await Promise.all(
      todos.map(async (c) =>
        c.unaVezPorUsuario
          ? !(await db.collection('cupones').doc(c.id).collection('usos').where('uid', '==', usuario.uid).limit(1).get()).empty
          : false
      )
    )

    const cupones = todos
      .filter((_, i) => !usados[i])
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((c) => ({ codigo: c.codigo, campana: c.campana || '', tipo: c.tipo, descripcion: describirCupon(c), vence: textoVencimiento(c) }))
    return NextResponse.json({ cupones })
  } catch (err) {
    console.error('GET /api/cupones/disponibles', err)
    return NextResponse.json({ cupones: [] })
  }
}
