import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { SITE_URL } from '@/lib/anuncioPublico'
import { buscarCiudad } from '@/data/ciudades'
import { gentilicioDe } from '@/lib/marketingAdmin'

export const dynamic = 'force-dynamic'

// Volante / imagen para redes (Admin → Marketing), con el estilo de
// Clasi Click: franja roja, logo, dos columnas y un QR con el link de la
// campaña (?c=) para medir cuánta gente entra por el volante.
// ?tipo=general|vendedores|profesionales &ciudad= &formato=post|cuadrado|historia
// &t= (título) &s= (subtítulo) &c= (código de campaña)

const ROJO = '#C41E2A'
const ROJO_OSCURO = '#95131F'

type Caja = { titulo: string; bajada: string; items: string[]; color: string }

function contenido(tipo: string, ciudad: string, gentilicio: string) {
  const C = ciudad.toUpperCase()
  if (tipo === 'vendedores') {
    return {
      titulo: `¿VENDÉS EN ${C}?`,
      subtitulo: 'Publicá gratis y llegá|a más clientes',
      bajada: `La tienda online ${gentilicio}|que trabaja por vos`,
      cajas: [
        { titulo: 'TU TIENDA GRATIS', bajada: 'Sin comisiones para empezar', items: ['Catálogo con fotos y precios', 'Cobrás directo con tu QR', 'Publicación masiva con Excel'], color: ROJO },
        { titulo: 'MÁS CLIENTES', bajada: 'Te conectamos al instante', items: ['Matcheo automático con quien busca', 'Preguntas y ventas en un lugar', 'Coordiná la entrega por WhatsApp'], color: ROJO_OSCURO },
      ] as Caja[],
      cta: 'Registrate gratis y empezá a vender hoy',
      pie: `Vendé en ${ciudad} — fácil, rápido y seguro`,
    }
  }
  if (tipo === 'profesionales') {
    return {
      titulo: `¡PROFESIONALES DE ${C}!`,
      subtitulo: 'Que tus clientes|te encuentren',
      bajada: `El directorio ${gentilicio}|de profesionales y oficios`,
      cajas: [
        { titulo: 'SI OFRECÉS SERVICIOS', bajada: 'Sumate gratis', items: ['Tu perfil con fotos y reseñas', 'Clientes directo a tu WhatsApp', 'Agenda de turnos online'], color: ROJO },
        { titulo: 'SI BUSCÁS A ALGUIEN', bajada: 'Encontrá de confianza', items: ['Electricistas, médicos, abogados…', 'Calificaciones reales', 'Cerca de tu zona'], color: ROJO_OSCURO },
      ] as Caja[],
      cta: 'Anotate gratis en 2 minutos',
      pie: `Profesionales de ${ciudad} en un solo lugar`,
    }
  }
  return {
    titulo: `¡ATENCIÓN ${C}!`,
    subtitulo: 'Llegó la nueva forma de|comprar y vender sin complicaciones',
    bajada: `El primer e-commerce 100% ${gentilicio}|hecho para conectar a nuestra gente`,
    cajas: [
      { titulo: 'SI QUIERES COMPRAR', bajada: 'Todo lo que buscás, en un solo lugar', items: ['Productos y servicios locales', 'Pagá fácil con QR', 'Entrega a domicilio o retiro'], color: ROJO },
      { titulo: 'SI QUIERES VENDER', bajada: 'Publicá y llegá a más clientes', items: ['Publicá tus productos gratis', 'Matcheo automático al instante', 'Coordiná la entrega por WhatsApp'], color: ROJO_OSCURO },
    ] as Caja[],
    cta: 'Apoyemos el comercio y el talento de nuestra tierra',
    pie: `Comprá y vendé en ${ciudad} — fácil, rápido y seguro`,
  }
}

