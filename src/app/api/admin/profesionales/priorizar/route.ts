import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { construirArbolCategorias } from '@/lib/categoriasServer'
import { priorizarInvitacionesIA, textoEspera } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// POST — botón "Ordenar por prioridad con IA" de /admin → Servicios.
// Toma las solicitudes de profesionales pendientes de revisión y las ya
// invitadas que esperan respuesta (la espera baja el puntaje), le pide
// a la IA un puntaje de a quién invitar primero (ver
// priorizarInvitacionesIA) y lo guarda en cada una como
// prioridadInvitacionIA, para que el orden quede aunque se recargue.
// No cambia estados ni le escribe a nadie.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 500 })
  }

  try {
    const db = getDb()
    const [snap, arbol] = await Promise.all([
      db.collection('profesionales').where('estado', 'in', ['pendiente_revision', 'info_solicitada']).get(),
      construirArbolCategorias(),
    ])
    if (snap.empty) return NextResponse.json({ evaluados: 0, prioridades: [] })

    const labelPorRubro = new Map(arbol.rubrosFlat.map((r) => [r.id, r.label]))
    const lista = snap.docs.map((d) => {
      const p = d.data()
      return {
        id: d.id,
        nombre: String(p.nombre || ''),
        rubroLabel: labelPorRubro.get(p.rubro) || p.rubro || 'Sin rubro',
        especialidad: String(p.especialidad || ''),
        descripcion: String(p.descripcion || ''),
        zona: String(p.zona || ''),
        experiencia: String(p.experiencia || ''),
        precio: p.precio ? `Bs ${p.precio}` : '',
        // Si ya se lo invitó y no respondió, la IA lo baja en la lista.
        espera: p.estado === 'info_solicitada' ? textoEspera(p.invitadoEn, p.invitaciones) || 'se le pidió info, sin respuesta' : '',
      }
    })

    const prioridades = await priorizarInvitacionesIA(lista)
    if (prioridades.length === 0) {
      return NextResponse.json({ error: 'La IA no devolvió resultados. Intentá de nuevo en un momento.' }, { status: 502 })
    }

    const evaluadoEn = new Date().toISOString()
    const batch = db.batch()
    for (const pr of prioridades) {
      batch.update(db.collection('profesionales').doc(pr.id), {
        prioridadInvitacionIA: { puntaje: pr.puntaje, motivo: pr.motivo, evaluadoEn },
      })
    }
    await batch.commit()

    return NextResponse.json({ evaluados: prioridades.length, total: lista.length, prioridades: prioridades.map((p) => ({ ...p, evaluadoEn })) })
  } catch (err) {
    console.error('POST /api/admin/profesionales/priorizar', err)
    return NextResponse.json({ error: 'No se pudo priorizar con IA.' }, { status: 500 })
  }
}
