import sharp from 'sharp'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// /producto/{id}/foto — la foto del producto en JPG (1000px), para los
// catálogos de Google Shopping y Meta (las fotos se suben en WebP y no
// todas las plataformas lo aceptan).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const doc = await getDb().collection('productos').doc(params.id).get()
    const url = doc.exists ? String(doc.get('imagenUrl') || doc.get('thumbUrl') || '') : ''
    if (!/^https:\/\//i.test(url)) return new Response('Sin foto', { status: 404 })
    const res = await fetch(url)
    if (!res.ok) return new Response('Sin foto', { status: 404 })
    const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer()
    return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } })
  } catch {
    return new Response('Sin foto', { status: 404 })
  }
}
