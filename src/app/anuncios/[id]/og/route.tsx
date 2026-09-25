import { ImageResponse } from 'next/og'
import { labelTipoAnuncio } from '@/data/anuncios'
import { leerAnuncioPublico } from '@/lib/anuncioPublico'

export const dynamic = 'force-dynamic'

const COLOR_TIPO: Record<string, string> = { venta: '#2F6E5C', busqueda: '#C98A2B', aviso: '#A23B2E', otro: '#1E2233' }

// Imagen de vista previa (1200x630) para anuncios SIN foto: así el link
// compartido por WhatsApp no sale "pelado". Colores de la marca.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const anuncio = await leerAnuncioPublico(params.id)
  const titulo = anuncio ? String(anuncio.titulo || '').slice(0, 90) : 'Anuncios clasificados'
  const precio = anuncio?.precio ? `Bs ${Number(anuncio.precio).toLocaleString('es-BO')}` : ''
  const tipo = anuncio ? labelTipoAnuncio(anuncio.tipo) : 'Clasi Click'
  const color = COLOR_TIPO[anuncio?.tipo] || COLOR_TIPO.otro

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#F1ECE0', padding: 64 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ display: 'flex', background: color, color: '#fff', fontSize: 30, fontWeight: 700, padding: '10px 26px', borderRadius: 999 }}>{tipo}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {precio && <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#1E2233', marginBottom: 12 }}>{precio}</div>}
          <div style={{ display: 'flex', fontSize: titulo.length > 50 ? 56 : 68, fontWeight: 700, color: '#1E2233', lineHeight: 1.15 }}>{titulo}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, color: '#5B5F73' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#A23B2E' }}>Clasi Click</div>
          <div style={{ display: 'flex' }}>Anuncios en Potosí</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
  )
}
