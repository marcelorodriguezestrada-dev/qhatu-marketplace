import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getDb } from '@/lib/firebaseAdmin'
import { CARPETA_CLOUDINARY } from '@/lib/medios'

export const dynamic = 'force-dynamic'

// Admin → Marketing → 🎬 Contenido. Los archivos van directo del
// navegador a Cloudinary (firmado acá, así la clave nunca sale del
// servidor); en Firestore (mediosMarketing) queda solo el link.
//   GET                                 → { medios, cloudinary: { activo, cloud } }
//   POST { accion: 'firmar' }           → datos para subir a Cloudinary
//   POST { accion: 'guardar', medio }   → lo agrega a la biblioteca
//   PATCH { id, nombre?, publicacionId? }
//   DELETE ?id=                         → lo saca (y lo borra de Cloudinary)

const esAdmin = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}
const noAutorizado = () => NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
const cloud = () => ({ nombre: process.env.CLOUDINARY_CLOUD_NAME || '', key: process.env.CLOUDINARY_API_KEY || '', secret: process.env.CLOUDINARY_API_SECRET || '' })
const firmar = (params: Record<string, string | number>, secret: string) =>
  createHash('sha1').update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + secret).digest('hex')

export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  const c = cloud()
  const snap = await getDb().collection('mediosMarketing').get().catch(() => null)
  const medios = (snap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return NextResponse.json({ medios, cloudinary: { activo: !!(c.nombre && c.key && c.secret), cloud: c.nombre } })
}

export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const body = await req.json()
    const c = cloud()
    if (body.accion === 'firmar') {
      if (!c.nombre || !c.key || !c.secret) return NextResponse.json({ error: 'Falta configurar Cloudinary (ver instrucciones en la pantalla).' }, { status: 400 })
      const timestamp = Math.floor(Date.now() / 1000)
      const params = { folder: CARPETA_CLOUDINARY, timestamp }
      return NextResponse.json({ url: `https://api.cloudinary.com/v1_1/${c.nombre}/auto/upload`, api_key: c.key, timestamp, folder: CARPETA_CLOUDINARY, signature: firmar(params, c.secret) })
    }
    if (body.accion === 'guardar') {
      const m = body.medio || {}
      const url = String(m.url || '').trim()
      if (!/^https:\/\//.test(url)) return NextResponse.json({ error: 'Link inválido (tiene que empezar con https://).' }, { status: 400 })
      const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)
      const doc = {
        tipo: m.tipo === 'imagen' ? 'imagen' : 'video',
        nombre: String(m.nombre || 'Sin nombre').trim().slice(0, 80),
        origen: m.origen === 'cloudinary' ? 'cloudinary' : 'link',
        url: url.slice(0, 600),
        publicId: typeof m.publicId === 'string' ? m.publicId.slice(0, 200) : null,
        duracion: n(m.duracion),
        ancho: n(m.ancho),
        alto: n(m.alto),
        bytes: n(m.bytes),
        publicacionId: typeof m.publicacionId === 'string' && m.publicacionId ? m.publicacionId : null,
        editadoDe: typeof m.editadoDe === 'string' && m.editadoDe ? m.editadoDe : null,
        createdAt: new Date().toISOString(),
      }
      const ref = await getDb().collection('mediosMarketing').add(doc)
      return NextResponse.json({ medio: { id: ref.id, ...doc } })
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/medios', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const body = await req.json()
    const cambios: Record<string, unknown> = {}
    if (typeof body.nombre === 'string') cambios.nombre = body.nombre.trim().slice(0, 80) || 'Sin nombre'
    if (body.publicacionId !== undefined) cambios.publicacionId = body.publicacionId || null
    await getDb().collection('mediosMarketing').doc(String(body.id || '')).update(cambios)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/medios', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!esAdmin(req)) return noAutorizado()
  try {
    const ref = getDb().collection('mediosMarketing').doc(req.nextUrl.searchParams.get('id') || '')
    const doc = await ref.get()
    const m = doc.data() as any
    const c = cloud()
    // Solo se borra de Cloudinary el original (las ediciones son la misma pieza con otra URL).
    if (m?.origen === 'cloudinary' && m.publicId && !m.editadoDe && c.nombre && c.key && c.secret) {
      const otros = await getDb().collection('mediosMarketing').where('publicId', '==', m.publicId).get()
      if (otros.size <= 1) {
        const timestamp = Math.floor(Date.now() / 1000)
        const form = new URLSearchParams({ public_id: m.publicId, timestamp: String(timestamp), api_key: c.key, signature: firmar({ public_id: m.publicId, timestamp }, c.secret) })
        await fetch(`https://api.cloudinary.com/v1_1/${c.nombre}/${m.tipo === 'imagen' ? 'image' : 'video'}/destroy`, { method: 'POST', body: form }).catch(() => null)
      }
    }
    await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/medios', err)
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 })
  }
}
