import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET público — el checkout lo usa para saber a qué QR/CBU pagarle a
// este vendedor en particular. Si el vendedor todavía no configuró su
// cobro, devolvemos "configurado: false" y el checkout cae al QR
// genérico de la plataforma como respaldo.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const doc = await db.collection('vendedores').doc(params.id).get()
    if (!doc.exists) {
      return NextResponse.json({ configurado: false })
    }
    const data = doc.data() as any
    if (!data.qrImageUrl && !data.cbu) {
      return NextResponse.json({ configurado: false })
    }
    return NextResponse.json({
      configurado: true,
      qrImageUrl: data.qrImageUrl || '',
      cbu: data.cbu || '',
      nombreNegocio: data.nombreNegocio || '',
    })
  } catch (err) {
    console.error('GET /api/vendedores/[id]', err)
    return NextResponse.json({ configurado: false })
  }
}

// GET propio con detalle completo para precargar el formulario en
// /vender — el mismo endpoint de arriba ya alcanza para eso en
// realidad (es público), así que no hace falta una ruta separada.
