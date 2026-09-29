import { ImageResponse } from 'next/og'
import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/anuncioPublico'

export const dynamic = 'force-dynamic'

// Imagen lista para redes sociales de un producto (/vender → Marketing):
// foto, precio, descuento, tienda y el logo de Clasi Click.
// ?formato=cuadrado (1080x1080, posts) | vertical (1080x1920, estados e
// historias). La foto se baja acá y va embebida; si no se puede (ImgBB
// caído, formato no soportado), sale igual sin foto.

async function fotoComoDataUrl(url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const tipo = (res.headers.get('content-type') || '').split(';')[0]
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(tipo)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 6 * 1024 * 1024) return null
    return `data:${tipo};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const vertical = new URL(req.url).searchParams.get('formato') === 'vertical'
  const W = 1080
  const H = vertical ? 1920 : 1080

  let nombre = 'Clasi Click'
  let precio = 0
  let antes = 0
  let tienda = ''
  let foto: string | null = null
  let pocas = 0
  try {
    const doc = await getDb().collection('productos').doc(params.id).get()
    const p = doc.exists ? (doc.data() as any) : null
    if (p) {
      nombre = String(p.nombre || '').slice(0, 80)
      precio = Number(p.precio || 0)
      antes = p.precioOriginal && Number(p.precioOriginal) > precio ? Number(p.precioOriginal) : 0
      tienda = String(p.tiendaNombre || '').slice(0, 40)
      if (typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3) pocas = p.stock
      foto = (await fotoComoDataUrl(p.imagenUrl || '')) || (await fotoComoDataUrl(p.thumbUrl || ''))
    }
  } catch {}

  const bs = (n: number) => `Bs ${n.toLocaleString('es-BO')}`
  const pct = antes ? Math.round((1 - precio / antes) * 100) : 0
  const sitio = SITE_URL.replace(/^https?:\/\//, '')
  const altoFoto = vertical ? 1080 : 560
  const nombreCorto = !vertical && nombre.length > 60 ? nombre.slice(0, 58).trim() + '…' : nombre

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#F1ECE0', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: vertical ? '90px 60px 30px' : '34px 50px 20px' }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#A23B2E' }}>Clasi Click</div>
          {tienda && <div style={{ display: 'flex', fontSize: 30, color: '#1E2233', background: '#FFFFFF', padding: '10px 22px', borderRadius: 40 }}>{tienda}</div>}
        </div>

        <div style={{ display: 'flex', position: 'relative', margin: vertical ? '0 60px' : '0 50px', height: altoFoto, background: '#FFFFFF', borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {foto ? (
            <img src={foto} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#E5DCC8' }}>Clasi Click</div>
          )}
          {pct > 0 && (
            <div style={{ display: 'flex', position: 'absolute', top: 28, left: 28, background: '#2F6E5C', color: '#FFFFFF', fontSize: 46, fontWeight: 800, padding: '12px 26px', borderRadius: 20 }}>
              -{pct}%
            </div>
          )}
          {pocas > 0 && (
            <div style={{ display: 'flex', position: 'absolute', bottom: 28, left: 28, background: '#A23B2E', color: '#FFFFFF', fontSize: 34, fontWeight: 700, padding: '10px 22px', borderRadius: 18 }}>
              {pocas === 1 ? '¡Última unidad!' : `¡Quedan ${pocas}!`}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: vertical ? '50px 70px' : '20px 60px' }}>
          <div style={{ display: 'flex', fontSize: vertical ? (nombre.length > 45 ? 54 : 64) : nombreCorto.length > 32 ? 42 : 54, fontWeight: 700, color: '#1E2233', lineHeight: 1.15 }}>{nombreCorto}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: vertical ? 16 : 8 }}>
            <div style={{ display: 'flex', fontSize: vertical ? 96 : 72, fontWeight: 800, color: '#A23B2E' }}>{bs(precio)}</div>
            {antes > 0 && <div style={{ display: 'flex', fontSize: 44, color: '#8A8D99', textDecoration: 'line-through', marginLeft: 24 }}>{bs(antes)}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1E2233', color: '#FFFFFF', padding: vertical ? '44px 60px 110px' : '26px 50px' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>Pedilo en {sitio}</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#E9C46A' }}>Pago con QR · Envío a domicilio</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600' } }
  )
}
