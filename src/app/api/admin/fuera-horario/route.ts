import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Admin → Pedidos → "🌙 Quisieron comprar fuera de horario".
// GET → { compras } (más recientes primero, con si ya vio el aviso).
// PATCH { id, contactado: true } → marca que le escribiste por WhatsApp.
const autorizado = (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const db = getDb()
    const snap = await db.collection('comprasFueraHorario').get()
    const compras = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(b.ultimoIntento).localeCompare(String(a.ultimoIntento))).slice(0, 300)
    const ids = compras.map((c) => c.notificacionId).filter(Boolean) as string[]
    const leidas = new Set<string>()
    for (let i = 0; i < ids.length; i += 100) {
      const docs = await db.getAll(...ids.slice(i, i + 100).map((id) => db.collection('notificaciones').doc(id)))
      docs.forEach((d) => { if (d.exists && d.data()?.leida) leidas.add(d.id) })
    }
    return NextResponse.json({ compras: compras.map((c) => ({ ...c, avisoLeido: leidas.has(c.notificacionId) })) })
  } catch (err) {
    console.error('GET /api/admin/fuera-horario', err)
    return NextResponse.json({ error: 'No se pudo leer la lista.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 })
  await getDb().collection('comprasFueraHorario').doc(String(b.id)).update({ contactadoAt: b.contactado ? new Date().toISOString() : null })
  return NextResponse.json({ ok: true })
}
