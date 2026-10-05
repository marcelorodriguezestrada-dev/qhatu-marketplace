import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { numeroWhatsapp } from '@/lib/prospectos'
import { leerCampana, limpiarProspecto } from '@/lib/prospectosServer'

export const dynamic = 'force-dynamic'

// PATCH { ...campos, estado? } → actualiza. Al pasar a "registrado" se le
// asigna uno de los cupos de la campaña (si quedan): beneficio = true.
// { registrar: 'texto' } suma una línea al historial de seguimiento.
// DELETE → lo borra.
const autorizado = (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const d = limpiarProspecto(b)
  if (d.nombre !== undefined && String(d.nombre).length < 2) return NextResponse.json({ error: 'Poné el nombre de la tienda.' }, { status: 400 })
  if (d.whatsapp && !numeroWhatsapp(String(d.whatsapp))) return NextResponse.json({ error: 'Ese WhatsApp no parece un número válido (ej. 71234567).' }, { status: 400 })
  if (b.estrategia !== undefined) d.estrategia = b.estrategia && typeof b.estrategia === 'object' ? b.estrategia : null
  if (typeof b.beneficio === 'boolean') d.beneficio = b.beneficio
  try {
    const db = getDb()
    const ref = db.collection('prospectos').doc(params.id)
    const campana = await leerCampana()
    const res = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      if (!doc.exists) return { error: 'Prospecto no encontrado.', status: 404 }
      const actual = doc.data() as any
      const ahora = new Date().toISOString()
      const cambios: Record<string, unknown> = { ...d, updatedAt: ahora }
      if (typeof b.registrar === 'string' && b.registrar.trim()) cambios.historial = FieldValue.arrayUnion({ fecha: ahora, accion: b.registrar.trim().slice(0, 200) })
      if (d.estado && d.estado !== actual.estado) {
        if (d.estado === 'contactado' && !actual.contactadoAt) cambios.contactadoAt = ahora
        if (d.estado === 'registrado') {
          cambios.registradoAt = actual.registradoAt || ahora
          if (!actual.beneficio && b.beneficio === undefined) {
            const con = await tx.get(db.collection('prospectos').where('beneficio', '==', true))
            if (con.size < campana.cupos) cambios.beneficio = true
          }
        }
      }
      tx.update(ref, cambios)
      const historial = cambios.historial ? [...(actual.historial || []), { fecha: ahora, accion: String(b.registrar).trim().slice(0, 200) }] : actual.historial
      return { prospecto: { id: doc.id, ...actual, ...cambios, historial } }
    })
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ ok: true, ...res })
  } catch (err) {
    console.error('PATCH /api/admin/prospectos/[id]', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  await getDb().collection('prospectos').doc(params.id).delete()
  return NextResponse.json({ ok: true })
}
