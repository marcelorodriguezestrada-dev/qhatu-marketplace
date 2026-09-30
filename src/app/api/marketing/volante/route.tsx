import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { SITE_URL } from '@/lib/anuncioPublico'
import { buscarCiudad } from '@/data/ciudades'
import { gentilicioDe } from '@/lib/marketingAdmin'
import { buscarTema, decodificarConfig, destinoDeTipo, textosBase, type ConfigVolante } from '@/lib/volantes'

export const dynamic = 'force-dynamic'

// Volante / imagen para redes (Admin → Marketing) con un QR al link de
// la campaña (?c=) para medir cuánta gente entra por el volante.
// ?d=<config en base64url> (ver src/lib/volantes.ts), o los parámetros
// simples de antes: ?tipo=general|vendedores|profesionales &ciudad= &tema=
// &t= &s=. Siempre: &formato=post|cuadrado|historia &c=<campaña>.

async function imagenComoDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const tipo = (res.headers.get('content-type') || '').split(';')[0]
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(tipo)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return `data:${tipo};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

const lineas = (t: string) => t.split('|').map((x) => x.trim()).filter(Boolean)

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const formato = q.get('formato') || 'post'
  const W = 1080
  const H = formato === 'cuadrado' ? 1080 : formato === 'historia' ? 1920 : 1350
  const compacto = formato === 'cuadrado'
  const historia = formato === 'historia'

  let config: ConfigVolante | null = q.get('d') ? decodificarConfig(q.get('d')!) : null
  if (!config) {
    const tipo = q.get('tipo') || 'general'
    const ciudad = buscarCiudad(q.get('ciudad'))
    const textos = textosBase(tipo, ciudad.nombre, gentilicioDe(ciudad.id))
    if (q.get('t')) textos.titulo = q.get('t')!.slice(0, 40)
    if (q.get('s')) textos.subtitulo = q.get('s')!.slice(0, 90)
    config = { modo: 'diseno', tema: buscarTema(q.get('tema')).id, destino: destinoDeTipo(tipo), textos }
  }
  const tema = buscarTema(config.tema)
  const codigo = (q.get('c') || '').replace(/[^a-z0-9-]/g, '').slice(0, 40)
  const link = `${SITE_URL}${config.destino}${codigo ? `?c=${codigo}` : ''}`
  const sitio = SITE_URL.replace(/^https?:\/\//, '')
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: '#111111', light: '#FFFFFF' } })

  // ——— Diseño propio subido: la imagen de fondo + el QR encima ———
  if (config.modo === 'imagen') {
    const fondo = await imagenComoDataUrl(config.fondoUrl)
    const lado = Math.round((W * (config.qrTam || 22)) / 100)
    const pos = config.qrPos || 'abajo-derecha'
    const margen = 44
    const estiloPos: Record<string, any> = {
      'abajo-derecha': { right: margen, bottom: margen },
      'abajo-izquierda': { left: margen, bottom: margen },
      'arriba-derecha': { right: margen, top: margen },
      'arriba-izquierda': { left: margen, top: margen },
      'abajo-centro': { left: (W - lado - 24) / 2, bottom: margen },
    }
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#FFFFFF', fontFamily: 'sans-serif' }}>
          {fondo ? (
            <img src={fondo} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: W, height: H, alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#999' }}>No se pudo cargar tu imagen</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'absolute', ...estiloPos[pos], background: '#FFFFFF', borderRadius: 18, padding: 12, boxShadow: '0 4px 18px rgba(0,0,0,0.25)' }}>
            <img src={qr} width={lado} height={lado} />
            {config.mostrarLink !== false && <div style={{ display: 'flex', fontSize: Math.max(16, Math.round(lado / 11)), color: '#111', marginTop: 6 }}>{sitio}</div>}
          </div>
        </div>
      ),
      { width: W, height: H, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
    )
  }

  // ——— Nuestro diseño ———
  const tx = config.textos
  const logo = await imagenComoDataUrl(config.logoUrl)
  const T = historia
    ? { pad: '130px 60px 60px', tit: 74, sub: 36, logo: 112, logoImg: 190, baj: 34, cajaT: 30, cajaB: 25, item: 28, gap: 18, cta: 32, sitio: 36, qr: 210 }
    : compacto
      ? { pad: '36px 60px 30px', tit: 68, sub: 30, logo: 84, logoImg: 110, baj: 0, cajaT: 28, cajaB: 23, item: 26, gap: 10, cta: 28, sitio: 34, qr: 170 }
      : { pad: '40px 60px 34px', tit: 70, sub: 32, logo: 92, logoImg: 140, baj: 30, cajaT: 28, cajaB: 23, item: 26, gap: 12, cta: 30, sitio: 34, qr: 190 }
  const conFranja = !!tema.franja
  const Punto = () => <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: tema.punto, marginRight: 18, marginTop: 8, flexShrink: 0 }} />
  // Satori no apila bien los Fragment: el título va en su propia columna.
  const Titulo = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: W - 120 }}>
      <div style={{ display: 'flex', fontSize: tx.titulo.length > 22 ? T.tit - 16 : T.tit, fontWeight: 800, textAlign: 'center', color: conFranja ? tema.textoFranja : tema.titulo }}>{tx.titulo}</div>
      {lineas(tx.subtitulo).map((l) => (
        <div key={l} style={{ display: 'flex', fontSize: T.sub, marginTop: 6, textAlign: 'center', color: tema.subtitulo }}>{l}</div>
      ))}
    </div>
  )
  const Logo = logo ? (
    <img src={logo} height={T.logoImg} style={{ height: T.logoImg, objectFit: 'contain' }} />
  ) : (
    <div style={{ display: 'flex', fontSize: T.logo, fontWeight: 800, color: tema.logo, lineHeight: 1.1 }}>Clasi Click</div>
  )

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: tema.fondo, fontFamily: 'sans-serif' }}>
        {conFranja ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: tema.franja!, padding: T.pad }}>{Titulo}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: historia ? '40px 60px 20px' : '18px 60px 10px' }}>
              {Logo}
              {!compacto &&
                lineas(tx.bajada).map((l) => (
                  <div key={l} style={{ display: 'flex', fontSize: T.baj, fontStyle: 'italic', color: tema.bajada }}>{l}</div>
                ))}
            </div>
          </div>
        ) : (
          // Sin franja (ej. oscuro): logo arriba y el título sobre el fondo.
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: historia ? '110px 60px 30px' : compacto ? '26px 60px 14px' : '34px 60px 18px' }}>
            {Logo}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: compacto ? 10 : 22 }}>{Titulo}</div>
            {!compacto &&
              lineas(tx.bajada).map((l) => (
                <div key={l} style={{ display: 'flex', fontSize: T.baj, fontStyle: 'italic', color: tema.bajada, marginTop: 8 }}>{l}</div>
              ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-around' }}>
        <div style={{ display: 'flex', padding: '10px 60px', gap: 30 }}>
          {tx.cajas.map((caja, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: tema.caja, borderRadius: 28, border: `2px solid ${tema.bordeCaja}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', background: i === 0 ? tema.cabecera1 : tema.cabecera2, color: tema.textoCabecera, fontSize: T.cajaT, fontWeight: 800, padding: historia ? '22px 10px' : '16px 10px' }}>{caja.titulo}</div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: historia ? '26px 34px 34px' : '14px 28px 16px' }}>
                {caja.bajada && <div style={{ display: 'flex', justifyContent: 'center', fontSize: T.cajaB, color: tema.bajadaCaja, marginBottom: historia ? 18 : 10, textAlign: 'center' }}>{caja.bajada}</div>}
                {caja.items.map((it) => (
                  <div key={it} style={{ display: 'flex', fontSize: T.item, color: tema.item, marginBottom: T.gap, lineHeight: 1.2 }}>
                    <Punto />
                    <div style={{ display: 'flex', flex: 1 }}>{it}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: historia ? '36px 60px 40px' : '16px 60px 22px' }}>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', background: tema.cta, borderRadius: 28, padding: historia ? '30px 36px' : '20px 28px', color: tema.textoCta }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 28 }}>
              <div style={{ display: 'flex', fontSize: T.cta, fontWeight: 800, marginBottom: 14 }}>{tx.cta}</div>
              <div style={{ display: 'flex', justifyContent: 'center', background: tema.pastilla, color: tema.textoPastilla, borderRadius: 50, fontSize: T.sitio, fontWeight: 800, padding: '12px 20px' }}>{sitio}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 20, padding: 12 }}>
              <img src={qr} width={T.qr} height={T.qr} />
              <div style={{ display: 'flex', fontSize: 18, color: '#1E2233', marginTop: 4 }}>Escaneá y entrá</div>
            </div>
          </div>
        </div>
        </div>

        {!compacto && tx.pie && (
          <div style={{ display: 'flex', justifyContent: 'center', fontSize: 28, fontStyle: 'italic', color: tema.pie, paddingBottom: historia ? 140 : 26 }}>{tx.pie}</div>
        )}
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
  )
}
