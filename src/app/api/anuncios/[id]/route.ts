import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { ejecutarMacheo } from '@/lib/macheoAnuncios'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET — público, pero solo si está aprobado (o si sos admin). Suma
// una vista cada vez que alguien lo abre.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ref = getDb().collection('anuncios').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    const data = doc.data()!
    if (data.estado !== 'aprobado' && !esAdmin(req)) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    }
    ref.update({ vistas: FieldValue.increment(1) }).catch(() => {})
    sumarMetricaDiaria('vistasAnuncios').catch(() => {})
    return NextResponse.json({ id: doc.id, ...data })
  } catch (err) {
    console.error('GET /api/anuncios/[id]', err)
    return NextResponse.json({ error: 'No se pudo cargar el anuncio.' }, { status: 500 })
  }
}

// PATCH — solo admin: aprobar, rechazar, o editar campos.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const { estado, titulo, descripcion, tipo, precio, notaAdmin } = body
    const cambios: Record<string, unknown> = {}
    if (estado !== undefined) cambios.estado = estado
    if (titulo !== undefined) cambios.titulo = titulo
    if (descripcion !== undefined) cambios.descripcion = descripcion
    if (tipo !== undefined) cambios.tipo = tipo
    if (precio !== undefined) cambios.precio = precio ? Number(precio) : null
    if (notaAdmin !== undefined) cambios.notaAdmin = notaAdmin
    // Invitación por WhatsApp desde /admin: cuándo y cuántas veces.
    if (body.registrarInvitacion) {
      cambios.invitadoEn = new Date().toISOString()
      cambios.invitaciones = FieldValue.increment(1)
    }

    await getDb().collection('anuncios').doc(params.id).update(cambios)

    // El macheo con profesionales solo se dispara EXACTO en el momento
    // en que se aprueba — nunca antes (no tiene sentido avisar de algo
    // que todavía no se sabe si se va a publicar) y no se repite en
    // ediciones posteriores que no cambien el estado.
    //
    // Ojo: lo esperamos con await a propósito, no lo lanzamos "en
    // segundo plano" — en Vercel, una función serverless puede cortarse
    // apenas se manda la respuesta, así que si no lo esperamos acá
    // corremos el riesgo de que el macheo quede a mitad de camino
    // (algunos profesionales notificados, otros no) sin aviso de error
    // para nadie.
    if (estado === 'aprobado') {
      try {
        await ejecutarMacheo(params.id)
      } catch (err) {
        console.error('Error en el macheo automático:', err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/anuncios/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el anuncio.' }, { status: 500 })
  }
}

// DELETE — solo admin.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    await getDb().collection('anuncios').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/anuncios/[id]', err)
    return NextResponse.json({ error: 'No se pudo borrar el anuncio.' }, { status: 500 })
  }
}
