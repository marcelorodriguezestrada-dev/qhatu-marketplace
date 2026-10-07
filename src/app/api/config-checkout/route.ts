import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { OPCIONES_CHECKOUT_DEFECTO, sanearOpciones } from '@/lib/opcionesCheckout'

export const dynamic = 'force-dynamic'

// GET → { opciones } (público: el checkout lo lee para saber qué mostrar).
export async function GET() {
  try {
    const d = await getDb().collection('config').doc('checkout').get()
    return NextResponse.json({ opciones: d.exists ? sanearOpciones(d.data()) : OPCIONES_CHECKOUT_DEFECTO })
  } catch {
    return NextResponse.json({ opciones: OPCIONES_CHECKOUT_DEFECTO })
  }
}