const lineas = (t: string) => t.split('|').map((x) => x.trim()).filter(Boolean)

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const tipo = q.get('tipo') || 'general'
  const formato = q.get('formato') || 'post'
  const ciudadInfo = buscarCiudad(q.get('ciudad'))
  const W = 1080
  const H = formato === 'cuadrado' ? 1080 : formato === 'historia' ? 1920 : 1350
  const compacto = formato === 'cuadrado'
  const historia = formato === 'historia'
  // Tamaños: la historia tiene lugar de sobra; post y cuadrado van más ajustados.
  const T = historia
    ? { pad: '140px 60px 70px', tit: 74, sub: 36, logo: 112, baj: 34, cajaT: 30, cajaB: 25, item: 28, gap: 18, cta: 32, sitio: 36, qr: 210 }
    : compacto
      ? { pad: '40px 60px 34px', tit: 70, sub: 30, logo: 88, baj: 0, cajaT: 28, cajaB: 23, item: 26, gap: 10, cta: 28, sitio: 34, qr: 170 }
      : { pad: '44px 60px 38px', tit: 70, sub: 32, logo: 96, baj: 30, cajaT: 28, cajaB: 23, item: 26, gap: 12, cta: 30, sitio: 34, qr: 190 }
  const c = contenido(tipo, ciudadInfo.nombre, gentilicioDe(ciudadInfo.id))
  const titulo = (q.get('t') || c.titulo).slice(0, 40)
  const subtitulo = (q.get('s') || c.subtitulo).slice(0, 90)
  const codigo = (q.get('c') || '').replace(/[^a-z0-9-]/g, '').slice(0, 40)
  const destino = tipo === 'vendedores' ? '/vender' : tipo === 'profesionales' ? '/publicar-servicio' : '/'
  const link = `${SITE_URL}${destino}${codigo ? `?c=${codigo}` : ''}`
  const sitio = SITE_URL.replace(/^https?:\/\//, '')
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#1E2233', light: '#FFFFFF' } })

  const Punto = () => <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: ROJO, marginRight: 18, marginTop: 10, flexShrink: 0 }} />

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#F8F7F4', fontFamily: 'sans-serif' }}>
        {/* Franja roja */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: ROJO, color: '#FFFFFF', padding: T.pad }}>
          <div style={{ display: 'flex', fontSize: titulo.length > 22 ? T.tit - 16 : T.tit, fontWeight: 800, textAlign: 'center' }}>{titulo}</div>
          {lineas(subtitulo).map((l) => (
            <div key={l} style={{ display: 'flex', fontSize: T.sub, marginTop: 6 }}>{l}</div>
          ))}
        </div>

        {/* Logo y bajada */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: historia ? '40px 60px 20px' : '18px 60px 10px' }}>
          <div style={{ display: 'flex', fontSize: T.logo, fontWeight: 800, color: ROJO, lineHeight: 1.1 }}>Clasi Click</div>
          {!compacto &&
            lineas(c.bajada).map((l) => (
              <div key={l} style={{ display: 'flex', fontSize: T.baj, fontStyle: 'italic', color: '#1E2233' }}>{l}</div>
            ))}
        </div>

        {/* Dos columnas */}
        <div style={{ display: 'flex', padding: '10px 60px', gap: 30 }}>
          {c.cajas.map((caja) => (
            <div key={caja.titulo} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#FFFFFF', borderRadius: 28, border: '2px solid #E5E0D8', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'center', background: caja.color, color: '#FFFFFF', fontSize: T.cajaT, fontWeight: 800, padding: historia ? '22px 10px' : '16px 10px' }}>{caja.titulo}</div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: historia ? '26px 34px 34px' : '14px 28px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', fontSize: T.cajaB, color: '#6B6E7B', marginBottom: historia ? 18 : 10, textAlign: 'center' }}>{caja.bajada}</div>
                {caja.items.map((it) => (
                  <div key={it} style={{ display: 'flex', fontSize: T.item, color: '#1E2233', marginBottom: T.gap, lineHeight: 1.2 }}>
                    <Punto />
                    <div style={{ display: 'flex', flex: 1 }}>{it}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Llamado a la acción + QR */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: historia ? '36px 60px 40px' : '16px 60px 22px' }}>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', background: ROJO, borderRadius: 28, padding: historia ? '30px 36px' : '20px 28px', color: '#FFFFFF' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 28 }}>
              <div style={{ display: 'flex', fontSize: T.cta, fontWeight: 800, marginBottom: 14 }}>{c.cta}</div>
              <div style={{ display: 'flex', justifyContent: 'center', background: '#FFFFFF', color: ROJO, borderRadius: 50, fontSize: T.sitio, fontWeight: 800, padding: '12px 20px' }}>{sitio}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 20, padding: 12 }}>
              <img src={qr} width={T.qr} height={T.qr} />
              <div style={{ display: 'flex', fontSize: 18, color: '#1E2233', marginTop: 4 }}>Escaneá y entrá</div>
            </div>
          </div>
        </div>

        {!compacto && (
          <div style={{ display: 'flex', justifyContent: 'center', fontSize: 28, fontStyle: 'italic', color: '#6B6E7B', paddingBottom: historia ? 140 : 26 }}>{c.pie}</div>
        )}
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
  )
}
