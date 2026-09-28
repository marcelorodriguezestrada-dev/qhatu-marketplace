import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { contieneInsultos } from '@/lib/moderacionIA'
import { MAX_RESPUESTA } from '@/lib/preguntas'

export const dynamic = 'force-dynamic'

async function permiso(req: NextRequest, id: string) {
  const password = req.headers.get('x-admin-password')
  const esAdmin = !!password && password === process.env.ADMIN_PASSWORD
  const usuario = await getUsuarioDesdeRequest(req)
  const ref = getDb().collection('preguntas').doc(id)
  const doc = await ref.get()
  if (!doc.exists) return { error: NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 }) }
  const data = doc.data() as any
  if (!esAdmin && (!usuario || usuario.uid !== data.vendedorId)) {
    return { error: NextResponse.json({ error: 'Solo el vendedor puede responder esta pregunta.' }, { status: 403 }) }
  }
  return { ref, data }
}

// PATCH { respuesta } — el vendedor responde; le avisa al comprador.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await permiso(req, params.id)
  if ('error' in r) return r.error
  try {
    const body = await req.json()
    const respuesta = String(body.respuesta || '').trim().slice(0, MAX_RESPUESTA)
    if (respuesta.length < 2) return NextResponse.json({ error: 'Escribí la respuesta.' }, { status: 400 })
    if (await contieneInsultos(respuesta)) {
      return NextResponse.json({ error: 'La respuesta parece incluir lenguaje ofensivo.' }, { status: 400 })
    }
    const ahora = new Date().toISOString()
    const primera = !r.data.respuesta
    await r.ref.update({ respuesta, respondidaEn: ahora })
    if (primera && r.data.autorUid) {
      await getDb().collection('notificaciones').add({
        uid: r.data.autorUid,
        tipo: 'respuesta_pregunta',
        preguntaId: params.id,
        mensaje: `💬 El vendedor respondió tu pregunta sobre "${r.data.productoNombre}": “${respuesta.slice(0, 80)}${respuesta.length > 80 ? '…' : ''}”`,
        link: `/producto/${r.data.productoId}#preguntas`,
        leida: false,
        createdAt: ahora,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/preguntas/[id]', err)
    return NextResponse.json({ error: 'No se pudo guardar la respuesta.' }, { status: 500 })
  }
}

// DELETE — el vendedor (o el admin) borra una pregunta (spam, etc.).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await permiso(req, params.id)
  if ('error' in r) return r.error
  await r.ref.delete()
  return NextResponse.json({ ok: true })
}
