import crypto from 'crypto'

// API oficial de WhatsApp (WhatsApp Cloud API, de Meta) para el bot de
// Clasi Click (ver src/lib/whatsappBot.ts). Variables del servidor:
//   WHATSAPP_TOKEN            token permanente (usuario del sistema)
//   WHATSAPP_PHONE_NUMBER_ID  id del número que responde
//   WHATSAPP_APP_SECRET       para verificar que el aviso viene de Meta
//   WHATSAPP_VERIFY_TOKEN     palabra que se pone al configurar el webhook
//   WHATSAPP_ADMINS           números del admin (ej. 59171234567,5491122334455)
//   WHATSAPP_GRAPH_VERSION    opcional (por defecto v23.0)

const graph = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'}`

export const whatsappConfigurado = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET)

// La firma X-Hub-Signature-256 ("sha256=…") del cuerpo crudo, con el App Secret.
export function firmaValida(cuerpo: string, firma: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET
  if (!secreto || !firma?.startsWith('sha256=')) return false
  const esperada = crypto.createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex')
  const a = Buffer.from(firma.slice(7), 'hex')
  const b = Buffer.from(esperada, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const soloDigitos = (n: unknown) => String(n || '').replace(/\D/g, '')

export function esAdminWhatsapp(numero: string) {
  return (process.env.WHATSAPP_ADMINS || '').split(/[,\s]+/).map(soloDigitos).filter(Boolean).includes(soloDigitos(numero))
}

// Argentina y México: WhatsApp manda el número con un 9 / 1 extra
// (549… / 521…), pero para responder Meta lo quiere sin él (es como lo
// guarda en la lista de destinatarios del número de prueba).
export function destinoParaEnviar(numero: string) {
  const n = soloDigitos(numero)
  if (/^549\d{10}$/.test(n)) return `54${n.slice(3)}`
  if (/^521\d{10}$/.test(n)) return `52${n.slice(3)}`
  return n
}

async function enviar(cuerpo: Record<string, unknown>) {
  if (typeof cuerpo.to === 'string') cuerpo = { ...cuerpo, to: destinoParaEnviar(cuerpo.to) }
  try {
    const r = await fetch(`${graph()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
    })
    if (!r.ok) console.error('whatsapp: enviar', r.status, (await r.text()).slice(0, 300))
  } catch (err) {
    console.error('whatsapp: enviar', err)
  }
}

export const enviarTexto = (to: string, texto: string) => enviar({ to, type: 'text', text: { body: texto.slice(0, 4000), preview_url: false } })

// Mensaje con botones de respuesta rápida (máx. 3, título de hasta 20 caracteres).
export function enviarBotones(to: string, texto: string, botones: { id: string; titulo: string }[]) {
  return enviar({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: texto.slice(0, 1000) },
      action: { buttons: botones.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo.slice(0, 20) } })) },
    },
  })
}

// Foto que mandaron: primero se pide su link (dura unos minutos) y después se baja con el token.
export async function bajarMedia(mediaId: string): Promise<{ buf: Buffer; tipo: string }> {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
  const info = await fetch(`${graph()}/${mediaId}`, { headers: auth }).then((r) => r.json())
  if (!info?.url) throw new Error('No se pudo obtener la foto de WhatsApp.')
  const r = await fetch(info.url, { headers: auth })
  if (!r.ok) throw new Error(`No se pudo bajar la foto (${r.status}).`)
  return { buf: Buffer.from(await r.arrayBuffer()), tipo: String(info.mime_type || r.headers.get('content-type') || 'image/jpeg') }
}

export async function subirAImgbb(buf: Buffer): Promise<{ url: string; thumbUrl: string }> {
  if (!process.env.IMGBB_API_KEY) throw new Error('Falta IMGBB_API_KEY.')
  const body = new URLSearchParams()
  body.append('key', process.env.IMGBB_API_KEY)
  body.append('image', buf.toString('base64'))
  const d = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body }).then((r) => r.json())
  if (!d?.success) throw new Error(d?.error?.message || 'ImgBB rechazó la foto.')
  return { url: d.data.url, thumbUrl: d.data.medium?.url || d.data.thumb?.url || d.data.url }
}
