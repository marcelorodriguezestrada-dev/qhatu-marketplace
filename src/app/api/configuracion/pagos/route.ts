import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { esClaveAdmin } from '@/lib/adminAuth'
import { enCache, olvidarCache } from '@/lib/cacheLecturas'

export const dynamic = 'force-dynamic'

// GET — público: lo consume /checkout para saber a qué QR/cuenta se
// paga en los pedidos con envío. Si el admin todavía no cargó nada
// acá, devuelve vacío y el checkout cae al .env como respaldo (así no
// se rompe nada mientras tanto).
export async function GET() {
  try {
    // Casi nunca cambia y se pide en cada checkout: 1 minuto en memoria.
    const data = await enCache('configuracion/pagos', 60_000, async () => (await getDb().collection('configuracion').doc('pagos').get()).data() || null)
    if (!data) return NextResponse.json({ qrImageUrl: '', cbu: '', banco: '', titular: '', whatsapp: '' })
    return NextResponse.json({
      qrImageUrl: data.qrImageUrl || '',
      cbu: data.cbu || '',
      banco: data.banco || '',
      titular: data.titular || '',
      whatsapp: data.whatsapp || '',
    })
  } catch (err) {
    console.error('GET /api/configuracion/pagos', err)
    return NextResponse.json({ qrImageUrl: '', cbu: '', banco: '', titular: '', whatsapp: '' })
  }
}

// POST — solo admin: sube/actualiza el QR y los datos de cuenta que
// se usan para cobrar los pedidos con envío de TODA la plataforma
// (ver checkout/page.tsx: con envío siempre se paga acá, nunca al
// vendedor directo — se le libera la plata después de confirmar la
// entrega).
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!(await esClaveAdmin(password))) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { qrImageUrl, cbu, banco, titular, whatsapp } = body
    await getDb().collection('configuracion').doc('pagos').set(
      {
        qrImageUrl: qrImageUrl || '',
        cbu: cbu || '',
        banco: banco || '',
        titular: titular || '',
        whatsapp: whatsapp || '',
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true }
    )
    olvidarCache('configuracion/pagos')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/configuracion/pagos', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
