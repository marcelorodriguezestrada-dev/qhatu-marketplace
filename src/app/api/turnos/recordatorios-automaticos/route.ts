import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { enviarRecordatorioTurno } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET — la llama Vercel Cron una vez por día (ver vercel.json). Manda
// el recordatorio automático a todos los turnos de MAÑANA que sean por
// mail y todavía no se les haya mandado nada. Los turnos por WhatsApp
// no se pueden mandar solos (no hay API de WhatsApp Business acá) — a
// esos les queda el botón manual "Recordar" en Mis turnos.
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secreto && auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const mañana = new Date()
    mañana.setDate(mañana.getDate() + 1)
    const fechaObjetivo = mañana.toISOString().slice(0, 10)

    const db = getDb()
    const snap = await db
      .collection('turnos')
      .where('fecha', '==', fechaObjetivo)
      .where('contactoTipo', '==', 'mail')
      .get()

    let enviados = 0
    let fallidos = 0
    for (const doc of snap.docs) {
      const turno = doc.data()
      if (turno.recordatorioEnviado) continue
      try {
        await enviarRecordatorioTurno(turno.contacto, {
          nombre: turno.nombre,
          profesionalNombre: turno.profesionalNombre || '',
          diaLabel: turno.diaLabel,
          hora: turno.hora,
        })
        await doc.ref.update({ recordatorioEnviado: true, recordatorioEnviadoEn: new Date().toISOString(), recordatorioAutomatico: true })
        enviados++
      } catch (err) {
        console.error(`No se pudo mandar el recordatorio automático del turno ${doc.id}:`, err)
        fallidos++
      }
    }

    return NextResponse.json({ fecha: fechaObjetivo, turnosRevisados: snap.size, enviados, fallidos })
  } catch (err) {
    console.error('GET /api/turnos/recordatorios-automaticos', err)
    return NextResponse.json({ error: 'Falló la corrida de recordatorios.' }, { status: 500 })
  }
}
