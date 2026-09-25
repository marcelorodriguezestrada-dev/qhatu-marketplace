import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearCupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

// PATCH — { activo } para pausar/reactivar, o el cupón completo para
// editarlo (mismo saneo que al crearlo). Los usos no se tocan.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const body = await req.json()
    const db = getDb()
    const ref = db.collection('cupones').doc(params.id)
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Ese cupón ya no existe.' }, { status: 404 })

    if (Object.keys(body).length === 1 && 'activo' in body) {
      await ref.update({ activo: !!body.activo })
      return NextResponse.json({ ok: true })
    }
    const { datos, error } = sanearCupon(body)
    if (!datos) return NextResponse.json({ error }, { status: 400 })
    const mismoCodigo = await db.collection('cupones').where('codigo', '==', datos.codigo).get()
    if (mismoCodigo.docs.some((d) => d.id !== params.id)) {
      return NextResponse.json({ error: `Ya existe otro cupón con el código ${datos.codigo}.` }, { status: 400 })
    }
    await ref.update(datos)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/cupones/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el cupón.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    await getDb().collection('cupones').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/cupones/[id]', err)
    return NextResponse.json({ error: 'No se pudo borrar el cupón.' }, { status: 500 })
  }
}
