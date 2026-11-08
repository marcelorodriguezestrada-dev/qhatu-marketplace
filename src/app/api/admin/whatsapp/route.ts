import { NextRequest, NextResponse } from 'next/server'
import { esClaveAdmin } from '@/lib/adminAuth'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET (admin): qué variables del bot de WhatsApp están cargadas en el
// servidor (solo sí/no, nunca los valores) para Admin → Marketing.
export async function GET(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const vars = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ADMINS', 'GROQ_API_KEY', 'IMGBB_API_KEY', 'GEMINI_API_KEY']
  const estado = (await getDb().collection('config').doc('whatsappBot').get().catch(() => null))?.data() || {}
  const admins = Array.from(new Set(
    (process.env.WHATSAPP_ADMINS || '').split(/[,\s]+/).map((n) => n.replace(/\D/g, '')).filter(Boolean),
  ))
  const [actividadSnap, productosSnap] = await Promise.all([
    getDb().collection('whatsappActividad').orderBy('at', 'desc').limit(100).get(),
    getDb().collection('productos').orderBy('createdAt', 'desc').limit(300).get(),
  ])
  const actividad = new Map<string, Record<string, unknown>>()
  actividadSnap.docs.forEach((doc) => {
    const data = doc.data()
    actividad.set(doc.id, { id: doc.id, ...data })
  })
  productosSnap.docs.forEach((doc) => {
    const producto = doc.data()
    const numero = String(producto.cargadoPorWhatsapp || '').replace(/\D/g, '')
    if (!numero) return
    const mensajeId = String(producto.whatsappMensajeId || doc.id)
    const anterior = actividad.get(mensajeId) || {}
    actividad.set(mensajeId, {
      ...anterior,
      id: mensajeId,
      numero,
      esAdmin: typeof producto.cargadoPorWhatsappAdmin === 'boolean'
        ? producto.cargadoPorWhatsappAdmin
        : admins.includes(numero),
      estado: 'producto_creado',
      productoId: doc.id,
      productoNombre: String(producto.nombre || 'Producto sin nombre'),
      productoCreadoAt: producto.createdAt || null,
      tiendaId: producto.vendedorId || null,
      tiendaNombre: producto.tiendaNombre || producto.vendedor || null,
      at: anterior.at || producto.createdAt || null,
    })
  })
  const registros = Array.from(actividad.values())
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, 100)
  return NextResponse.json({
    variables: Object.fromEntries(vars.map((v) => [v, !!process.env[v]])),
    estado,
    admins,
    actividad: registros,
  })
}
