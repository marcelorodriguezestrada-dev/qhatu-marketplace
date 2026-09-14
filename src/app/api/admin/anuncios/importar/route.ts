import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { numeroConCodigoPais, validarWhatsappPorPais } from '@/lib/validarWhatsapp'
import { buscarPais, PAIS_FALLBACK_ID } from '@/data/paises'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST { anuncios: [{ titulo, descripcion, telefono, tipo, estado, notaAdmin }] }
// Solo admin. A diferencia de POST /api/anuncios (que exige login), acá
// el anuncio no tiene un usuario de la plataforma detrás — es un aviso
// que el admin sube A NOMBRE de un cliente externo (por ejemplo,
// copiado de un canal de WhatsApp). Por eso no lleva autorUid: en su
// lugar queda marcado `creadoPorAdmin: true` y el teléfono original
// tal cual se cargó, sin pasar por el login de nadie.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const items = Array.isArray(body.anuncios) ? body.anuncios : []
    if (items.length === 0) return NextResponse.json({ error: 'No mandaste ningún anuncio.' }, { status: 400 })

    const db = getDb()
    const batch = db.batch()
    const ahora = new Date().toISOString()
    let creados = 0
    const errores: string[] = []

    for (const item of items) {
      const titulo = (item.titulo || '').trim()
      const descripcion = (item.descripcion || '').trim()
      const telefono = (item.telefono || '').trim()

      if (!titulo || !descripcion || !telefono) {
        errores.push(`Salteado por faltar datos: "${titulo || item.telefono || '(sin título)'}"`)
        continue
      }

      const paisId = item.whatsappPais || PAIS_FALLBACK_ID
      const validacion = validarWhatsappPorPais(telefono, paisId)
      const whatsapp = validacion.valido ? numeroConCodigoPais(telefono, buscarPais(paisId).codigo) : ''

      const ref = db.collection('anuncios').doc()
      batch.set(ref, {
        titulo,
        descripcion,
        tipo: item.tipo || 'busqueda',
        whatsapp,
        whatsappPais: paisId,
        // Si el teléfono no pasó la validación (por ejemplo, un fijo o
        // un número mal copiado), igual lo guardamos tal cual lo
        // pegaron para no perder el dato — solo que no va a andar el
        // botón de WhatsApp hasta que alguien lo corrija a mano.
        telefonoOriginal: telefono,
        precio: null,
        imagenUrl: '',
        autorUid: null,
        autorEmail: null,
        creadoPorAdmin: true,
        origen: 'importacion_whatsapp',
        estado: item.estado || 'aprobado',
        notaAdmin: item.notaAdmin || null,
        vistas: 0,
        createdAt: ahora,
      })
      creados++
    }

    await batch.commit()
    return NextResponse.json({ creados, errores })
  } catch (err) {
    console.error('POST /api/admin/anuncios/importar', err)
    return NextResponse.json({ error: 'No se pudo importar el lote.' }, { status: 500 })
  }
}
