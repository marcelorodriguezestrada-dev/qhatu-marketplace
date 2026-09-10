import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'

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
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}
