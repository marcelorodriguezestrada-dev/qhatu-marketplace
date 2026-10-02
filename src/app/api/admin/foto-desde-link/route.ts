import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Baja una foto desde un link (Google Drive compartido o cualquier web) y
// la sube a ImgBB. Para la columna "foto" de la importación desde Google
// Sheets. POST { url } → { url, thumbUrl }

// Links de Drive (…/file/d/ID/view, open?id=ID, uc?id=ID) → descarga directa.
function linkDirecto(u: string) {
  const id = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([a-zA-Z0-9_-]{10,})/)?.[1]
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : u
}

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  if (!process.env.IMGBB_API_KEY) return NextResponse.json({ error: 'Falta configurar IMGBB_API_KEY en el servidor.' }, { status: 500 })
  const { url } = await req.json().catch(() => ({}))
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return NextResponse.json({ error: 'Link de foto inválido.' }, { status: 400 })
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(linkDirecto(url.trim()), { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    const tipo = (res.headers.get('content-type') || '').split(';')[0]
    if (!res.ok || !tipo.startsWith('image/')) {
      return NextResponse.json({ error: url.includes('drive.google') ? 'La foto de Drive no es pública: compartila como “Cualquier persona con el enlace”.' : 'Ese link no es una foto.' }, { status: 400 })
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'La foto pesa más de 15 MB.' }, { status: 400 })
    const body = new URLSearchParams()
    body.append('key', process.env.IMGBB_API_KEY)
    body.append('image', buf.toString('base64'))
    const d = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body }).then((r) => r.json())
    if (!d.success) return NextResponse.json({ error: d.error?.message || 'ImgBB rechazó la foto.' }, { status: 502 })
    return NextResponse.json({ url: d.data.url, thumbUrl: d.data.medium?.url || d.data.thumb?.url || d.data.url })
  } catch (err) {
    console.error('POST /api/admin/foto-desde-link', err)
    return NextResponse.json({ error: 'No se pudo bajar la foto.' }, { status: 502 })
  }
}
