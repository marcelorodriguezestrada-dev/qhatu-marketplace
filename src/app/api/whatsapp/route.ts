import { NextRequest, NextResponse } from 'next/server'
import { firmaValida, registrarEstadoBot, whatsappConfigurado } from '@/lib/whatsappApi'
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
  const ahora = new Date().toISOString()
  if (!whatsappConfigurado()) {
    await registrarEstadoBot({ ultimoRechazo: { at: ahora, motivo: 'Faltan variables en el servidor (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_APP_SECRET). Cargalas en Vercel y hacé Redeploy.' } })
    return NextResponse.json({ error: 'Bot sin configurar.' }, { status: 503 })
  }
  if (!firmaValida(crudo, req.headers.get('x-hub-signature-256'))) {
    await registrarEstadoBot({ ultimoRechazo: { at: ahora, motivo: 'Firma inválida: WHATSAPP_APP_SECRET no coincide con la clave secreta de la app de Meta (Configuración de la app → Básica).' } })
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 })
  }
  let body: any
  try {
    body = JSON.parse(crudo)
  } catch {
    return NextResponse.json({ ok: true })
  }
  const mensajes: MensajeWhatsapp[] = []
  for (const entrada of body?.entry || []) for (const cambio of entrada?.changes || []) {
    for (const m of cambio?.value?.messages || []) if (m?.id && m?.from) mensajes.push(m)
    // Respuestas que Meta no pudo entregar (ej. número fuera de la lista de prueba).
    for (const st of cambio?.value?.statuses || []) {
      if (st?.status === 'failed') {
        const e = st.errors?.[0] || {}
        await registrarEstadoBot({ ultimoErrorEnvio: { at: ahora, a: st.recipient_id, status: e.code || 'failed', texto: [e.title, e.message, e.error_data?.details].filter(Boolean).join(' — ').slice(0, 400) } })
      }
    }
  }
  await registrarEstadoBot({ ultimoAviso: { at: ahora, mensajes: mensajes.length, de: mensajes[0]?.from || null } })
  // Cómo llegó el último mensaje (tipo y campos), para ver qué manda WhatsApp
  // en casos raros (ej. un producto reenviado del catálogo).
  if (mensajes[0]) await registrarEstadoBot({ ultimoMensajeCrudo: { at: ahora, json: JSON.stringify(mensajes[0]).slice(0, 1500) } })
  // Uno por uno (del mismo número, en orden). Los avisos de "leído" / "entregado" no traen mensajes.
  for (const m of mensajes.slice(0, 10)) {
    try {
      await procesarMensaje(m)
    } catch (err) {
      console.error('whatsapp: procesarMensaje', err)
      await registrarEstadoBot({ ultimoErrorProceso: { at: new Date().toISOString(), de: m.from, texto: String((err as any)?.message || err).slice(0, 400) } })
    }
  }
  return NextResponse.json({ ok: true })
}
