import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'
import { sumarEstadisticaUsuario } from '@/lib/estadisticasUsuario'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama cuando alguien toca
// "Contactar" en la ficha de un producto. Mismo esquema que
// /api/profesionales/[id]/click-whatsapp: solo suma +1 a un contador
// en el vendedor, no guarda quién lo tocó.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getDb().collection('vendedores').doc(params.id).set(
      { clicsWhatsapp: FieldValue.increment(1) },
      { merge: true }
    )
    sumarMetricaDiaria('clicsWhatsappVendedor').catch(() => {})
    // La ficha manda de qué producto vino el contacto (/mis-estadisticas).
    const body = await req.json().catch(() => ({}))
    await sumarEstadisticaUsuario(params.id, 'p', body?.productoId || 'general', 'contactos')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}
