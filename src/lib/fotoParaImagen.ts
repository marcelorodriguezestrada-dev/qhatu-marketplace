import sharp from 'sharp'

// Baja una foto (JPG, PNG, WebP, AVIF, GIF…) y la devuelve como JPG en
// data URL, achicada a `ancho` px, para meterla en una imagen armada con
// next/og (ImageResponse no lee WebP, que es como se comprimen las fotos
// al subirlas desde /vender). null si no se puede (ImgBB caído, etc.).
export async function fotoComoDataUrl(url: string, ancho = 1200): Promise<string | null> {
  if (!/^https:\/\//i.test(url || '')) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 12 * 1024 * 1024) return null
    const jpg = await sharp(buf).rotate().resize({ width: ancho, height: ancho, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer()
    return `data:image/jpeg;base64,${jpg.toString('base64')}`
  } catch {
    return null
  }
}

// PNG de ImageResponse → JPG liviano (WhatsApp y Facebook muestran mejor
// las vistas previas chicas).
export async function comoJpg(res: Response, calidad = 82): Promise<Response> {
  const png = Buffer.from(await res.arrayBuffer())
  const jpg = await sharp(png).jpeg({ quality: calidad }).toBuffer()
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } })
}
