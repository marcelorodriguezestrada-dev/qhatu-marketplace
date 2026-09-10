import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { evaluarConIA } from '@/lib/moderacionIA'
import { validarWhatsappPorPais, numeroConCodigoPais } from '@/lib/validarWhatsapp'
import { buscarPais, PAIS_FALLBACK_ID } from '@/data/paises'

export const dynamic = 'force-dynamic'

// Convierte "Jardinero a domicilio" en "jardinero-a-domicilio" — así usamos
// el mismo texto como id del documento en Firestore: si dos personas
// escriben la misma categoría (con distintas mayúsculas/tildes), se
// pisan entre sí en vez de crear duplicados.
function slugify(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// POST — formulario que llena un profesional que quiere aparecer en el
// directorio. Requiere estar logueado (evita perfiles falsos sin
// ninguna cuenta detrás). Queda guardado con estado
// "pendiente_revision": no aparece en /servicios hasta que vos lo
// apruebes desde /admin. No acepta foto — para evitar abrir el
// endpoint de subida de imágenes al público sin ningún tipo de
// autenticación, la foto se agrega después, cuando aprobás la
// solicitud (o coordinándola directamente con el profesional).
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para publicar un servicio.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { nombre, rubro, rubroPersonalizado, categoriaId, especialidad, descripcion, zona, zonaPersonalizada, direccion, whatsapp, whatsappPais, instagram, email, precio, experiencia, lat, lng } = body
    if (!nombre || !rubro || !whatsapp) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (nombre, rubro, WhatsApp).' }, { status: 400 })
    }

    const paisId = whatsappPais || PAIS_FALLBACK_ID
    const validacionWhatsapp = validarWhatsappPorPais(whatsapp, paisId)
    if (!validacionWhatsapp.valido) {
      return NextResponse.json({ error: validacionWhatsapp.motivo }, { status: 400 })
    }
    const whatsappCompleto = numeroConCodigoPais(whatsapp, buscarPais(paisId).codigo)

    // El email es opcional (el contacto principal sigue siendo WhatsApp),
    // pero si escribió algo, que al menos tenga forma de email.
    const emailLimpio = (email || '').trim()
    if (emailLimpio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      return NextResponse.json({ error: 'El email no parece válido. Dejalo vacío si preferís que te contactemos solo por WhatsApp.' }, { status: 400 })
    }

    const db = getDb()

    // Igual que con el rubro: si escribió una zona nueva que no estaba
    // en la lista, la guardamos para que aparezca como opción de acá
    // en más para cualquier usuario.
    let zonaFinal = zona || ''
    if (zona === 'otra' && zonaPersonalizada?.trim()) {
      const zonaLimpia = zonaPersonalizada.trim()
      zonaFinal = zonaLimpia
      const slug = zonaLimpia
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
      if (slug) {
        await db.collection('zonas_personalizadas').doc(slug).set(
          { label: zonaLimpia, createdAt: new Date().toISOString() },
          { merge: true }
        )
      }
    }

    // Si eligió "Otro" y escribió una categoría nueva, la guardamos
    // (una sola vez, gracias al slug como id) para que de acá en más
    // aparezca como opción en el selector para cualquier usuario.
    let rubroFinal = rubro
    let rubroLabel = ''
    if (rubro === 'otro' && rubroPersonalizado?.trim()) {
      const slug = slugify(rubroPersonalizado)
      if (slug) {
        rubroFinal = slug
        rubroLabel = rubroPersonalizado.trim()
        await db.collection('rubros_personalizados').doc(slug).set(
          { label: rubroLabel, categoriaId: categoriaId || 'otros', createdAt: new Date().toISOString() },
          { merge: true }
        )
      }
    }

    // Pre-filtro de moderación con IA — solo etiqueta el riesgo para
    // ayudarte a priorizar en la cola de /admin, nunca aprueba o
    // rechaza por su cuenta.
    const moderacionIA = await evaluarConIA(
      `Solicitud de profesional.\nNombre: ${nombre}\nRubro: ${rubroLabel || rubro}\nZona: ${zonaFinal || 'no especificada'}\n` +
      `Descripción: ${descripcion || '(sin descripción)'}\n` +
      `Precio: ${precio ? `Bs ${precio}` : 'a convenir'}\nExperiencia declarada: ${experiencia || 'no especificada'}`
    )

    const ref = await db.collection('profesionales').add({
      nombre,
      rubro: rubroFinal,
      especialidad: especialidad || '',
      descripcion: descripcion || '',
      zona: zonaFinal,
      direccion: direccion || '',
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      whatsapp: whatsappCompleto,
      whatsappPais: paisId,
      instagram: instagram || '',
      email: emailLimpio,
      icono: rubroFinal,
      imagenUrl: '',
      precio: precio ? Number(precio) : null,
      experiencia: experiencia || '',
      plan: 'basico',
      planEstadoPago: 'ninguno',
      planVigenciaHasta: null,
      fotosAdicionales: [],
      estado: 'pendiente_revision',
      moderacionIA,
      solicitanteUid: usuario.uid,
      ratingPromedio: 0,
      cantidadResenas: 0,
      vistas: 0,
      clicsWhatsapp: 0,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/profesionales/solicitud', err)
    return NextResponse.json({ error: 'No se pudo enviar la solicitud.' }, { status: 500 })
  }
}

