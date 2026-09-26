import { ImageResponse } from 'next/og'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Imagen de vista previa (1200x630) para productos sin foto.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let nombre = 'Clasi Click'
  let precio = ''
  let vendedor = ''
  try {
    const doc = await getDb().collection('productos').doc(params.id).get()
    const p = doc.exists ? doc.data()! : null
    if (p && (!p.estado || p.estado === 'activo')) {
      nombre = String(p.nombre || '').slice(0, 90)
      precio = p.precio ? `Bs ${Number(p.precio).toLocaleString('es-BO')}` : ''
      vendedor = String(p.vendedor || '').slice(0, 40)
    }
  } catch {}

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#F1ECE0', padding: 64 }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#5B5F73' }}>{vendedor || 'Tienda online de Potosí'}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {precio && <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#A23B2E', marginBottom: 12 }}>{precio}</div>}
          <div style={{ display: 'flex', fontSize: nombre.length > 50 ? 56 : 68, fontWeight: 700, color: '#1E2233', lineHeight: 1.15 }}>{nombre}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#A23B2E' }}>Clasi Click</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#2F6E5C' }}>Envío a domicilio en Potosí</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
  )
}
