import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearOpciones } from '@/lib/opcionesCheckout'

export const dynamic = 'force-dynamic'

// PUT { opciones } → guarda qué opciones se muestran en el checkout.
export async function PUT(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const opciones = sanearOpciones(b.opciones)
  await getDb().collection('config').doc('checkout').set(opciones)
  return NextResponse.json({ ok: true, opciones })
}
