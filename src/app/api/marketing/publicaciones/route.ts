import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { METRICAS_CAMPANA } from '@/lib/campanas'
import { detallePublicacion } from '@/lib/publicacionesTienda'

export const dynamic = 'force-dynamic'

// Publicaciones de la tienda logueada (Vender → Marketing → 📊 Tus publicaciones):
// cada una es una campaña (campanas/{código}) con sus links rastreados.
// GET → { publicaciones: [{ id, red, productos, publicadaAt, visitas, pedidos, ventasBs, … }] }
// POST { campana, texto?, donde?, formato?, imagenProductoId? } → la marca como publicada (al copiar / compartir).
// POST { campana, accion: 'editar', lugar?, linkPost? } → dónde la publicó (grupo / página) y el link del post.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  const snap = await getDb().collection('campanas').where('vendedorId', '==', usuario.uid).get()
  const publicaciones = snap.docs
    .map((d) => {
      const x = d.data() as any
      const base: Record<string, any> = detallePublicacion(d.id, x)
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
  if (b.accion === 'editar') {
    const linkPost = String(b.linkPost || '').trim().slice(0, 400)
    await ref.update({
      lugar: String(b.lugar || '').trim().slice(0, 120),
      linkPost: /^https?:\/\//i.test(linkPost) ? linkPost : '',
      updatedAt: ahora,
    })
    return NextResponse.json({ ok: true })
  }
  const cambios: Record<string, any> = { estado: 'publicada', updatedAt: ahora, vecesCompartida: (doc.get('vecesCompartida') || 0) + 1 }
  if (!doc.get('publicadaAt')) cambios.publicadaAt = ahora
  if (typeof b.texto === 'string' && b.texto.trim()) cambios.texto = b.texto.slice(0, 3000)
  if (typeof b.donde === 'string' && b.donde) cambios.compartidaEn = FieldValue.arrayUnion({ donde: b.donde.slice(0, 30), at: ahora })
  if (b.formato === 'cuadrado' || b.formato === 'vertical') cambios.formato = b.formato
  if (typeof b.imagenProductoId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(b.imagenProductoId)) cambios.imagenProductoId = b.imagenProductoId
  await ref.update(cambios)
  return NextResponse.json({ ok: true })
}

