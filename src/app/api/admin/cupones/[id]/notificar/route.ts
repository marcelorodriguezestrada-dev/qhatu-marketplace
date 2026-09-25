import { NextRequest, NextResponse } from 'next/server'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { describirCupon, type Cupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

// POST { destino: 'todos' | 'seleccion', uids?: string[], mensaje?: string }
// Avisa del cupón en la campanita (🔔) de los usuarios: a todos los
// registrados, o solo a los que el admin eligió. El mensaje es editable;
// si viene vacío armamos uno con el código y el beneficio.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  try {
    const body = await req.json()
    const db = getDb()
    const doc = await db.collection('cupones').doc(params.id).get()
    if (!doc.exists) return NextResponse.json({ error: 'Ese cupón ya no existe.' }, { status: 404 })
    const cupon = { id: doc.id, ...doc.data() } as Cupon

    let uids: string[] = []
    if (body.destino === 'todos') {
      // listUsers pagina de a 1000 — encadenamos por si la base crece.
      let pageToken: string | undefined
      do {
        const pagina = await getAuthAdmin().listUsers(1000, pageToken)
        uids.push(...pagina.users.filter((u) => !u.disabled).map((u) => u.uid))
        pageToken = pagina.pageToken
      } while (pageToken)
    } else {
      uids = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => typeof u === 'string' && u) : []
    }
    uids = Array.from(new Set(uids))
    if (uids.length === 0) return NextResponse.json({ error: 'Elegí al menos un usuario.' }, { status: 400 })

    const hasta = cupon.hasta ? ` Válido hasta el ${cupon.hasta.split('-').reverse().join('/')}.` : ''
    const mensaje =
      String(body.mensaje || '').trim().slice(0, 300) ||
      `🎁 ${cupon.campana ? `${cupon.campana}: ` : ''}${describirCupon(cupon)} con el cupón ${cupon.codigo}.${hasta} Usalo al finalizar tu compra.`

    const ahora = new Date().toISOString()
    // Batches de hasta 500 escrituras (límite de Firestore).
    for (let i = 0; i < uids.length; i += 450) {
      const batch = db.batch()
      for (const uid of uids.slice(i, i + 450)) {
        batch.set(db.collection('notificaciones').doc(), {
          uid,
          tipo: 'cupon',
          cuponId: cupon.id,
          cuponCodigo: cupon.codigo,
          mensaje,
          link: '/',
          leida: false,
          createdAt: ahora,
        })
      }
      await batch.commit()
    }
    await doc.ref.update({ ultimoAviso: { fecha: ahora, cantidad: uids.length } }).catch(() => {})

    return NextResponse.json({ enviados: uids.length })
  } catch (err) {
    console.error('POST /api/admin/cupones/[id]/notificar', err)
    return NextResponse.json({ error: 'No se pudo enviar el aviso.' }, { status: 500 })
  }
}
