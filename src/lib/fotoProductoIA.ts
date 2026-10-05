import type { CategoriaProducto } from '@/lib/arbolCategorias'
import { puntuarRubros, type RubroPlano } from '@/lib/armarPlanilla'

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Analiza la foto de un producto con IA para la importación masiva,
// "Armar planilla" y /vender. Proveedor: Gemini de Google (plan gratis,
// GEMINI_API_KEY) si está configurado; si no, o si falla, Groq.
// 1) Un modelo con visión mira la foto y dice QUÉ es (nombre, tipo,
//    público, colores, descripción). Pedido chico a propósito: antes iba
//    con la lista entera de categorías (~11.000 tokens por foto) y con el
//    límite gratis por minuto fallaba sin avisar.
// 2) La categoría la elige Clasi Click con ese texto (mismo puntaje que
//    "Armar planilla"); si no hay una clara, un modelo de texto elige
//    entre los pocos candidatos. Nunca inventa un rubro.
// Si la IA responde 429 (límite por minuto) tira LimiteIA para que el panel
// espere y reintente; cualquier otro problema tira ErrorIA con el motivo.

export class LimiteIA extends Error {}
export class ErrorIA extends Error {}

const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions'
// Modelos con visión: Groq los da de baja seguido (llama-4-scout ya no
// está), así que se le pregunta a Groq cuáles tiene esta cuenta
// (/v1/models), se prueban los que parecen de visión y se recuerda el que
// anda. GROQ_VISION_MODEL (variable del servidor) va primero si está.
const CONOCIDOS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
const PARECE_VISION = /vision|scout|maverick|llama-4|[-/]vl\b|-vl-|qwen.*vl|gemma-?3|pixtral|llava|omni|kimi.*vl|multimodal/i
let modeloQueAnda: string | null = null
let listaCache: { at: number; ids: string[] } | null = null

async function modelosDeLaCuenta(): Promise<string[] | null> {
  if (listaCache && Date.now() - listaCache.at < 10 * 60 * 1000) return listaCache.ids
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } })
    if (!r.ok) return null
    const d = await r.json()
    const ids: string[] = (d.data || []).filter((m: any) => m && m.active !== false).map((m: any) => String(m.id))
    listaCache = { at: Date.now(), ids }
    return ids
  } catch {
    return null
  }
}

async function modelosVision(): Promise<{ modelos: string[]; todos: string[] | null }> {
  const todos = await modelosDeLaCuenta()
  const env = process.env.GROQ_VISION_MODEL
  const deVision = (todos || []).filter((id) => PARECE_VISION.test(id))
  // Preferidos primero: el configurado, el último que anduvo, Llama 4, el resto.
  const orden = (id: string) => (id === env ? 0 : id === modeloQueAnda ? 1 : /llama-4/i.test(id) ? 2 : /vision|vl/i.test(id) ? 3 : 4)
  const candidatos = todos ? [...(env ? [env] : []), ...deVision] : [...(env ? [env] : []), ...(modeloQueAnda ? [modeloQueAnda] : []), ...CONOCIDOS]
  return { modelos: Array.from(new Set(candidatos)).sort((a, b) => orden(a) - orden(b)), todos }
}

// ——— Gemini (Google AI Studio, plan gratis) ———
// Modelos: GEMINI_MODEL si está; si no, se le pregunta a Google cuáles hay
// (los "flash", que son los del plan gratis) y se recuerda el que anda.
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta'
let geminiQueAnda: string | null = null
let geminiCache: { at: number; ids: string[] } | null = null

