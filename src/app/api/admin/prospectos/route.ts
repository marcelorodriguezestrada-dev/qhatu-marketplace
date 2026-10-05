import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CAMPANA_DEFECTO, numeroWhatsapp, type Campana } from '@/lib/prospectos'
import { leerCampana, limpiarProspecto } from '@/lib/prospectosServer'

export const dynamic = 'force-dynamic'

// Admin → 🎯 Captar tiendas.
// GET → { prospectos, campana }
// POST { nombre, rubro, ciudad, whatsapp, direccion, lat, lng, notas, contacto, redes, origen, osmId } → crea un prospecto
// PUT { campana: { oferta, cupos, mensajeBase } } → guarda la campaña (config/captacion)
const autorizado = (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const [snap, campana] = await Promise.all([getDb().collection('prospectos').get(), leerCampana()])
    const prospectos = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return NextResponse.json({ prospectos, campana })
  } catch (err) {
    console.error('GET /api/admin/prospectos', err)
    return NextResponse.json({ error: 'No se pudieron leer los prospectos.' }, { status: 500 })
  }
}

const texto = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const d = limpiarProspecto(b)
  if (!d.nombre || String(d.nombre).length < 2) return NextResponse.json({ error: 'Poné el nombre de la tienda.' }, { status: 400 })
  if (d.whatsapp && !numeroWhatsapp(String(d.whatsapp))) return NextResponse.json({ error: 'Ese WhatsApp no parece un número válido (ej. 71234567).' }, { status: 400 })
  try {
    const db = getDb()
    const osmId = texto(b.osmId, 40)
    if (osmId) {
      const ya = await db.collection('prospectos').where('osmId', '==', osmId).limit(1).get()
      if (!ya.empty) return NextResponse.json({ error: 'Esa tienda ya está en tus prospectos.', id: ya.docs[0].id }, { status: 409 })
    }
    const ahora = new Date().toISOString()
    const doc = {
      nombre: '', rubro: '', ciudad: 'potosi', whatsapp: '', direccion: '', lat: null, lng: null, notas: '', contacto: '', redes: '',
      ...d,
      estado: 'nuevo',
      origen: b.origen === 'mapa' ? 'mapa' : 'manual',
      ...(osmId ? { osmId } : {}),
      beneficio: false,
      estrategia: null,
      createdAt: ahora,
      updatedAt: ahora,
    }
    const ref = await db.collection('prospectos').add(doc)
    return NextResponse.json({ ok: true, prospecto: { id: ref.id, ...doc } })
  } catch (err) {
    console.error('POST /api/admin/prospectos', err)
    return NextResponse.json({ error: 'No se pudo guardar el prospecto.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const c = b.campana || {}
  const campana: Campana = {
    oferta: texto(c.oferta, 160) || CAMPANA_DEFECTO.oferta,
    cupos: Math.min(1000, Math.max(1, Math.floor(Number(c.cupos) || CAMPANA_DEFECTO.cupos))),
    mensajeBase: texto(c.mensajeBase, 1500),
  }
  await getDb().collection('config').doc('captacion').set(campana)
  return NextResponse.json({ ok: true, campana })
}
