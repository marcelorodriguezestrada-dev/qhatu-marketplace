import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'
import { validarHorario } from '@/data/turnos'
import { esPremiumVigente, calcularNuevaVigencia } from '@/lib/planPremium'

export const dynamic = 'force-dynamic'

// GET: perfil público de un profesional, con sus reseñas incluidas.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const ref = db.collection('profesionales').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    }
    const resenasSnap = await ref.collection('resenas').get()
    const resenas = resenasSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    // Sumamos +1 a las vistas del perfil — no esperamos a que termine
    // (fire-and-forget) para no hacer más lenta la respuesta al
    // visitante. Si falla, no rompe nada; es solo una métrica.
    ref.update({ vistas: FieldValue.increment(1) }).catch(() => {})
    sumarMetricaDiaria('vistasProfesionales').catch(() => {})

    return NextResponse.json({ id: doc.id, ...doc.data(), resenas })
  } catch (err) {
    console.error('GET /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo cargar el perfil.' }, { status: 500 })
  }
}

// PATCH: solo admin — usado para aprobar/rechazar solicitudes públicas,
// o para editar un profesional ya publicado.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { estado, nombre, rubro, especialidad, descripcion, zona, direccion, lat, lng, whatsapp, instagram, email, notaAdmin, icono, plan, planVigenciaHasta, planEstadoPago, fotosAdicionales, imagenUrl, precio, experiencia, horarioTurnos } = body
    const cambios: Record<string, unknown> = {}

    if (estado !== undefined) {
      if (!['pendiente_revision', 'info_solicitada', 'aprobado', 'rechazado'].includes(estado)) {
        return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
      }
      cambios.estado = estado
    }
    if (nombre !== undefined) cambios.nombre = nombre
    if (rubro !== undefined) cambios.rubro = rubro
    if (especialidad !== undefined) cambios.especialidad = especialidad
    if (descripcion !== undefined) cambios.descripcion = descripcion
    if (zona !== undefined) cambios.zona = zona
    if (direccion !== undefined) cambios.direccion = direccion
    if (lat !== undefined) cambios.lat = lat === '' || lat === null ? null : Number(lat)
    if (lng !== undefined) cambios.lng = lng === '' || lng === null ? null : Number(lng)
    if (whatsapp !== undefined) cambios.whatsapp = whatsapp
    if (instagram !== undefined) cambios.instagram = instagram
    if (email !== undefined) cambios.email = email
    // Nota interna del admin sobre qué le pidió al profesional y está
    // esperando (ej. "le pedí una foto mejor, quedé de escribirle el viernes").
    // No se le manda automáticamente a nadie — es solo para que quede
    // registrado en vez de perderse en la cabeza del admin.
    if (notaAdmin !== undefined) cambios.notaAdmin = notaAdmin
    if (icono !== undefined) cambios.icono = icono
    if (plan !== undefined) cambios.plan = plan === 'premium' ? 'premium' : 'basico'
    if (planVigenciaHasta !== undefined) cambios.planVigenciaHasta = planVigenciaHasta
    if (planEstadoPago !== undefined) cambios.planEstadoPago = planEstadoPago
    if (fotosAdicionales !== undefined) cambios.fotosAdicionales = fotosAdicionales
    if (imagenUrl !== undefined) cambios.imagenUrl = imagenUrl
    if (precio !== undefined) cambios.precio = precio ? Number(precio) : null
    if (experiencia !== undefined) cambios.experiencia = experiencia
    // El admin puede cargar/corregir la agenda de turnos de un
    // profesional (mismo campo que el self-service de
    // /api/profesionales/[id]/horarios, pero sin exigirle Premium —
    // es una herramienta de soporte, por si hay que arreglarle algo
    // a mano mientras habla con él).
    if (horarioTurnos !== undefined) {
      const horario = { bloques: horarioTurnos.bloques || [] }
      if (!validarHorario(horario)) {
        return NextResponse.json({ error: 'Horario inválido.' }, { status: 400 })
      }
      cambios.horarioTurnos = horario
    }

    // Si el admin activa Premium desde el formulario general de edición
    // (no desde "Confirmar pago recibido"), y no mandó una vigencia
    // explícita, la activamos ya mismo — si no, quedaría guardado
    // plan:'premium' pero sin efecto (esPremiumVigente exige AMBAS
    // cosas: plan Y una vigencia futura), y el profesional no vería
    // nada nuevo pese a que el admin cree que ya lo activó.
    if (cambios.plan === 'premium' && planVigenciaHasta === undefined) {
      const ref = getDb().collection('profesionales').doc(params.id)
      const actual = (await ref.get()).data() || {}
      if (!esPremiumVigente(actual)) {
        cambios.planVigenciaHasta = calcularNuevaVigencia(actual.planVigenciaHasta)
      }
    }

    await getDb().collection('profesionales').doc(params.id).update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
  }
}

// DELETE: solo admin.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const db = getDb()
    await db.collection('profesionales').doc(params.id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 })
  }
}
