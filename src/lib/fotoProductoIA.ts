import type { CategoriaProducto } from '@/lib/arbolCategorias'

// Analiza la foto de un producto con IA (Groq, modelo con visión) para la
// importación masiva desde carpetas: elige el rubro del árbol (en 2 pasos:
// subcategoría y después rubro, porque son ~3.200) y propone nombre,
// público, colores y una descripción corta. Nunca inventa un rubro.
// Si Groq responde 429 (límite gratis por minuto) tira LimiteIA para que
// el panel espere y reintente.

export class LimiteIA extends Error {}

const MODELO = () => process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'

async function visionJSON(imagenUrl: string, texto: string, maxTokens = 300): Promise<any | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO(),
        max_completion_tokens: maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: texto }, { type: 'image_url', image_url: { url: imagenUrl } }] }],
      }),
    })
    if (res.status === 429) throw new LimiteIA('Límite de la IA por minuto')
    if (!res.ok) {
      console.error('fotoProductoIA: Groq respondió', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = await res.json()
    return JSON.parse(String(data.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim())
  } catch (err) {
    if (err instanceof LimiteIA) throw err
    console.error('fotoProductoIA', err)
    return null
  } finally {
    clearTimeout(t)
  }
}

export type AnalisisFoto = { rubroId: string | null; nombre: string; publico: string | null; colores: string[]; descripcion: string }

export async function analizarFotoProducto(imagenUrl: string, categorias: CategoriaProducto[], pista?: string): Promise<AnalisisFoto | null> {
  // Paso 1: subcategorías y rubros sueltos.
  const opciones: { id: string; texto: string }[] = []
  for (const c of categorias) {
    const vistos = new Set<string>()
    for (const r of c.rubros) {
      if (!r.grupoId) opciones.push({ id: r.id, texto: `${c.label} > ${r.label}` })
      else if (!vistos.has(r.grupoId)) { vistos.add(r.grupoId); opciones.push({ id: `g:${r.grupoId}`, texto: `${c.label} > ${r.grupo}` }) }
    }
  }
  const pistaTxt = pista ? `\nEl archivo se llama "${pista}" (puede traer el nombre del producto o pistas).` : ''
  const r1 = await visionJSON(
    imagenUrl,
    'Sos el catalogador de Clasi Click, un marketplace de Bolivia. Mirá la foto del producto.' + pistaTxt +
      '\nElegí su categoría de esta lista (formato "id = ruta"):\n' + opciones.map((o) => `${o.id} = ${o.texto}`).join('\n') +
      '\n\nRespondé SOLO JSON: {"categoriaId": "<id EXACTO de la lista o null>", "nombre": "<nombre comercial corto en español, máx 7 palabras, ej: Blusa con flores para niña>", ' +
      '"publico": "mujer" | "hombre" | "ninos" | "unisex", "colores": ["<colores visibles, máx 3>"], "descripcion": "<1 frase de venta, máx 25 palabras, sin inventar materiales ni marcas>"}',
    400
  )
  if (!r1) return null
  let rubroId: string | null = opciones.some((o) => o.id === r1.categoriaId) ? String(r1.categoriaId) : null
  if (rubroId?.startsWith('g:')) {
    const grupoId = rubroId.slice(2)
    const cat = categorias.find((c) => c.rubros.some((r) => r.grupoId === grupoId))!
    const hojas = cat.rubros.filter((r) => r.grupoId === grupoId)
    const r2 = await visionJSON(
      imagenUrl,
      `Este producto es de "${cat.label} > ${hojas[0]?.grupo}". Elegí el rubro exacto:\n` + hojas.map((h) => `${h.id} = ${h.label}`).join('\n') + '\n\nRespondé SOLO JSON: {"rubroId": "<id EXACTO>"}',
      120
    ).catch((e) => { if (e instanceof LimiteIA) throw e; return null })
    rubroId = hojas.some((h) => h.id === r2?.rubroId) ? String(r2.rubroId) : (hojas.find((h) => h.id === grupoId) || hojas.find((h) => /^otros?$/i.test(h.label)) || hojas[hojas.length - 1]).id
  }
  const colores: string[] = Array.isArray(r1.colores) ? r1.colores.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 3) : []
  return {
    rubroId,
    nombre: String(r1.nombre || '').trim().slice(0, 80),
    publico: ['mujer', 'hombre', 'ninos', 'unisex'].includes(r1.publico) ? r1.publico : null,
    colores: colores.map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()),
    descripcion: String(r1.descripcion || '').trim().slice(0, 250),
  }
}
