import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Estadísticas de matcheo de anuncios para /admin: por cada anuncio de
// tipo "busqueda", cuántos profesionales matchearon, a quiénes se les
// avisó por mail (y si salió bien), y el ranking de anuncios más
// vistos en general (incluye los que no matchean con nadie, como los
// "Vendo").
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const [anunciosSnap, notificacionesSnap] = await Promise.all([
      db.collection('anuncios').get(),
      db.collection('notificaciones').where('tipo', '==', 'macheo_anuncio').get(),
    ])

    const anuncios = anunciosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const notificaciones = notificacionesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

    // Agrupamos las notificaciones por anuncio para poder mostrar, por
    // cada "Busco X", a quiénes se les avisó.
    const porAnuncioId = new Map<string, any[]>()
    for (const n of notificaciones) {
      const lista = porAnuncioId.get(n.anuncioId) || []
      lista.push(n)
      porAnuncioId.set(n.anuncioId, lista)
    }

    const porAnuncio = anuncios
      .map((a) => {
        const destinatarios = (porAnuncioId.get(a.id) || [])
          .map((n) => ({
            profesionalNombre: n.profesionalNombre || null,
            email: n.emailDestino || null,
            emailEnviado: !!n.emailEnviado,
            fecha: n.createdAt || null,
          }))
          .sort((x, y) => (y.fecha || '').localeCompare(x.fecha || ''))
        return {
          anuncioId: a.id,
          anuncioTitulo: a.titulo,
          tipo: a.tipo,
          estado: a.estado,
          vistas: a.vistas || 0,
          matcheos: destinatarios.length,
          emailsEnviados: destinatarios.filter((d) => d.emailEnviado).length,
          destinatarios,
        }
      })
      .sort((a, b) => b.vistas - a.vistas)

    const totales = {
      totalAnuncios: anuncios.length,
      totalVistas: anuncios.reduce((acc, a) => acc + (a.vistas || 0), 0),
      totalMatcheos: notificaciones.length,
      totalEmailsEnviados: notificaciones.filter((n) => n.emailEnviado).length,
      anuncioMasVisto: porAnuncio[0] || null,
    }

    return NextResponse.json({ porAnuncio, totales })
  } catch (err) {
    console.error('GET /api/admin/macheos', err)
    return NextResponse.json({ error: 'No se pudieron cargar las estadísticas.' }, { status: 500 })
  }
}
