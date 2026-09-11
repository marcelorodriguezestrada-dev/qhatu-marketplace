import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { esPremiumVigente } from '@/lib/planPremium'
import { enviarConfirmacionTurno, enviarNotificacionTurnoProfesional } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET ?profesionalId=X — protegido: solo el dueño de ese perfil puede
// ver sus turnos (con nombre y contacto del cliente incluidos). Se
// usa desde "Mis turnos" en /mi-perfil.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  const profesionalId = req.nextUrl.searchParams.get('profesionalId')
  if (!profesionalId) return NextResponse.json({ error: 'Falta profesionalId.' }, { status: 400 })

  try {
    const db = getDb()
    const doc = await db.collection('profesionales').doc(profesionalId).get()
    if (!doc.exists || doc.data()!.solicitanteUid !== usuario.uid) {
      return NextResponse.json({ error: 'Este perfil no te pertenece.' }, { status: 403 })
    }
    const snap = await db.collection('turnos').where('profesionalId', '==', profesionalId).get()
    const turnos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    return NextResponse.json({ turnos })
  } catch (err) {
    console.error('GET /api/turnos', err)
    return NextResponse.json({ error: 'No se pudieron cargar los turnos.' }, { status: 500 })
  }
}

// POST — público, lo llama cualquier visitante para reservar un turno
// con un profesional Premium. Sin login: igual que "Contactar por
// WhatsApp", reservar un turno no debería exigirle cuenta a nadie.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profesionalId, nombre, fecha, diaLabel, hora, contacto, contactoTipo } = body

    if (!profesionalId || !nombre || !fecha || !hora || !contacto || !contactoTipo) {
      return NextResponse.json({ error: 'Faltan datos del turno.' }, { status: 400 })
    }
    if (contactoTipo !== 'mail' && contactoTipo !== 'whatsapp') {
      return NextResponse.json({ error: 'Contacto inválido.' }, { status: 400 })
    }

    const db = getDb()
    const profDoc = await db.collection('profesionales').doc(profesionalId).get()
    if (!profDoc.exists) {
      return NextResponse.json({ error: 'Ese profesional ya no está disponible.' }, { status: 404 })
    }
    const profesional = profDoc.data()!
    // Chequeo server-side, no solo de UI: si perdió el Premium después
    // de que alguien abrió la página, no debería poder seguir
    // recibiendo turnos nuevos.
    if (!esPremiumVigente(profesional)) {
      return NextResponse.json({ error: 'Este profesional no tiene la agenda de turnos activa.' }, { status: 403 })
    }

    // Chequeo de choque: mismo profesional+fecha+hora ya reservado.
    const existente = await db
      .collection('turnos')
      .where('profesionalId', '==', profesionalId)
      .where('fecha', '==', fecha)
      .where('hora', '==', hora)
      .limit(1)
      .get()
    if (!existente.empty) {
      return NextResponse.json({ error: 'Ese horario ya fue reservado por otra persona.' }, { status: 409 })
    }

    const nuevoTurno = {
      profesionalId,
      profesionalNombre: profesional.nombre || '',
      nombre,
      fecha,
      diaLabel: diaLabel || fecha,
      hora,
      contacto,
      contactoTipo,
      createdAt: new Date().toISOString(),
    }
    const ref = await db.collection('turnos').add(nuevoTurno)

    if (contactoTipo === 'mail') {
      try {
        await enviarConfirmacionTurno(contacto, {
          nombre, profesionalNombre: nuevoTurno.profesionalNombre, diaLabel: nuevoTurno.diaLabel, hora,
        })
      } catch (mailErr) {
        // El turno YA se guardó — no le devolvemos error al cliente por
        // esto, solo lo logueamos.
        console.error('El turno se guardó pero el mail de confirmación falló:', mailErr)
      }
    }

    if (profesional.email) {
      try {
        await enviarNotificacionTurnoProfesional(profesional.email, {
          nombre, profesionalNombre: nuevoTurno.profesionalNombre, diaLabel: nuevoTurno.diaLabel, hora,
          contacto, contactoTipo,
        })
      } catch (mailErr) {
        console.error('El turno se guardó pero la notificación al profesional falló:', mailErr)
      }
    }

    return NextResponse.json({ turno: { id: ref.id, ...nuevoTurno } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/turnos', err)
    return NextResponse.json({ error: 'No se pudo reservar el turno.' }, { status: 500 })
  }
}
