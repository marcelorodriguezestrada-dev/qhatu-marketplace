import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest, getAuthAdmin } from '@/lib/firebaseAdmin'
import { validarWhatsappBoliviano, numeroLocalABolivia } from '@/lib/validarWhatsapp'

export const dynamic = 'force-dynamic'

// "Mi cuenta": nombre y WhatsApp de la persona logueada. El email se
// cambia desde el navegador (Firebase manda un link al correo nuevo para
// confirmarlo) — ver src/components/MiCuenta.tsx.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const [registro, doc] = await Promise.all([getAuthAdmin().getUser(usuario.uid), getDb().collection('usuarios').doc(usuario.uid).get()])
    const w = String(doc.data()?.whatsapp || '')
    return NextResponse.json({
      email: registro.email || null,
      nombre: registro.displayName || doc.data()?.nombre || '',
      whatsapp: w.startsWith('591') ? w.slice(3) : w,
    })
  } catch (err) {
    console.error('GET /api/usuarios/datos', err)
    return NextResponse.json({ error: 'No se pudieron cargar tus datos.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const body = await req.json()
    const nombre = String(body.nombre || '').trim().slice(0, 80)
    const w = String(body.whatsapp || '').trim()
    let whatsapp = ''
    if (w) {
      const v = validarWhatsappBoliviano(w)
      if (!v.valido) return NextResponse.json({ error: v.motivo }, { status: 400 })
      whatsapp = numeroLocalABolivia(w)
    }
    await getAuthAdmin().updateUser(usuario.uid, { displayName: nombre || null })
    await getDb().collection('usuarios').doc(usuario.uid).set({ nombre, whatsapp, updatedAt: new Date().toISOString() }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/usuarios/datos', err)
    return NextResponse.json({ error: 'No se pudieron guardar tus datos.' }, { status: 500 })
  }
}
