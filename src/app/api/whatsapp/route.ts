import { NextRequest, NextResponse } from 'next/server'
import { firmaValida, whatsappConfigurado } from '@/lib/whatsappApi'
import { procesarMensaje, type MensajeWhatsapp } from '@/lib/whatsappBot'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Webhook del bot de WhatsApp (ver src/lib/whatsappBot.ts). En Meta →
// WhatsApp → Configuración: URL https://www.clasiclick.com/api/whatsapp,
// token de verificación = WHATSAPP_VERIFY_TOKEN, suscribirse a "messages".

// GET: Meta comprueba el webhook (devuelve hub.challenge si el token coincide).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (q.get('hub.mode') === 'subscribe' && token && q.get('hub.verify_token') === token) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'content-type': 'text/plain' } })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST: mensajes que llegan. Solo se aceptan los firmados por Meta.
export async function POST(req: NextRequest) {
  const crudo = await req.text()
  if (!whatsappConfigurado() || !firmaValida(crudo, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 })
  }
  let body: any
  try {
    body = JSON.parse(crudo)
  } catch {
    return NextResponse.json({ ok: true })
  }
  const mensajes: MensajeWhatsapp[] = []
  for (const entrada of body?.entry || []) for (const cambio of entrada?.changes || []) for (const m of cambio?.value?.messages || []) if (m?.id && m?.from) mensajes.push(m)
  // Uno por uno (del mismo número, en orden). Los avisos de "leído" / "entregado" no traen mensajes.
  for (const m of mensajes.slice(0, 10)) {
    try {
      await procesarMensaje(m)
    } catch (err) {
      console.error('whatsapp: procesarMensaje', err)
    }
  }
  return NextResponse.json({ ok: true })
}
