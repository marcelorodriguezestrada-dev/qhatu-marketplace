import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// PATCH { estado?, notaAdmin? } — para marcar "ya le pedí más datos
// por WhatsApp" (info_solicitada), descartarlo, o dejar una nota.
// "aceptado" NO se pone acá — eso lo hace /api/profesionales al crear
// el profesional real, para que no se pueda marcar como aceptado sin
// que de verdad exista el profesional del otro lado.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const cambios: Record<string, unknown> = {}
    if (body.estado !== undefined) cambios.estado = body.estado
    if (body.notaAdmin !== undefined) cambios.notaAdmin = body.notaAdmin

    await getDb().collection('candidatosProfesional').doc(params.id).update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/candidatos-profesional/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    await getDb().collection('candidatosProfesional').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/candidatos-profesional/[id]', err)
    return NextResponse.json({ error: 'No se pudo eliminar.' }, { status: 500 })
  }
}
