import { NextRequest, NextResponse } from 'next/server'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { construirArbolCategorias } from '@/lib/categoriasServer'
import { enviarSugerenciaIAProfesional, enviarSugerenciaIAAnunciante } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST { anuncioId, profesionalId, motivo } — botón "Sugerir a ambas
// partes" de /admin, para un par que salió del análisis con IA (nunca
// se llama solo). A diferencia del macheo automático por rubro (que
// solo le avisa al profesional), esto le avisa a LAS DOS partes:
// - al profesional, que hay alguien buscando lo suyo
// - a quien publicó el anuncio, que encontramos a alguien puntual
// Cada aviso es mail (si hay a dónde mandarlo) + notificación adentro
// de la app — ninguno de los cuatro pasos frena a los demás si falla.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { anuncioId, profesionalId, motivo } = body
    if (!anuncioId || !profesionalId) {
      return NextResponse.json({ error: 'Faltan datos (anuncioId y profesionalId).' }, { status: 400 })
    }

    const db = getDb()
    const [anuncioDoc, profesionalDoc] = await Promise.all([
      db.collection('anuncios').doc(anuncioId).get(),
      db.collection('profesionales').doc(profesionalId).get(),
    ])
    if (!anuncioDoc.exists) return NextResponse.json({ error: 'Ese anuncio ya no existe.' }, { status: 404 })
    if (!profesionalDoc.exists) return NextResponse.json({ error: 'Ese profesional ya no existe.' }, { status: 404 })

    const anuncio = anuncioDoc.data()!
    const profesional = profesionalDoc.data()!
    const motivoTexto = String(motivo || 'Podría ser un buen match.').slice(0, 200)
    const authAdmin = getAuthAdmin()
    const ahora = new Date().toISOString()

    // --- Lado profesional ---
    let emailProfesional: string | undefined
    let emailProfesionalEnviado = false
    try {
      emailProfesional = profesional.email as string | undefined
      if (!emailProfesional && profesional.solicitanteUid) {
        const cuenta = await authAdmin.getUser(profesional.solicitanteUid).catch(() => null)
        emailProfesional = cuenta?.email || undefined
      }
      if (emailProfesional) {
        await enviarSugerenciaIAProfesional(emailProfesional, {
          profesionalNombre: profesional.nombre || 'profesional',
          anuncioTitulo: anuncio.titulo,
          anuncioDescripcion: anuncio.descripcion,
          motivo: motivoTexto,
          whatsappSolicitante: anuncio.whatsapp || anuncio.telefonoOriginal || '',
        })
        emailProfesionalEnviado = true
      }
    } catch (err) {
      console.error('sugerir: mail al profesional', err)
    }

    await db.collection('notificaciones').add({
      uid: profesional.solicitanteUid || null,
      tipo: 'sugerencia_ia',
      anuncioId,
      anuncioTitulo: anuncio.titulo,
      profesionalId,
      profesionalNombre: profesional.nombre || null,
      mensaje: `Un admin cree que podés ayudar con "${anuncio.titulo}": ${motivoTexto}`,
      leida: false,
      emailDestino: emailProfesional || null,
      emailEnviado: emailProfesionalEnviado,
      createdAt: ahora,
    }).catch((err) => console.error('sugerir: notificación al profesional', err))

    // --- Lado anunciante ---
    let emailAnunciante: string | undefined
    let emailAnuncianteEnviado = false
    try {
      if (anuncio.autorUid) {
        const cuenta = await authAdmin.getUser(anuncio.autorUid).catch(() => null)
        emailAnunciante = cuenta?.email || undefined
      }
      if (emailAnunciante && profesional.whatsapp) {
        const arbol = await construirArbolCategorias()
        const rubroLabel = arbol.rubrosFlat.find((r) => r.id === profesional.rubro)?.label || profesional.rubro || 'Sin rubro'
        await enviarSugerenciaIAAnunciante(emailAnunciante, {
          anuncioTitulo: anuncio.titulo,
          profesionalNombre: profesional.nombre || 'un profesional',
          profesionalRubroLabel: rubroLabel,
          motivo: motivoTexto,
          whatsappProfesional: profesional.whatsapp,
          profesionalId,
        })
        emailAnuncianteEnviado = true
      }
    } catch (err) {
      console.error('sugerir: mail al anunciante', err)
    }

    if (anuncio.autorUid) {
      await db.collection('notificaciones').add({
        uid: anuncio.autorUid,
        tipo: 'sugerencia_profesional',
        anuncioId,
        anuncioTitulo: anuncio.titulo,
        profesionalId,
        profesionalNombre: profesional.nombre || null,
        mensaje: `Encontramos a ${profesional.nombre || 'un profesional'} para tu anuncio "${anuncio.titulo}": ${motivoTexto}`,
        leida: false,
        emailDestino: emailAnunciante || null,
        emailEnviado: emailAnuncianteEnviado,
        createdAt: ahora,
      }).catch((err) => console.error('sugerir: notificación al anunciante', err))
    }

    return NextResponse.json({
      ok: true,
      profesionalAvisado: emailProfesionalEnviado,
      anuncianteAvisado: emailAnuncianteEnviado || !!anuncio.autorUid,
    })
  } catch (err) {
    console.error('POST /api/admin/macheos/sugerir', err)
    return NextResponse.json({ error: 'No se pudo mandar la sugerencia.' }, { status: 500 })
  }
}