async function modelosGemini(): Promise<string[]> {
  const env = process.env.GEMINI_MODEL
  const base = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
  let ids: string[] | null = geminiCache && Date.now() - geminiCache.at < 10 * 60 * 1000 ? geminiCache.ids : null
  if (!ids) {
    try {
      const r = await fetch(`${URL_GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } })
      if (r.ok) {
        const d = await r.json()
        ids = (d.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m: any) => String(m.name).replace(/^models\//, ''))
          .filter((n: string) => /flash/.test(n) && !/image|tts|audio|live|thinking|embedding|exp\b/.test(n))
        geminiCache = { at: Date.now(), ids: ids! }
      }
    } catch {}
  }
  // Más nuevo primero ("gemini-3-flash" antes que "gemini-2.5-flash"), sin "-lite" adelante.
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0)
  const lista = (ids && ids.length ? ids : base).sort((a, b) => version(b) - version(a) || Number(/lite/.test(a)) - Number(/lite/.test(b)) || Number(/preview/.test(a)) - Number(/preview/.test(b)))
  return Array.from(new Set([...(env ? [env] : []), ...(geminiQueAnda ? [geminiQueAnda] : []), ...lista]))
}

async function gemini(model: string, partes: unknown[], maxTokens: number): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30000)
  try {
    const res = await fetch(`${URL_GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          // Los 2.5 "piensan" antes de responder y gastan el presupuesto: acá no hace falta.
          ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    })
    if (res.status === 429) throw new LimiteIA('Límite de la IA por minuto')
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 300)
      console.error('fotoProductoIA: Gemini respondió', res.status, txt)
      const e = new ErrorIA(`Gemini respondió ${res.status}: ${txt.replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').slice(0, 140)}`)
      ;(e as any).status = res.status
      ;(e as any).texto = txt
      throw e
    }
    const data = await res.json()
    const texto = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('')
    if (!texto) throw new ErrorIA(`Gemini no respondió nada${data.promptFeedback?.blockReason ? ` (${data.promptFeedback.blockReason})` : ''}.`)
    return JSON.parse(texto.replace(/```json|```/g, '').trim())
  } catch (err) {
    if (err instanceof LimiteIA || err instanceof ErrorIA) throw err
    throw new ErrorIA((err as any)?.name === 'AbortError' ? 'Gemini tardó demasiado.' : 'Gemini no devolvió una respuesta válida.')
  } finally {
    clearTimeout(t)
  }
}

async function conGemini(partes: unknown[], maxTokens: number): Promise<any> {
  let ultimo: unknown = null
  for (const model of await modelosGemini()) {
    try {
      const r = await gemini(model, partes, maxTokens)
      geminiQueAnda = model
      return r
    } catch (err) {
      ultimo = err
      const st = (err as any)?.status
      // Modelo inexistente o sin acceso → el siguiente. Clave mala, límite u otro → se corta.
      if (err instanceof ErrorIA && (st === 404 || (st === 400 && /model|not found|not supported/i.test(String((err as any).texto))))) continue
      throw err
    }
  }
  throw ultimo || new ErrorIA('Gemini no tiene modelos disponibles para esta clave.')
}

// La foto va adentro del pedido (base64): así no depende de que la IA pueda
// abrir el link (ImgBB, Drive…).
type Foto = { mime: string; b64: string | null; url: string }
async function bajarFoto(url: string): Promise<Foto> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;]+);base64,(.*)$/)
    return { mime: m?.[1] || 'image/jpeg', b64: m?.[2] || null, url }
  }
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (ClasiClick)' } })
    const tipo = (r.headers.get('content-type') || '').split(';')[0]
    if (!r.ok || !tipo.startsWith('image/')) throw new ErrorIA(`No se pudo abrir la foto (${r.status}).`)
    const buf = Buffer.from(await r.arrayBuffer())
    return { mime: tipo, b64: buf.length <= 15_000_000 ? buf.toString('base64') : null, url }
  } catch (err) {
    if (err instanceof ErrorIA) throw err
    return { mime: 'image/jpeg', b64: null, url }
  }
}

async function groq(cuerpo: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new ErrorIA('Falta GROQ_API_KEY en el servidor.')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(URL_GROQ, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(cuerpo) })
    if (res.status === 429) throw new LimiteIA('Límite de la IA por minuto')
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 300)
      console.error('fotoProductoIA: Groq respondió', res.status, txt)
      const e = new ErrorIA(`La IA respondió ${res.status}: ${txt.replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').slice(0, 140)}`)
      ;(e as any).status = res.status
      ;(e as any).texto = txt
      throw e
    }
    const data = await res.json()
    return JSON.parse(String(data.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim())
  } catch (err) {
    if (err instanceof LimiteIA || err instanceof ErrorIA) throw err
    throw new ErrorIA((err as any)?.name === 'AbortError' ? 'La IA tardó demasiado.' : 'La IA no devolvió una respuesta válida.')
  } finally {
    clearTimeout(t)
  }
}

