import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { esPremiumVigente } from '@/lib/planPremium'
import { validarHorario } from '@/data/turnos'

export const dynamic = 'force-dynamic'

async function verificarDueñoPremium(ref: FirebaseFirestore.DocumentReference, uid: string) {
  const doc = await ref.get()
  if (!doc.exists) return { error: 'No encontrado.', status: 404 as const }
  const data = doc.data()!
  if (data.solicitanteUid !== uid) return { error: 'Este perfil no te pertenece.', status: 403 as const }
  // Igual que con las fotos extra: la agenda de turnos es un beneficio
  // Premium, y se chequea acá (server) además de ocultarse en la UI.
  if (!esPremiumVigente(data)) {
    return { error: 'La agenda de turnos es un beneficio Premium. Activá tu membresía primero.', status: 403 as const }
  }
  return { data }
}

// GET: público — el horario configurado (bloques por día), para armar
// el selector de "Reservar turno" en la ficha del profesional.
// Devuelve vacío si todavía no cargó nada o si perdió el Premium.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doc = await getDb().collection('profesionales').doc(params.id).get()
    if (!doc.exists) return NextResponse.json({ bloques: [] })
    const data = doc.data()!
    if (!esPremiumVigente(data)) return NextResponse.json({ bloques: [] })
    const horario = data.horarioTurnos
    if (!validarHorario(horario)) return NextResponse.json({ bloques: [] })
    return NextResponse.json(horario)
  } catch (err) {
    console.error('GET /api/profesionales/[id]/horarios', err)
    return NextResponse.json({ bloques: [] })
  }
}

// POST { bloques: BloqueHorario[] } — guarda el horario. Solo el
// dueño del perfil, y solo si tiene Premium vigente.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const ref = db.collection('profesionales').doc(params.id)
    const chequeo = await verificarDueñoPremium(ref, usuario.uid)
    if ('error' in chequeo) return NextResponse.json({ error: chequeo.error }, { status: chequeo.status })

    const body = await req.json()
    const horario = { bloques: body.bloques || [] }
    if (!validarHorario(horario)) {
      return NextResponse.json({ error: 'Horario inválido. Revisá los rangos de horas cargados.' }, { status: 400 })
    }

    await ref.update({ horarioTurnos: horario })
    return NextResponse.json({ horarioTurnos: horario })
  } catch (err: any) {
    console.error('POST /api/profesionales/[id]/horarios', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
