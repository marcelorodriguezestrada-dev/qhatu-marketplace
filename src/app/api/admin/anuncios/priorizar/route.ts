import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { construirArbolCategorias } from '@/lib/categoriasServer'
import { priorizarAnunciosIA, textoEspera } from '@/lib/moderacionIA'
import { labelTipoAnuncio } from '@/data/anuncios'

export const dynamic = 'force-dynamic'

// POST — "🤖 Ordenar por prioridad con IA" en Admin → Anuncios. Puntúa
// los anuncios pendientes y los que ya se invitaron/pidió info (la espera
// sin respuesta baja el puntaje) y guarda prioridadInvitacionIA en cada uno.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 500 })
  try {
    const db = getDb()
    const [snap, arbol] = await Promise.all([
      db.collection('anuncios').where('estado', 'in', ['pendiente_revision', 'info_solicitada']).get(),
      construirArbolCategorias(),
    ])
    if (snap.empty) return NextResponse.json({ evaluados: 0, prioridades: [] })
    const labelPorRubro = new Map(arbol.rubrosFlat.map((r) => [r.id, r.label]))
    const lista = snap.docs.map((d) => {
      const a = d.data()
      return {
        id: d.id,
        titulo: String(a.titulo || ''),
        descripcion: String(a.descripcion || ''),
        tipo: labelTipoAnuncio(a.tipo),
        precio: a.precio ? `Bs ${a.precio}` : '',
        rubroLabel: a.rubro ? labelPorRubro.get(a.rubro) || '' : '',
        espera: a.estado === 'info_solicitada' ? textoEspera(a.invitadoEn, a.invitaciones) || 'se le pidió info, sin respuesta' : '',
      }
    })
    const prioridades = await priorizarAnunciosIA(lista)
    if (prioridades.length === 0) return NextResponse.json({ error: 'La IA no devolvió resultados. Intentá de nuevo en un momento.' }, { status: 502 })
    const evaluadoEn = new Date().toISOString()
    for (let i = 0; i < prioridades.length; i += 400) {
      const batch = db.batch()
      for (const pr of prioridades.slice(i, i + 400)) {
        batch.update(db.collection('anuncios').doc(pr.id), { prioridadInvitacionIA: { puntaje: pr.puntaje, motivo: pr.motivo, evaluadoEn } })
      }
      await batch.commit()
    }
    return NextResponse.json({ evaluados: prioridades.length, total: lista.length, prioridades: prioridades.map((p) => ({ ...p, evaluadoEn })) })
  } catch (err) {
    console.error('POST /api/admin/anuncios/priorizar', err)
    return NextResponse.json({ error: 'No se pudo priorizar con IA.' }, { status: 500 })
  }
}
