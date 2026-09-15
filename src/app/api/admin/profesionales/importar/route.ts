import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { validarWhatsappPorPais, numeroConCodigoPais } from '@/lib/validarWhatsapp'
import { buscarPais, PAIS_FALLBACK_ID } from '@/data/paises'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST { profesionales: [{ nombre, descripcion, telefono, notaAdmin }] }
// Solo admin. Hermano de /api/admin/anuncios/importar, mismo mecanismo
// (pegar texto de un canal de WhatsApp, parsearlo, subir varios de una),
// pero acá el criterio es OTRO a propósito: un profesional/servicio no
// se puede auto-aprobar nunca desde una importación masiva — el texto
// de origen no dice ni el rubro real, ni la zona, ni si el contacto es
// serio. Por eso `estado` siempre queda fijo en 'pendiente_revision' acá
// (no se puede mandar 'aprobado' ni desde el body), y el rubro entra
// como 'otro' hasta que el admin lo revise uno por uno, le pida más
// datos si hace falta (mismo flujo de "Pedir más info" que ya existe
// para las solicitudes normales) y recién ahí lo apruebe.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const items = Array.isArray(body.profesionales) ? body.profesionales : []
    if (items.length === 0) return NextResponse.json({ error: 'No mandaste ningún profesional.' }, { status: 400 })

    const db = getDb()
    const batch = db.batch()
    const ahora = new Date().toISOString()
    let creados = 0
    const errores: string[] = []

    for (const item of items) {
      const nombre = (item.nombre || '').trim()
      const descripcion = (item.descripcion || '').trim()
      const telefono = (item.telefono || '').trim()

      if (!nombre || !telefono) {
        errores.push(`Salteado por faltar datos: "${nombre || telefono || '(sin nombre)'}"`)
        continue
      }

      const paisId = item.whatsappPais || PAIS_FALLBACK_ID
      const validacion = validarWhatsappPorPais(telefono, paisId)
      const whatsapp = validacion.valido ? numeroConCodigoPais(telefono, buscarPais(paisId).codigo) : ''

      const notaBase = 'Importado en lote desde WhatsApp — todavía sin rubro ni zona reales: confirmalos con el contacto antes de aprobar.'
      const nota = item.notaAdmin ? `${notaBase} ${item.notaAdmin}` : notaBase

      const ref = db.collection('profesionales').doc()
      batch.set(ref, {
        nombre,
        // Rubro/categoría de relleno — el admin lo tiene que corregir a
        // mano en la revisión, junto con la zona, antes de aprobar.
        rubro: 'otro',
        especialidad: '',
        descripcion,
        zona: '',
        direccion: '',
        lat: null,
        lng: null,
        whatsapp,
        whatsappPais: paisId,
        // Igual que en la importación de anuncios: si el teléfono no
        // pasó la validación, lo guardamos igual tal cual para no
        // perder el dato — el botón de WhatsApp no va a andar hasta
        // que se corrija a mano.
        telefonoOriginal: telefono,
        instagram: '',
        email: '',
        icono: 'otro',
        imagenUrl: '',
        precio: null,
        experiencia: '',
        plan: 'basico',
        planEstadoPago: 'ninguno',
        planVigenciaHasta: null,
        fotosAdicionales: [],
        creadoPorAdmin: true,
        origen: 'importacion_whatsapp',
        // Siempre pendiente de revisión, sin excepción — a diferencia
        // de los anuncios, acá no existe un "importado ya completo" que
        // se pueda aprobar solo.
        estado: 'pendiente_revision',
        notaAdmin: nota,
        ratingPromedio: 0,
        cantidadResenas: 0,
        vistas: 0,
        clicsWhatsapp: 0,
        createdAt: ahora,
      })
      creados++
    }

    await batch.commit()
    return NextResponse.json({ creados, errores })
  } catch (err) {
    console.error('POST /api/admin/profesionales/importar', err)
    return NextResponse.json({ error: 'No se pudo importar el lote.' }, { status: 500 })
  }
}
