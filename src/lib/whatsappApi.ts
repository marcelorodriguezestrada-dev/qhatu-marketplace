import crypto from 'crypto'
import { getDb } from '@/lib/firebaseAdmin'

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

// Diagnóstico para Admin → Productos → "📲 Bot de WhatsApp": lo último que
// pasó (aviso de Meta, rechazo, error al responder) en config/whatsappBot.
export async function registrarEstadoBot(campos: Record<string, unknown>) {
  try {
    await getDb().collection('config').doc('whatsappBot').set(campos, { merge: true })
  } catch {}
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
    if (!r.ok) {
      const texto = (await r.text()).slice(0, 400)
      console.error('whatsapp: enviar', r.status, texto)
      await registrarEstadoBot({ ultimoErrorEnvio: { at: new Date().toISOString(), a: cuerpo.to, status: r.status, texto } })
    }
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

// fetch con 1 reintento y un error que dice qué paso falló y por qué
// ("fetch failed" solo no ayuda: el motivo real viene en err.cause).
async function traer(paso: string, url: string, init?: RequestInit): Promise<Response> {
  let ultimo: any = null
  for (let intento = 0; intento < 2; intento++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 25000)
      try {
        return await fetch(url, { ...init, signal: ctrl.signal })
      } finally {
        clearTimeout(t)
      }
    } catch (err) {
      ultimo = err
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  const causa = ultimo?.cause?.code || ultimo?.cause?.message || ultimo?.name || ultimo?.message || 'error'
  throw new Error(`${paso}: ${causa}`)
}

// Foto que mandaron: primero se pide su link (dura unos minutos) y después
// se baja con el token. El servidor de fotos de Meta pide un User-Agent.
export async function bajarMedia(mediaId: string): Promise<{ buf: Buffer; tipo: string }> {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'User-Agent': 'Mozilla/5.0 (compatible; ClasiClickBot/1.0)' }
  const info = await traer('pedir la foto a WhatsApp', `${graph()}/${mediaId}`, { headers: auth }).then((r) => r.json())
  if (!info?.url) throw new Error(`WhatsApp no dio el link de la foto${info?.error?.message ? ` (${info.error.message})` : ''}.`)
  const r = await traer('bajar la foto de WhatsApp', info.url, { headers: auth })
  if (!r.ok) throw new Error(`bajar la foto de WhatsApp: respondió ${r.status}`)
  return { buf: Buffer.from(await r.arrayBuffer()), tipo: String(info.mime_type || r.headers.get('content-type') || 'image/jpeg') }
}

// Se achica antes de subir (las de WhatsApp pueden pesar varios MB).
async function achicar(buf: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(buf).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  } catch {
    return buf
  }
}

// Para mandarle la foto a la IA (más liviana).
export async function achicarParaIA(buf: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(buf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  } catch {
    return buf
  }
}

// Recorta la foto del producto de una captura (caja en fracciones, de la IA),
// un poquito hacia adentro para no llevarse bordes ni letras. (Sin "trim":
// se comería también el fondo de la foto del producto.)
export async function recortarFoto(buf: Buffer, caja: { x: number; y: number; ancho: number; alto: number }): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    const derecha = await sharp(buf).rotate().toBuffer() // girada según el celular, antes de medir
    const { width = 0, height = 0 } = await sharp(derecha).metadata()
    if (!width || !height) return buf
    const dentro = 0.01
    const left = Math.max(0, Math.round((caja.x + caja.ancho * dentro) * width))
    const top = Math.max(0, Math.round((caja.y + caja.alto * dentro) * height))
    const w = Math.min(width - left, Math.round(caja.ancho * (1 - 2 * dentro) * width))
    const h = Math.min(height - top, Math.round(caja.alto * (1 - 2 * dentro) * height))
    if (w < 80 || h < 80) return buf
    return await sharp(derecha).extract({ left, top, width: w, height: h }).toBuffer()
  } catch {
    return buf
  }
}

export async function subirAImgbb(original: Buffer): Promise<{ url: string; thumbUrl: string }> {
  if (!process.env.IMGBB_API_KEY) throw new Error('Falta IMGBB_API_KEY.')
  const buf = await achicar(original)
  const body = new URLSearchParams()
  body.append('key', process.env.IMGBB_API_KEY)
  body.append('image', buf.toString('base64'))
  const d = await traer('subir la foto a ImgBB', 'https://api.imgbb.com/1/upload', { method: 'POST', body }).then((r) => r.json()).catch((e) => { throw e })
  if (!d?.success) throw new Error(`ImgBB: ${d?.error?.message || 'rechazó la foto'}`)
  return { url: d.data.url, thumbUrl: d.data.medium?.url || d.data.thumb?.url || d.data.url }
}
