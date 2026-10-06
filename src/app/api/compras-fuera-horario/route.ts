import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { mensajeApertura, proximaApertura, type ItemFueraHorario } from '@/lib/fueraHorario'

export const dynamic = 'force-dynamic'

// El checkout lo llama cuando alguien quiere pagar fuera de horario
// (20:00 a 8:00). Guarda su carrito (1 documento por persona y por
// apertura) y le programa el aviso de la campanita para las 8:00.
// POST { items, total, tienda, nombre, whatsapp, ciudad } → { avisoEn }
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const items: ItemFueraHorario[] = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map((i: any) => ({
    id: String(i.id || ''),
    nombre: String(i.nombre || '').slice(0, 120),
    precio: Number(i.precio) || 0,
    cantidad: Math.max(1, Math.floor(Number(i.cantidad) || 1)),
    ...(i.talla ? { talla: String(i.talla).slice(0, 20) } : {}),
    ...(i.color ? { color: String(i.color).slice(0, 30) } : {}),
    ...(i.imagen ? { imagen: String(i.imagen).slice(0, 500) } : {}),
  }))
  if (!items.length) return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 })
  const tienda = typeof b.tienda === 'string' && b.tienda ? b.tienda.slice(0, 80) : null
  const avisoEn = proximaApertura()
  const ahora = new Date().toISOString()
  const db = getDb()
  const ref = db.collection('comprasFueraHorario').doc(`${usuario.uid}_${avisoEn.slice(0, 10)}`)
  const link = tienda ? `/checkout?tienda=${encodeURIComponent(tienda)}` : '/checkout'
  const total = Math.max(0, Number(b.total) || items.reduce((s, i) => s + i.precio * i.cantidad, 0))
  try {
    const actual = await ref.get()
    const datos = {
      uid: usuario.uid,
      email: usuario.email || '',
      nombre: String(b.nombre || '').slice(0, 80),
      whatsapp: String(b.whatsapp || '').slice(0, 30),
      ciudad: b.ciudad === 'la-paz' ? 'la-paz' : 'potosi',
      tienda,
      items,
      total,
      ultimoIntento: ahora,
      avisoEn,
    }
    if (actual.exists) {
      const x = actual.data() as any
      await ref.update({ ...datos, intentos: (x.intentos || 1) + 1 })
      if (x.notificacionId) await db.collection('notificaciones').doc(x.notificacionId).update({ mensaje: mensajeApertura(items), link }).catch(() => {})
    } else {
      const notif = await db.collection('notificaciones').add({
        uid: usuario.uid,
        tipo: 'fuera_horario',
        mensaje: mensajeApertura(items),
        link,
        leida: false,
        createdAt: avisoEn,
        visibleDesde: avisoEn,
      })
      await ref.set({ ...datos, intentos: 1, primerIntento: ahora, notificacionId: notif.id, convertido: false, pedidoId: null, convertidoAt: null, contactadoAt: null })
    }
    return NextResponse.json({ ok: true, avisoEn })
  } catch (err) {
    console.error('POST /api/compras-fuera-horario', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
