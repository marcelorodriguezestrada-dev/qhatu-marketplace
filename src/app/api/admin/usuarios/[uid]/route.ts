import { NextRequest, NextResponse } from 'next/server'
import { getAuthAdmin } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// PATCH { pausado: boolean } — solo admin. Pausar bloquea el login del
// usuario en Firebase Auth (no puede volver a entrar hasta que se lo
// reactive); NO borra ni oculta sus productos o perfiles profesionales,
// que siguen visibles en el catálogo tal cual estaban.
export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const { pausado } = await req.json()
    await getAuthAdmin().updateUser(params.uid, { disabled: !!pausado })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/admin/usuarios/[uid]', err)
    if (err?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Ese usuario ya no existe.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo actualizar el usuario.' }, { status: 500 })
  }
}

// DELETE: solo admin — borra la cuenta de Firebase Auth. Ojo: esto NO
// borra en cascada sus productos ni perfiles profesionales (quedan
// huérfanos, con un vendedorId/solicitanteUid que ya no existe); si
// también querés sacarlos del catálogo, hacelo aparte desde las
// pestañas de Productos/Servicios antes o después de borrar la cuenta.
export async function DELETE(req: NextRequest, { params }: { params: { uid: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    await getAuthAdmin().deleteUser(params.uid)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/admin/usuarios/[uid]', err)
    if (err?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Ese usuario ya no existe.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo eliminar el usuario.' }, { status: 500 })
  }
}
