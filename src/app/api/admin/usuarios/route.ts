import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { getAuth } from 'firebase-admin/auth'
import { getApp } from 'firebase-admin/app'

export const dynamic = 'force-dynamic'

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  return pw && pw === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const db = getDb()
    const auth = getAuth(getApp())
    const listResult = await auth.listUsers(1000)

    const [vendSnap, profSnap] = await Promise.all([
      db.collection('vendedores').get(),
      db.collection('profesionales').get(),
    ])
    const vendedores = Object.fromEntries(vendSnap.docs.map(d => [d.data().uid || d.id, d.data()]))
    const profesionales = Object.fromEntries(profSnap.docs.map(d => [d.data().uid || d.id, d.data()]))

    const usuarios = listResult.users.map(u => ({
      uid: u.uid, email: u.email || '', displayName: u.displayName || '',
      disabled: u.disabled, emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime, lastSignIn: u.metadata.lastSignInTime,
      vendedor: vendedores[u.uid] || null,
      profesional: profesionales[u.uid] || null,
    }))

    return NextResponse.json({ usuarios })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const { uid, disabled, nota } = await req.json()
    const auth = getAuth(getApp())
    const db = getDb()
    await auth.updateUser(uid, { disabled })
    if (nota) {
      await db.collection('admin_notas_usuarios').doc(uid).set({
        nota, actualizadoEn: new Date().toISOString(), estado: disabled ? 'pausado' : 'activo'
      }, { merge: true })
    }
    return NextResponse.json({ ok: true, uid, disabled })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const { uid } = await req.json()
    const auth = getAuth(getApp())
    const db = getDb()
    await auth.deleteUser(uid)
    const batch = db.batch()
    const [vSnap, pSnap] = await Promise.all([
      db.collection('vendedores').where('uid', '==', uid).get(),
      db.collection('profesionales').where('uid', '==', uid).get(),
    ])
    vSnap.docs.forEach(d => batch.delete(d.ref))
    pSnap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}