async function vision(foto: Foto, texto: string, maxTokens: number): Promise<any> {
  let errorGemini: unknown = null
  if (process.env.GEMINI_API_KEY && foto.b64) {
    try {
      return await conGemini([{ text: texto }, { inline_data: { mime_type: foto.mime, data: foto.b64 } }], Math.max(maxTokens, 600))
    } catch (err) {
      if (err instanceof LimiteIA || !process.env.GROQ_API_KEY) throw err
      errorGemini = err // Probamos con Groq; si también falla, se muestra el de Gemini.
    }
  }
  if (!process.env.GROQ_API_KEY) throw new ErrorIA('No hay IA configurada: agregá GEMINI_API_KEY (gratis en aistudio.google.com) en las variables del servidor.')
  try {
    return await visionGroq(foto.b64 && foto.b64.length <= 4_600_000 ? `data:${foto.mime};base64,${foto.b64}` : foto.url, texto, maxTokens)
  } catch (err) {
    throw errorGemini || err
  }
}

async function visionGroq(imagen: string, texto: string, maxTokens: number): Promise<any> {
  const { modelos, todos } = await modelosVision()
  if (!modelos.length) {
    throw new ErrorIA(`Groq no tiene modelos que miren fotos para esta cuenta. Modelos disponibles: ${(todos || []).slice(0, 12).join(', ') || 'ninguno'}.`)
  }
  let ultimo: unknown = null
  const probados: string[] = []
  for (const model of modelos) {
    for (const conFormato of [true, false]) {
      try {
        const r = await groq({
          model, max_completion_tokens: maxTokens, temperature: 0.1,
          ...(conFormato ? { response_format: { type: 'json_object' } } : {}),
          messages: [{ role: 'user', content: [{ type: 'text', text: texto + (conFormato ? '' : '\nRespondé solo el JSON, sin texto antes ni después.') }, { type: 'image_url', image_url: { url: imagen } }] }],
        })
        modeloQueAnda = model
        return r
      } catch (err) {
        ultimo = err
        const st = (err as any)?.status, txt = String((err as any)?.texto || '')
        if (!(err instanceof ErrorIA)) throw err
        // Este modelo no soporta el formato JSON: mismo modelo, sin formato.
        if (conFormato && st === 400 && /response_format|json/i.test(txt)) continue
        // Dado de baja, inexistente o no mira fotos → el siguiente modelo.
        if (st === 404 || (st === 400 && /model|decommission|image|vision|multimodal|content.*(type|array)|not supported/i.test(txt))) break
        throw err
      }
    }
    probados.push(model)
  }
  const disponibles = (await modelosDeLaCuenta()) || []
  throw new ErrorIA(`Ningún modelo de Groq pudo mirar la foto (probé: ${probados.join(', ')}). Modelos de tu cuenta: ${disponibles.slice(0, 15).join(', ') || 'no se pudo leer la lista'}. ${ultimo instanceof Error ? ultimo.message : ''}`.slice(0, 600))
}

export type AnalisisFoto = { rubroId: string | null; nombre: string; publico: string | null; colores: string[]; descripcion: string }

