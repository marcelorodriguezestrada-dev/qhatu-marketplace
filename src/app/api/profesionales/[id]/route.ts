import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'
import { validarHorario } from '@/data/turnos'
import { esPremiumVigente, calcularNuevaVigencia, PRECIO_PREMIUM_BS } from '@/lib/planPremium'
import { sanearHistorialLaboral, sanearIdiomas } from '@/lib/cvEstandar'

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
    // La página del CV (/servicios/[id]/cv) manda ?sinVista=1: la usan
    // sobre todo el propio profesional y el admin para revisarlo y
    // descargarlo, y no queremos inflar las vistas del perfil con eso.
    if (!req.nextUrl.searchParams.get('sinVista')) {
      ref.update({ vistas: FieldValue.increment(1) }).catch(() => {})
      sumarMetricaDiaria('vistasProfesionales').catch(() => {})
    }

    return NextResponse.json({ id: doc.id, ...doc.data(), resenas })
  } catch (err) {
    console.error('GET /api/profesionales/[id]', err)
    return NextResponse.json({ error: 'No se pudo cargar el perfil.' }, { status: 500 })
  }
}

// PATCH: dos niveles de permiso.
//  - Admin (con ADMIN_PASSWORD) → puede editar cualquier campo, incluido
//    estado, plan y demás datos "de gestión" de la plataforma.
//  - El propio profesional (con su login de Firebase, dueño de este
//    documento vía solicitanteUid) → puede editar solo los campos de su
//    "presentación": nombre, especialidad, descripción, experiencia,
//    servicios, estudios y su CV (historial laboral e idiomas).
//    Es lo que usa /mi-perfil al guardar la propuesta armada desde su
//    CV (ver /api/profesionales/extraer-cv) — el resto de los campos
//    (rubro, contacto, ubicación, plan, estado) siguen siendo territorio
//    del admin para no abrir la puerta a que alguien se recategorice o
//    se autoapruebe.
const CAMPOS_EDITABLES_DUEÑO = ['nombre', 'especialidad', 'descripcion', 'experiencia', 'servicios', 'dondeTrabaja', 'educacion', 'historialLaboral', 'idiomas'] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const password = req.headers.get('x-admin-password')
  const esAdmin = !!password && password === process.env.ADMIN_PASSWORD

  const db = getDb()
  const ref = db.collection('profesionales').doc(params.id)

  let esDueño = false
  if (!esAdmin) {
    const usuario = await getUsuarioDesdeRequest(req)
    if (usuario) {
      const doc = await ref.get()
      esDueño = doc.exists && doc.data()?.solicitanteUid === usuario.uid
    }
    if (!esDueño) {
      return NextResponse.json({ error: 'No autorizado para editar este perfil.' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()

    // El dueño (no-admin) solo puede tocar su subset de campos — lo
    // filtramos acá mismo para que ni por error se cuele un cambio de
    // estado/plan/rubro/contacto desde un pedido armado a mano.
    const bodyPermitido = esAdmin
      ? body
      : Object.fromEntries(Object.entries(body).filter(([k]) => (CAMPOS_EDITABLES_DUEÑO as readonly string[]).includes(k)))

    const { estado, nombre, rubro, especialidad, descripcion, dondeTrabaja, educacion, zona, direccion, lat, lng, whatsapp, instagram, email, notaAdmin, icono, plan, planVigenciaHasta, planEstadoPago, fotosAdicionales, imagenUrl, precio, experiencia, horarioTurnos, servicios, historialLaboral, idiomas } = bodyPermitido
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
    if (dondeTrabaja !== undefined) cambios.dondeTrabaja = String(dondeTrabaja || '').trim().slice(0, 500)
    if (educacion !== undefined) cambios.educacion = String(educacion || '').trim().slice(0, 300)
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
    // Lista de servicios concretos (ej: "Diseña arquitecturas de datos").
    // La sanamos igual del lado del dueño que del admin — nunca
    // confiamos en que el body ya venga limpio.
    if (servicios !== undefined) {
      cambios.servicios = Array.isArray(servicios)
        ? servicios
            .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim().slice(0, 80))
            .slice(0, 6)
        : []
    }
    // CV estandarizado (ver src/lib/cvEstandar.ts) — mismo saneo para
    // el dueño y para el admin.
    if (historialLaboral !== undefined) cambios.historialLaboral = sanearHistorialLaboral(historialLaboral)
    if (idiomas !== undefined) cambios.idiomas = sanearIdiomas(idiomas)
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
      const actual = (await ref.get()).data() || {}
      if (!esPremiumVigente(actual)) {
        cambios.planVigenciaHasta = calcularNuevaVigencia(actual.planVigenciaHasta)
      }
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'No mandaste ningún campo para actualizar.' }, { status: 400 })
    }
    await ref.update(cambios)

    // Registro contable: solo cuando esto vino del flujo real de
    // "Confirmar pago recibido" (planEstadoPago:'ninguno' + una
    // vigencia calculada explícita) — no cuando el admin activa
    // Premium a mano desde el formulario general de edición (arriba),
    // porque ahí no hubo necesariamente un pago real de por medio.
    if (cambios.plan === 'premium' && planEstadoPago === 'ninguno' && planVigenciaHasta !== undefined) {
      const profDoc = await ref.get()
      await db.collection('pagos_premium').add({
        profesionalId: params.id,
        profesionalNombre: profDoc.data()?.nombre || null,
        monto: PRECIO_PREMIUM_BS,
        vigenciaHasta: planVigenciaHasta,
        fecha: new Date().toISOString(),
      })
    }

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
