// Quitar el fondo de una foto de producto con Gemini (GEMINI_API_KEY): se le
// pide la MISMA foto con el producto sobre fondo blanco. Es un modelo que
// edita imágenes (redibuja), así que el vendedor siempre ve el resultado
// antes de publicarlo. Lo usan el bot de WhatsApp y Vender → "Quitar fondo".
// GEMINI_IMAGE_MODEL (opcional) fuerza un modelo; si no, se elige solo entre
// los que la cuenta tiene para imágenes.

const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta'
const CONOCIDOS = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-2.0-flash-preview-image-generation']
let queAnda: string | null = null
let cache: { at: number; ids: string[] } | null = null

const PEDIDO =
  'Edit this product photo for an online store. Remove the background completely and place the exact same product, centered, ' +
  'on a pure white (#FFFFFF) studio background with a soft, subtle natural shadow under it. ' +
  'Do NOT change the product in any way: keep its exact shape, proportions, colors, materials, texture, logos and printed text. ' +
  'Remove hands, people, other objects, price tags and any overlaid text. Do not add props or text. Keep a small white margin around the product.'

async function modelos(): Promise<string[]> {
  const env = process.env.GEMINI_IMAGE_MODEL
  let ids = cache && Date.now() - cache.at < 10 * 60_000 ? cache.ids : null
  if (!ids) {
    try {
      const r = await fetch(`${URL_GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': String(process.env.GEMINI_API_KEY) } })
      if (r.ok) {
        const d = await r.json()
        ids = (d.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m: any) => String(m.name || '').replace(/^models\//, ''))
          .filter((id: string) => /^gemini/.test(id) && /image/.test(id))
        cache = { at: Date.now(), ids: ids || [] }
      }
    } catch {}
  }
  // El configurado, el que anduvo, "flash" estable antes que preview, versión más nueva primero.
  const version = (id: string) => Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0)
  const peso = (id: string) => (id === env ? -100 : id === queAnda ? -50 : 0) + (/flash/.test(id) ? 0 : 2) + (/preview|exp/.test(id) ? 1 : 0) - version(id)
  const lista = ids && ids.length ? ids : CONOCIDOS
  return Array.from(new Set([...(env ? [env] : []), ...lista])).sort((a, b) => peso(a) - peso(b)).slice(0, 4)
}

export class SinFondoError extends Error {}

// Devuelve la foto (JPG, máx. 1200 px) con el producto sobre fondo blanco.
export async function fondoBlanco(original: Buffer): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new SinFondoError('Falta GEMINI_API_KEY en Vercel.')
  const sharp = (await import('sharp')).default
  const entrada = await sharp(original).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  let ultimo = ''
  const inicio = Date.now()
  for (const model of await modelos()) {
    // Las funciones de Vercel cortan a los 60 s: sin tiempo, no se prueba otro modelo.
    const queda = 50_000 - (Date.now() - inicio)
    if (queda < 15_000) break
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), queda)
    try {
      const res = await fetch(`${URL_GEMINI}/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: PEDIDO }, { inline_data: { mime_type: 'image/jpeg', data: entrada.toString('base64') } }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.2 },
        }),
      })
      if (!res.ok) {
        const txt = (await res.text()).slice(0, 400)
        console.error('fondoBlancoIA', model, res.status, txt)
        if (res.status === 429) {
          ultimo = /free|billing|limit: 0/i.test(txt) ? 'tu cuenta de Gemini no tiene cuota gratis para editar imágenes (hay que activar la facturación en Google AI Studio)' : 'se alcanzó el límite de Gemini por ahora, probá en unos minutos'
          if (/limit: 0|free_tier/i.test(txt)) break
          continue
        }
        if (res.status === 400 && /API key|API_KEY/i.test(txt)) throw new SinFondoError('La clave GEMINI_API_KEY no es válida.')
        if (res.status === 403) throw new SinFondoError('La clave de Gemini no tiene permiso para editar imágenes.')
        ultimo = `Gemini respondió ${res.status}`
        continue // modelo inexistente o sin imágenes → el siguiente
      }
      const d = await res.json()
      const partes = d.candidates?.[0]?.content?.parts || []
      const img = partes.map((p: any) => p.inlineData || p.inline_data).find((x: any) => x?.data)
      if (!img) {
        ultimo = 'Gemini no devolvió una imagen'
        continue
      }
      queAnda = model
      return await sharp(Buffer.from(img.data, 'base64')).flatten({ background: '#ffffff' }).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
    } catch (err) {
      if (err instanceof SinFondoError) throw err
      ultimo = (err as any)?.name === 'AbortError' ? 'Gemini tardó demasiado' : 'Gemini no respondió bien'
    } finally {
      clearTimeout(t)
    }
  }
  throw new SinFondoError(ultimo || 'No se pudo quitar el fondo.')
}