export async function analizarFotoProducto(imagenUrl: string, categorias: CategoriaProducto[], pista?: string): Promise<AnalisisFoto> {
  const foto = await bajarFoto(imagenUrl)
  const pistaTxt = pista ? `\nEl archivo se llama "${pista}" (puede traer el nombre del producto).` : ''
  const r1 = await vision(
    foto,
    'Sos el catalogador de Clasi Click, un marketplace de Bolivia. Mirá la foto del producto que se vende.' + pistaTxt +
      '\nRespondé SOLO JSON: {"nombre": "<nombre comercial corto en español, máx 7 palabras, ej: Sandalia de taco con tiras>", ' +
      '"tipo": "<qué es en 1-3 palabras genéricas, ej: sandalia, zapato de vestir, blusa, banquito, celular>", ' +
      '"publico": "mujer" | "hombre" | "ninos" | "unisex", "colores": ["<colores visibles, máx 3>"], ' +
      '"descripcion": "<1 frase de venta, máx 25 palabras, sin inventar materiales ni marcas>"}',
    300
  )
  const nombre = String(r1.nombre || '').trim().slice(0, 80)
  const tipo = String(r1.tipo || '').trim().slice(0, 60)
  const publico = ['mujer', 'hombre', 'ninos', 'unisex'].includes(r1.publico) ? r1.publico : null
  const colores: string[] = Array.isArray(r1.colores) ? r1.colores.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 3) : []

  // Categoría: primero con el texto (sin gastar IA), si no, entre pocos candidatos.
  const rubros: RubroPlano[] = categorias.flatMap((c) => c.rubros.map((r) => ({ id: r.id, label: r.label, grupo: r.grupo, categoriaId: c.id, categoriaLabel: c.label })))
  const contexto = { bebe: publico === 'ninos' && /\b(bebe|bb|rn|recien nacido)\b/i.test(`${tipo} ${nombre}`) }
  const puntos = [...puntuarRubros(`${tipo} ${nombre}`, rubros, contexto), ...puntuarRubros(tipo, rubros, contexto)]
    .filter((x, i, arr) => arr.findIndex((y) => y.r.id === x.r.id) === i)
    .sort((a, b) => b.p - a.p)
  // Muy claro (ej. "sandalia" → Sandalias y Ojotas): sin gastar IA. "Claro"
  // = buen puntaje, sin empate, y el rubro no agrega una palabra que la IA
  // no dijo ("Cubre Zapatos" para un zapato no es claro).
  const dijo = norm(`${tipo} ${nombre}`)
  const itemCompleto = (label: string) => label.split(/,| y | e /i).some((item) => norm(item).split(' ').filter((w) => w.length >= 3).every((w) => dijo.split(' ').some((d) => d.slice(0, 5) === w.slice(0, 5))))
  const claro = puntos[0] && puntos[0].p >= 7 && (!puntos[1] || puntos[1].p <= puntos[0].p - 2) && itemCompleto(puntos[0].r.label)
  let rubroId: string | null = claro ? puntos[0].r.id : null
  if (!rubroId) {
    // Candidatos: los que coinciden + sus hermanos de subcategoría ("zapato de
    // vestir" → todo Calzado, porque no hay un rubro "Zapatos"). Si no coincide
    // ninguno por nombre, las subcategorías que nombran lo que es.
    const grupos = new Set(puntos.slice(0, 3).map((x) => `${x.r.categoriaId}::${x.r.grupo || ''}`))
    if (!puntos.length) {
      const palabras = `${tipo} ${nombre}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4)
      for (const r of rubros) if (r.grupo && palabras.some((w) => r.grupo!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(w.slice(0, 5)))) grupos.add(`${r.categoriaId}::${r.grupo}`)
    }
    const hermanos = rubros.filter((r) => r.grupo && grupos.has(`${r.categoriaId}::${r.grupo}`))
    const candidatos = [...puntos.map((x) => x.r), ...hermanos].filter((r, i, arr) => arr.findIndex((y) => y.id === r.id) === i).slice(0, 30).map((r) => ({ r }))
    if (candidatos.length) {
      const pedido = `Producto: "${nombre}" (${tipo}). Elegí su categoría de esta lista o null si ninguna corresponde:\n` + candidatos.map((c) => `${c.r.id} = ${[c.r.categoriaLabel, c.r.grupo, c.r.label].filter(Boolean).join(' > ')}`).join('\n') + '\nRespondé SOLO JSON: {"rubroId": "<id EXACTO o null>"}'
      try {
        const r2 = process.env.GEMINI_API_KEY
          ? await conGemini([{ text: pedido }], 200)
          : await groq({ model: 'openai/gpt-oss-20b', max_completion_tokens: 400, reasoning_effort: 'low', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: pedido }] })
        rubroId = candidatos.some((c) => c.r.id === r2.rubroId) ? String(r2.rubroId) : null
      } catch (err) {
        if (err instanceof LimiteIA) throw err
        // Sin categoría: la elige el admin. El resto del análisis sirve igual.
      }
    }
  }
  return {
    rubroId,
    nombre,
    publico,
    colores: colores.map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()),
    descripcion: String(r1.descripcion || '').trim().slice(0, 250),
  }
}
