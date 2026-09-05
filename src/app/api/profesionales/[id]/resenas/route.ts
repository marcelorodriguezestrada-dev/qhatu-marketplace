import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { contieneInsultos } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// POST: deja una reseña (calificación 1-5 + comentario). Requiere estar
// logueado — reusa el mismo sistema de cuentas que ya existe para
// comprar/vender productos, no hace falta un login aparte.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para dejar una reseña.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const calificacion = Number(body.calificacion)
    const comentario = (body.comentario || '').toString().slice(0, 500)
    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return NextResponse.json({ error: 'La calificación tiene que ser de 1 a 5.' }, { status: 400 })
    }

    // Filtro de insultos — si la IA detecta lenguaje ofensivo, se
    // bloquea directo, no llega a publicarse. Si Groq no está
    // configurado o falla, dejamos pasar la reseña (nunca bloqueamos
    // por un problema técnico ajeno al usuario).
    if (comentario && (await contieneInsultos(comentario))) {
      return NextResponse.json(
        { error: 'Tu comentario parece incluir lenguaje ofensivo. Reformulalo y volvé a intentar.' },
        { status: 400 }
      )
    }

    const db = getDb()
    const profesionalRef = db.collection('profesionales').doc(params.id)
    const resenasRef = profesionalRef.collection('resenas')

    await resenasRef.add({
      autorUid: usuario.uid,
      autorEmail: usuario.email,
      calificacion,
      comentario,
      createdAt: new Date().toISOString(),
    })

    // Recalculamos el promedio leyendo todas las reseñas. Para un
    // directorio chico/mediano esto es simple y suficientemente rápido;
    // si en algún momento hay miles de reseñas por profesional, conviene
    // pasar a un contador incremental en vez de recalcular todo cada vez.
    const todas = await resenasRef.get()
    const calificaciones = todas.docs.map((d) => d.data().calificacion || 0)
    const promedio = calificaciones.reduce((s, c) => s + c, 0) / calificaciones.length

    await profesionalRef.update({
      ratingPromedio: Math.round(promedio * 10) / 10,
      cantidadResenas: calificaciones.length,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/profesionales/[id]/resenas', err)
    return NextResponse.json({ error: 'No se pudo guardar la reseña.' }, { status: 500 })
  }
}
