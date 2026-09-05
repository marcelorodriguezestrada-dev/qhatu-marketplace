import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama cuando alguien toca
// "Contactar por WhatsApp" en el perfil de un profesional. Solo suma
// +1 a un contador; no guarda quién lo tocó.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getDb().collection('profesionales').doc(params.id).update({
      clicsWhatsapp: FieldValue.increment(1),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}
