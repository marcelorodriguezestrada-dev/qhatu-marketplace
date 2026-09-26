import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { leerConfigRecuperacion } from '@/lib/recuperacionServer'

export const dynamic = 'force-dynamic'

// POST { productoId, tipo: 'visto' | 'carrito', nombre } — registra que
// un usuario logueado se interesó en un producto, para el aviso
// "Estabas mirando esto" (ver src/lib/recuperacion.ts). No escribe nada
// si la recuperación está apagada. El navegador ya filtra: "visto" solo
// llega desde la 2ª vista del mismo producto.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ ok: false })
  try {
    const config = await leerConfigRecuperacion()
    if (!config.activo) return NextResponse.json({ ok: false, apagado: true })
    const body = await req.json()
    const productoId = String(body?.productoId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)
    const tipo = body?.tipo === 'carrito' ? 'carrito' : 'visto'
    if (!productoId) return NextResponse.json({ ok: false })

    const ref = getDb().collection('intereses').doc(`${usuario.uid}_${productoId}`)
    const previo = await ref.get()
    const p = previo.data()
    const ahora = new Date().toISOString()
    // Si ya se le avisó hace menos de 14 días por este producto, no se
    // vuelve a "armar" el aviso (no insistir con lo mismo).
    const avisadoReciente = p?.avisadoEn && Date.now() - Date.parse(p.avisadoEn) < 14 * 86400_000
    await ref.set(
      {
        uid: usuario.uid,
        email: usuario.email,
        productoId,
        nombre: String(body?.nombre || p?.nombre || '').slice(0, 120),
        // "carrito" pesa más que "visto" y no se pisa.
        tipo: p?.tipo === 'carrito' ? 'carrito' : tipo,
        vistas: FieldValue.increment(tipo === 'visto' ? 1 : 0),
        ultimaVez: ahora,
        primeraVez: p?.primeraVez || ahora,
        ...(avisadoReciente ? {} : { avisadoEn: null, descartado: null }),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/interes', err)
    return NextResponse.json({ ok: false })
  }
}
