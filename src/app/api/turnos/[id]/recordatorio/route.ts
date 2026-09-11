import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { enviarRecordatorioTurno } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST — botón "Recordar" en Mis turnos. Solo funciona para turnos con
// contacto por mail: para WhatsApp no hay forma de que el servidor
// mande el mensaje solo (no tenemos la API de WhatsApp Business), así
// que esos se resuelven abriendo el link de WhatsApp directo desde el
// frontend, sin pasar por acá.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const ref = db.collection('turnos').doc(params.id)
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ error: 'Ese turno ya no existe.' }, { status: 404 })
    const turno = doc.data()!

    const profDoc = await db.collection('profesionales').doc(turno.profesionalId).get()
    if (!profDoc.exists || profDoc.data()!.solicitanteUid !== usuario.uid) {
      return NextResponse.json({ error: 'Este turno no te pertenece.' }, { status: 403 })
    }

    if (turno.contactoTipo !== 'mail') {
      return NextResponse.json({ error: 'Este turno es por WhatsApp, no por mail — usá el botón de WhatsApp.' }, { status: 400 })
    }

    await enviarRecordatorioTurno(turno.contacto, {
      nombre: turno.nombre,
      profesionalNombre: turno.profesionalNombre || profDoc.data()!.nombre || '',
      diaLabel: turno.diaLabel,
      hora: turno.hora,
    })

    const enviadoEn = new Date().toISOString()
    await ref.update({ recordatorioEnviado: true, recordatorioEnviadoEn: enviadoEn })

    return NextResponse.json({ ok: true, recordatorioEnviadoEn: enviadoEn })
  } catch (err) {
    console.error('POST /api/turnos/[id]/recordatorio', err)
    return NextResponse.json({ error: 'No se pudo mandar el recordatorio. ¿Está configurado RESEND_API_KEY?' }, { status: 500 })
  }
}
