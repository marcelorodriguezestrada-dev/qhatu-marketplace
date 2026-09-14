import { getDb, getAuthAdmin } from './firebaseAdmin'
import { enviarNotificacionMacheo } from './email'

// Se llama cuando un anuncio de tipo "busqueda" pasa a estado
// "aprobado" (ver PATCH /api/anuncios/[id]) — nunca antes, para no
// avisarle a nadie de algo que todavía ni se sabe si va a publicarse.
//
// "Coincidencia exacta" = mismo `rubro` (el mismo id que ya usa
// /publicar-servicio y /servicios para clasificar profesionales) entre
// el anuncio y el profesional — no es una búsqueda de texto parecida,
// es el mismo id o no hay macheo.
//
// Por cada profesional que matchea, guarda una notificación en la app
// (colección `notificaciones`) y, si el profesional cargó un email,
// también le manda un mail. Ninguna de las dos cosas frena a la otra:
// si falla el mail, la notificación en la app queda guardada igual, y
// viceversa.
export async function ejecutarMacheo(anuncioId: string): Promise<{ notificados: number }> {
  const db = getDb()
  const anuncioDoc = await db.collection('anuncios').doc(anuncioId).get()
  if (!anuncioDoc.exists) return { notificados: 0 }
  const anuncio = anuncioDoc.data()!

  if (anuncio.tipo !== 'busqueda' || !anuncio.rubro) {
    // El macheo automático solo tiene sentido para "Busco X" con un
    // rubro elegido — un "Vendo" o un "Aviso general" no tiene con qué
    // cruzarse.
    return { notificados: 0 }
  }

  const profesionalesSnap = await db
    .collection('profesionales')
    .where('rubro', '==', anuncio.rubro)
    .where('estado', '==', 'aprobado')
    .get()

  if (profesionalesSnap.empty) return { notificados: 0 }

  const authAdmin = getAuthAdmin()
  let notificados = 0

  for (const doc of profesionalesSnap.docs) {
    const profesional = doc.data()
    const mensaje = `Alguien busca "${anuncio.titulo}" — coincide con tu rubro. Mirá el anuncio y contactalo por WhatsApp.`

    try {
      await db.collection('notificaciones').add({
        // A quién le llega adentro de la app — el dueño de la cuenta
        // del profesional, no el documento del profesional en sí.
        uid: profesional.solicitanteUid || null,
        tipo: 'macheo_anuncio',
        anuncioId,
        anuncioTitulo: anuncio.titulo,
        profesionalId: doc.id,
        mensaje,
        leida: false,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('ejecutarMacheo: no se pudo guardar la notificación', doc.id, err)
    }

    // El mail es best-effort — probamos con el email cargado en el
    // perfil del profesional, y si no hay, con el de su cuenta de
    // Firebase Auth (puede que haya cargado el perfil con un mail
    // distinto al de su login, por eso se intentan los dos).
    try {
      let destino = profesional.email as string | undefined
      if (!destino && profesional.solicitanteUid) {
        const cuenta = await authAdmin.getUser(profesional.solicitanteUid).catch(() => null)
        destino = cuenta?.email || undefined
      }
      if (destino) {
        await enviarNotificacionMacheo(destino, {
          profesionalNombre: profesional.nombre || 'profesional',
          anuncioTitulo: anuncio.titulo,
          anuncioDescripcion: anuncio.descripcion,
          anuncioId,
          whatsappSolicitante: anuncio.whatsapp,
        })
      }
    } catch (err) {
      console.error('ejecutarMacheo: no se pudo mandar el mail', doc.id, err)
    }

    notificados++
  }

  return { notificados }
}
