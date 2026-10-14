import { ImageResponse } from 'next/og'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { getDb } from '@/lib/firebaseAdmin'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { comoJpg, fotoComoDataUrl } from '@/lib/fotoParaImagen'

export const dynamic = 'force-dynamic'

// Vista previa (1200x630, JPG) de un producto al compartir el link por
// Facebook / WhatsApp: la foto (convertida a JPG, porque las fotos se suben
// en WebP y no todas las redes la leen) con nombre, precio y tienda.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await cargarCiudadesServidor().catch(() => null) // nombres de las ciudades agregadas desde el admin
  let nombre = 'Clasi Click'
  let precio = ''
  let antes = ''
  let tienda = ''
  let ciudad = 'Potosí'
  let foto: string | null = null
  try {
    const doc = await getDb().collection('productos').doc(params.id).get()
    const p = doc.exists ? doc.data()! : null
    if (p && (!p.estado || p.estado === 'activo')) {
      const pais = paisDeCiudad(ciudadDe(p))
      nombre = String(p.nombre || '').slice(0, 90)
      precio = p.precio ? formatoMoneda(Number(p.precio), pais) : ''
      antes = p.precioOriginal && Number(p.precioOriginal) > Number(p.precio) ? formatoMoneda(Number(p.precioOriginal), pais) : ''
      tienda = String(p.tiendaNombre || p.vendedor || '').slice(0, 40)
      ciudad = buscarCiudad(ciudadDe(p)).nombre
      foto = (await fotoComoDataUrl(p.imagenUrl || '', 900)) || (await fotoComoDataUrl(p.thumbUrl || '', 900))
    }
  } catch {}

  const img = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F1ECE0', fontFamily: 'sans-serif' }}>
        {foto && (
          <div style={{ display: 'flex', width: 630, height: 630, background: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <img src={foto} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: foto ? 48 : 64 }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#5B5F73' }}>{tienda || `Tienda online de ${ciudad}`}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: foto ? (nombre.length > 40 ? 40 : 48) : nombre.length > 50 ? 56 : 68, fontWeight: 700, color: '#1E2233', lineHeight: 1.15, marginBottom: 18 }}>{nombre}</div>
            {antes && <div style={{ display: 'flex', fontSize: 30, color: '#5B5F73', textDecoration: 'line-through' }}>{antes}</div>}
            {precio && <div style={{ display: 'flex', fontSize: foto ? 64 : 72, fontWeight: 800, color: '#A23B2E' }}>{precio}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 26, color: '#2F6E5C', marginBottom: 8 }}>Pagá con QR · Envío en {ciudad}</div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>
              <span style={{ color: '#0D1526' }}>Clasi</span>
              <span style={{ color: '#16C35B' }}>Click</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
  return comoJpg(img)
}
