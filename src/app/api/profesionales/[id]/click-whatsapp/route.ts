import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'
import { sumarEstadisticaUsuario } from '@/lib/estadisticasUsuario'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama cuando alguien toca
// "Contactar por WhatsApp" en el perfil de un profesional. Solo suma
// +1 a un contador; no guarda quién lo tocó.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ref = getDb().collection('profesionales').doc(params.id)
    await ref.update({ clicsWhatsapp: FieldValue.increment(1) })
    sumarMetricaDiaria('clicsWhatsapp').catch(() => {})
    await sumarEstadisticaUsuario((await ref.get()).get('solicitanteUid'), 's', params.id, 'contactos')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}
