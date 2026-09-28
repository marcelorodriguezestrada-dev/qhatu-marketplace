import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — preguntas que le hicieron al vendedor logueado sobre sus
// productos (sin responder primero). Lo usa /vender → "Preguntas".
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const snap = await getDb().collection('preguntas').where('vendedorId', '==', usuario.uid).get()
    const preguntas = snap.docs
      .map((d) => {
        const p = d.data() as any
        return { id: d.id, productoId: p.productoId, productoNombre: p.productoNombre, autorNombre: p.autorNombre, texto: p.texto, respuesta: p.respuesta || null, createdAt: p.createdAt, respondidaEn: p.respondidaEn || null }
      })
      .sort((a, b) => Number(!!a.respuesta) - Number(!!b.respuesta) || (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 100)
    return NextResponse.json({ preguntas })
  } catch (err) {
    console.error('GET /api/preguntas', err)
    return NextResponse.json({ preguntas: [] })
  }
}
