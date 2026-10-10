import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { buscarCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { fasesLanzamiento } from '@/lib/lanzamiento'
import { leerConfigLanzamiento } from '@/lib/lanzamientoServer'
import { publicacionesCompartidas, validarToken } from '@/lib/calendarioCompartido'

export const dynamic = 'force-dynamic'

// Calendario compartido (público con el link): GET lo muestra; PATCH
// { id, estado } marca una publicación, si el link tiene ese permiso.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await validarToken(params.token)
  if (!c) return NextResponse.json({ error: 'Este link ya no es válido. Pedile uno nuevo a quien te lo compartió.' }, { status: 404 })
  await cargarCiudadesServidor().catch(() => null)
  const config = await leerConfigLanzamiento()
  return NextResponse.json({
    permiso: c.permiso,
    lanzamiento: { fecha: config.fecha, ciudad: buscarCiudad(config.ciudad).nombre, fases: fasesLanzamiento(config.fecha) },
    publicaciones: await publicacionesCompartidas(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const c = await validarToken(params.token)
  if (!c) return NextResponse.json({ error: 'Este link ya no es válido.' }, { status: 404 })
  if (c.permiso !== 'marcar') return NextResponse.json({ error: 'Este link es solo para ver.' }, { status: 403 })
  try {
    const body = await req.json()
    const estado = ['pendiente', 'lista', 'publicada'].includes(body.estado) ? body.estado : null
    if (!estado) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    const ref = getDb().collection('publicacionesMarketing').doc(String(body.id || ''))
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ error: 'No existe esa publicación.' }, { status: 404 })
    const ahora = new Date().toISOString()
    await ref.update({ estado, updatedAt: ahora, ...(estado === 'publicada' && doc.data()?.estado !== 'publicada' ? { publicadaAt: ahora, marcadaPorLink: true } : {}) })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/calendario/[token]', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
