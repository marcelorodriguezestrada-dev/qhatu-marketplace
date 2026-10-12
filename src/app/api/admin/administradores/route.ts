import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { esClaveMaestra, hashClave, nuevaClaveAdmin, olvidarClaveEnCache } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// Admins delegados (Admin → Usuarios → "🛡️ Hacer admin"). Solo con la
// contraseña principal: un admin delegado no puede crear ni quitar admins.
// GET → { administradores: [{ id, uid, email, nombre, activo, creadoAt, ultimoAcceso, finClave }] }
// POST { uid, email, nombre } → crea su clave personal y la devuelve UNA vez: { clave }
// DELETE ?id= → anula esa clave (deja de funcionar en menos de un minuto)
function soloDueño(req: NextRequest) {
  return esClaveMaestra(req.headers.get('x-admin-password'))
}

export async function GET(req: NextRequest) {
  if (!soloDueño(req)) return NextResponse.json({ error: 'Solo el administrador principal.' }, { status: 403 })
  const snap = await getDb().collection('administradores').get()
  const administradores = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((a) => a.activo !== false)
    .sort((a, b) => String(b.creadoAt || '').localeCompare(String(a.creadoAt || '')))
  return NextResponse.json({ administradores })
}

export async function POST(req: NextRequest) {
  if (!soloDueño(req)) return NextResponse.json({ error: 'Solo el administrador principal.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const uid = String(body.uid || '').slice(0, 128)
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200)
  if (!uid && !email) return NextResponse.json({ error: 'Falta el usuario.' }, { status: 400 })
  const db = getDb()
  // Una sola clave activa por usuario: si ya tenía, se anula la anterior.
  if (uid) {
    const previas = await db.collection('administradores').where('uid', '==', uid).get()
    for (const d of previas.docs) {
      await d.ref.update({ activo: false, anuladaAt: new Date().toISOString() })
      olvidarClaveEnCache(d.id)
    }
  }
  const clave = nuevaClaveAdmin()
  await db.collection('administradores').doc(hashClave(clave)).set({
    uid,
    email,
    nombre: String(body.nombre || '').slice(0, 120),
    activo: true,
    creadoAt: new Date().toISOString(),
    finClave: clave.slice(-4),
  })
  return NextResponse.json({ clave })
}

export async function DELETE(req: NextRequest) {
  if (!soloDueño(req)) return NextResponse.json({ error: 'Solo el administrador principal.' }, { status: 403 })
  const id = String(req.nextUrl.searchParams.get('id') || '')
  if (!/^[0-9a-f]{64}$/.test(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
  await getDb().collection('administradores').doc(id).update({ activo: false, anuladaAt: new Date().toISOString() })
  olvidarClaveEnCache(id)
  return NextResponse.json({ ok: true })
}
