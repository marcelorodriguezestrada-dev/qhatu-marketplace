import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { METRICAS_CAMPANA } from '@/lib/campanas'

export const dynamic = 'force-dynamic'

// Publicaciones de la tienda logueada (Vender → Marketing → 📊 Tus publicaciones):
// cada una es una campaña (campanas/{código}) con sus links rastreados.
// GET → { publicaciones: [{ id, red, productos, publicadaAt, visitas, pedidos, ventasBs, … }] }
// POST { campana, red?, texto? } → la marca como publicada (al copiar / compartir).
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  const snap = await getDb().collection('campanas').where('vendedorId', '==', usuario.uid).get()
  const publicaciones = snap.docs
    .map((d) => {
      const x = d.data() as any
      const base: Record<string, any> = { id: d.id, red: x.canal, productos: x.productos || [], estado: x.estado || 'borrador', publicadaAt: x.publicadaAt || null, createdAt: x.createdAt, vecesCompartida: x.vecesCompartida || 0 }
      for (const m of METRICAS_CAMPANA) base[m] = x[m] || 0
      return base
    })
    .filter((p) => p.estado === 'publicada')
    .sort((a, b) => String(b.publicadaAt || b.createdAt).localeCompare(String(a.publicadaAt || a.createdAt)))
  return NextResponse.json({ publicaciones })
}

export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = typeof b.campana === 'string' && /^[a-z0-9-]{3,40}$/.test(b.campana) ? b.campana : ''
  if (!id) return NextResponse.json({ error: 'Falta la publicación.' }, { status: 400 })
  const ref = getDb().collection('campanas').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.get('vendedorId') !== usuario.uid) return NextResponse.json({ error: 'No encontrada.' }, { status: 404 })
  const ahora = new Date().toISOString()
  const cambios: Record<string, any> = { estado: 'publicada', updatedAt: ahora, vecesCompartida: (doc.get('vecesCompartida') || 0) + 1 }
  if (!doc.get('publicadaAt')) cambios.publicadaAt = ahora
  if (typeof b.texto === 'string' && b.texto.trim()) cambios.texto = b.texto.slice(0, 3000)
  if (typeof b.donde === 'string') cambios.compartidaEn = b.donde.slice(0, 30)
  await ref.update(cambios)
  return NextResponse.json({ ok: true })
}
