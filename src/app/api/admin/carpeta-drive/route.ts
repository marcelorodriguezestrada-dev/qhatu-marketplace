import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Lista las fotos de una carpeta de Google Drive compartida como
// "Cualquier persona con el enlace" (y de sus subcarpetas: una por tienda),
// para armar la planilla de productos. Sin login: usa la vista pública de
// la carpeta, o la API de Drive si hay GOOGLE_API_KEY.
// POST { url } → { carpeta, fotos: [{ id, nombre, ruta }] }

type Item = { id: string; nombre: string; carpeta: boolean }
const MAX_FOTOS = 2000
const NO_FOTO = /\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|rar|mp4|mov|avi|mkv|mp3|wav)$/i

const entidades = (t: string) =>
  t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

async function conApi(id: string, key: string): Promise<{ nombre: string; items: Item[] }> {
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&key=${key}`).then((r) => (r.ok ? r.json() : null))
  if (!meta) throw new Error('privada')
  const items: Item[] = []
  let page = ''
  do {
    const q = encodeURIComponent(`'${id}' in parents and trashed = false`)
    const d = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&key=${key}${page ? `&pageToken=${page}` : ''}`).then((r) => r.json())
    for (const f of d.files || []) {
      const carpeta = f.mimeType === 'application/vnd.google-apps.folder'
      if (carpeta || String(f.mimeType).startsWith('image/')) items.push({ id: f.id, nombre: f.name, carpeta })
    }
    page = d.nextPageToken || ''
  } while (page)
  return { nombre: meta.name, items }
}

// Vista pública de la carpeta (la que usa Drive para insertar carpetas en webs).
async function sinApi(id: string): Promise<{ nombre: string; items: Item[] }> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { redirect: 'follow' })
  const html = await res.text()
  if (!res.ok || !html.includes('flip-entries')) throw new Error('privada')
  const nombre = entidades(html.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim()
  const items: Item[] = []
  for (const bloque of html.split('class="flip-entry"').slice(1)) {
    const fid = bloque.match(/id="entry-([\w-]+)"/)?.[1]
    const href = bloque.match(/href="([^"]+)"/)?.[1] || ''
    const titulo = entidades(bloque.match(/class="flip-entry-title">([^<]*)</)?.[1] || '').trim()
    if (!fid || !titulo) continue
    const carpeta = /\/folders\//.test(href)
    if (!carpeta && NO_FOTO.test(titulo)) continue
    items.push({ id: fid, nombre: titulo, carpeta })
  }
  return { nombre, items }
}

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const { url } = await req.json().catch(() => ({}))
  const id = String(url || '').match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=|embeddedfolderview\?id=)([a-zA-Z0-9_-]{10,})/)?.[1]
  if (!id) return NextResponse.json({ error: 'Pegá el link de una carpeta de Drive (drive.google.com/drive/folders/…).' }, { status: 400 })
  const key = process.env.GOOGLE_API_KEY
  const listar = (fid: string) => (key ? conApi(fid, key) : sinApi(fid))
  try {
    const raiz = await listar(id)
    const fotos: { id: string; nombre: string; ruta: string }[] = []
    // La carpeta y hasta 2 niveles de subcarpetas (Productos/tienda/…).
    const recorrer = async (items: Item[], camino: string, nivel: number) => {
      for (const it of items) {
        if (fotos.length >= MAX_FOTOS) return
        if (!it.carpeta) fotos.push({ id: it.id, nombre: it.nombre, ruta: `${camino}/${it.nombre}` })
        else if (nivel < 2) {
          const sub = await listar(it.id).catch(() => null)
          if (sub) await recorrer(sub.items, `${camino}/${it.nombre}`, nivel + 1)
        }
      }
    }
    await recorrer(raiz.items, raiz.nombre || 'Drive', 0)
    if (!fotos.length) return NextResponse.json({ error: 'La carpeta no tiene fotos (o las subcarpetas no están compartidas).' }, { status: 400 })
    return NextResponse.json({ carpeta: raiz.nombre, fotos })
  } catch (err: any) {
    if (err?.message === 'privada') {
      return NextResponse.json({ error: 'No pudimos abrir la carpeta. En Drive: clic derecho en la carpeta → Compartir → Acceso general → “Cualquier persona con el enlace” (Lector), y volvé a probar.' }, { status: 400 })
    }
    console.error('POST /api/admin/carpeta-drive', err)
    return NextResponse.json({ error: 'No se pudo leer la carpeta de Drive. Probá de nuevo.' }, { status: 502 })
  }
}
