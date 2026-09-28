import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest, getAuthAdmin } from '@/lib/firebaseAdmin'
import { contieneInsultos } from '@/lib/moderacionIA'
import { MAX_PREGUNTA, tieneDatosDeContacto, nombreCortoPublico } from '@/lib/preguntas'

export const dynamic = 'force-dynamic'

// GET — preguntas respondidas del producto (públicas, más nuevas
// primero). Con sesión, también las mías que todavía esperan respuesta.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const snap = await getDb().collection('preguntas').where('productoId', '==', params.id).get()
    const usuario = await getUsuarioDesdeRequest(req)
    const preguntas = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p) => p.respuesta || (usuario && p.autorUid === usuario.uid))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        texto: p.texto,
        respuesta: p.respuesta || null,
        autorNombre: p.autorNombre || 'Comprador',
        createdAt: p.createdAt,
        respondidaEn: p.respondidaEn || null,
        mia: !!usuario && p.autorUid === usuario.uid,
      }))
    return NextResponse.json({ preguntas })
  } catch (err) {
    console.error('GET /api/productos/[id]/preguntas', err)
    return NextResponse.json({ preguntas: [] })
  }
}

// POST { texto } — pregunta al vendedor. Requiere sesión; le avisa al
// vendedor en la campanita.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Iniciá sesión para preguntarle al vendedor.' }, { status: 401 })
  try {
    const body = await req.json()
    const texto = String(body.texto || '').trim().replace(/\s+/g, ' ').slice(0, MAX_PREGUNTA)
    if (texto.length < 5) return NextResponse.json({ error: 'Escribí tu pregunta (al menos 5 letras).' }, { status: 400 })
    if (tieneDatosDeContacto(texto)) {
      return NextResponse.json({ error: 'Por seguridad, no compartas teléfonos, emails ni links en las preguntas.' }, { status: 400 })
    }
    if (await contieneInsultos(texto)) {
      return NextResponse.json({ error: 'Tu pregunta parece incluir lenguaje ofensivo. Reformulala y volvé a intentar.' }, { status: 400 })
    }

    const db = getDb()
    const prod = await db.collection('productos').doc(params.id).get()
    if (!prod.exists) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    const p = prod.data() as any
    if (p.vendedorId === usuario.uid) return NextResponse.json({ error: 'Es tu propio producto 🙂' }, { status: 400 })

    // Tope simple anti-spam: máximo 5 preguntas sin responder por
    // persona en el mismo producto.
    const mias = await db.collection('preguntas').where('productoId', '==', params.id).where('autorUid', '==', usuario.uid).get()
    if (mias.docs.filter((d) => !d.data().respuesta).length >= 5) {
      return NextResponse.json({ error: 'Ya tenés varias preguntas esperando respuesta en este producto.' }, { status: 429 })
    }

    let nombre: string | null = null
    try { nombre = (await getAuthAdmin().getUser(usuario.uid)).displayName || null } catch {}
    const ahora = new Date().toISOString()
    const ref = await db.collection('preguntas').add({
      productoId: params.id,
      productoNombre: p.nombre || '',
      vendedorId: p.vendedorId || null,
      autorUid: usuario.uid,
      autorEmail: usuario.email,
      autorNombre: nombreCortoPublico(nombre, usuario.email),
      texto,
      respuesta: null,
      createdAt: ahora,
    })
    if (p.vendedorId) {
      await db.collection('notificaciones').add({
        uid: p.vendedorId,
        tipo: 'pregunta_producto',
        preguntaId: ref.id,
        mensaje: `💬 Te preguntaron sobre "${p.nombre}": “${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}” — tocá para responder`,
        link: '/vender#preguntas',
        leida: false,
        createdAt: ahora,
      })
    }
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/productos/[id]/preguntas', err)
    return NextResponse.json({ error: 'No se pudo enviar la pregunta.' }, { status: 500 })
  }
}
