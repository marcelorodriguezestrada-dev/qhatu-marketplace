import type { CategoriaProducto } from '@/lib/arbolCategorias'
import { puntuarRubros, type RubroPlano } from '@/lib/armarPlanilla'

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Analiza la foto de un producto con IA (Groq) para la importación masiva
// y "Armar planilla":
// 1) Un modelo con visión mira la foto y dice QUÉ es (nombre, tipo,
//    público, colores, descripción). Pedido chico a propósito: antes iba
//    con la lista entera de categorías (~11.000 tokens por foto) y con el
//    límite gratis por minuto fallaba sin avisar.
// 2) La categoría la elige Clasi Click con ese texto (mismo puntaje que
//    "Armar planilla"); si no hay una clara, un modelo de texto elige
//    entre los pocos candidatos. Nunca inventa un rubro.
// Si Groq responde 429 (límite por minuto) tira LimiteIA para que el panel
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

// La foto va adentro del pedido (base64): así no depende de que Groq pueda
// abrir el link (ImgBB, Drive…). Si pesa demasiado, va el link.
async function aDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (ClasiClick)' } })
    const tipo = (r.headers.get('content-type') || '').split(';')[0]
    if (!r.ok || !tipo.startsWith('image/')) throw new ErrorIA(`No se pudo abrir la foto (${r.status}).`)
    const buf = Buffer.from(await r.arrayBuffer())
    return buf.length <= 3_500_000 ? `data:${tipo};base64,${buf.toString('base64')}` : url
  } catch (err) {
    if (err instanceof ErrorIA) throw err
    return url
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

async function vision(imagen: string, texto: string, maxTokens: number): Promise<any> {
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
  const imagen = await aDataUrl(imagenUrl)
  const pistaTxt = pista ? `\nEl archivo se llama "${pista}" (puede traer el nombre del producto).` : ''
  const r1 = await vision(
    imagen,
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
      try {
        const r2 = await groq({
          model: 'openai/gpt-oss-20b',
          max_completion_tokens: 400,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: `Producto: "${nombre}" (${tipo}). Elegí su categoría de esta lista o null si ninguna corresponde:\n` + candidatos.map((c) => `${c.r.id} = ${[c.r.categoriaLabel, c.r.grupo, c.r.label].filter(Boolean).join(' > ')}`).join('\n') + '\nRespondé SOLO JSON: {"rubroId": "<id EXACTO o null>"}' }],
        })
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

// "📲 Capturas de catálogo": la IA lee una captura de pantalla de un
// catálogo de WhatsApp Business (o Instagram / Facebook) y devuelve los
// productos que se ven, con la caja donde está la foto de cada uno (en
// fracciones de la imagen, para recortarla en el navegador).
export type CajaFoto = { x: number; y: number; ancho: number; alto: number }
export type ProductoCaptura = { nombre: string; precio: number | null; precioAntes: number | null; descripcion: string; caja: CajaFoto | null }

// "$ 15.000" → 15000 · "1.250,50" → 1250.5 · "1,250.50" → 1250.5 · 15000 → 15000
export function leerPrecio(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  let t = String(v ?? '').replace(/[^\d.,]/g, '')
  if (!t) return null
  const ultimoSep = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
  // Separador decimal = el último, si tiene 1 o 2 dígitos después.
  if (ultimoSep >= 0 && t.length - ultimoSep - 1 <= 2) t = t.slice(0, ultimoSep).replace(/[.,]/g, '') + '.' + t.slice(ultimoSep + 1)
  else t = t.replace(/[.,]/g, '')
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

function leerCaja(c: any): CajaFoto | null {
  if (!c || typeof c !== 'object') return null
  let [x, y, ancho, alto] = [c.x, c.y, c.ancho ?? c.w ?? c.width, c.alto ?? c.h ?? c.height].map(Number)
  if (![x, y, ancho, alto].every(Number.isFinite)) return null
  // Algunos modelos responden en porcentaje (0-100) en vez de fracción.
  if (Math.max(x, y, ancho, alto) > 1.5) [x, y, ancho, alto] = [x, y, ancho, alto].map((n) => n / 100)
  x = Math.min(Math.max(x, 0), 1)
  y = Math.min(Math.max(y, 0), 1)
  ancho = Math.min(ancho, 1 - x)
  alto = Math.min(alto, 1 - y)
  return ancho > 0.04 && alto > 0.02 ? { x, y, ancho, alto } : null
}

export async function leerCapturaCatalogo(imagen: string): Promise<{ vista: 'detalle' | 'lista'; productos: ProductoCaptura[] }> {
  const r = await vision(
    imagen,
    'Esta es una captura de pantalla de un catálogo de productos de WhatsApp Business (o de Instagram / Facebook). ' +
      'Puede ser la vista de UN producto (foto grande arriba, nombre, precio y descripción) o una LISTA (miniatura de cada producto con su nombre y precio). ' +
      'Extraé cada producto que se vea con su nombre completo (ignorá los cortados arriba o abajo sin nombre). ' +
      'Ignorá la barra de estado del celular, el encabezado, el nombre del negocio y botones como "Agregar al carrito", "Mensaje" o "Compartir". ' +
      'Para cada producto: "nombre" tal cual aparece; "precio" como número sin símbolo de moneda ni separador de miles (ej: "$ 15.000" → 15000, "$ 1.250,50" → 1250.5), null si no se ve; ' +
      '"precioAntes" si hay un precio tachado (número) o null; "descripcion" el texto que se vea (máx 300 caracteres, vacío si no hay); ' +
      '"caja": el rectángulo de la FOTO del producto (solo la foto, sin textos ni botones) en fracciones de la captura: {"x": borde izquierdo, "y": borde de arriba, "ancho", "alto"}, valores entre 0 y 1. ' +
      'Respondé SOLO JSON: {"vista": "detalle" | "lista", "productos": [{"nombre": "...", "precio": 15000, "precioAntes": null, "descripcion": "...", "caja": {"x": 0, "y": 0.1, "ancho": 1, "alto": 0.45}}]}',
    1800
  )
  const productos: ProductoCaptura[] = (Array.isArray(r?.productos) ? r.productos : [])
    .map((p: any) => ({
      nombre: String(p?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      precio: leerPrecio(p?.precio),
      precioAntes: leerPrecio(p?.precioAntes),
      descripcion: String(p?.descripcion || '').replace(/[ \t]+/g, ' ').trim().slice(0, 400),
      caja: leerCaja(p?.caja),
    }))
    .filter((p: ProductoCaptura) => p.nombre.length >= 2)
    .slice(0, 20)
  return { vista: r?.vista === 'lista' ? 'lista' : productos.length > 1 ? 'lista' : 'detalle', productos }
}
