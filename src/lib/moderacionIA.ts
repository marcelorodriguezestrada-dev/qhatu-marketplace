// Pre-filtro de moderación con IA (API de Groq, gratis — mismo
// proveedor que ya usa la app de consultorio). Esto NO reemplaza tu
// revisión manual en /admin — solo le pone una etiqueta de riesgo a
// cada envío nuevo para que puedas priorizar qué mirar primero. La
// decisión final (aprobar/rechazar/ocultar) siempre la tomás vos.
//
// Si GROQ_API_KEY no está configurada, o la llamada falla por
// cualquier motivo, devolvemos null y seguimos adelante sin romper el
// flujo de publicación — la moderación con IA es una ayuda opcional,
// nunca un bloqueo.

type ResultadoModeracion = { riesgo: 'bajo' | 'medio' | 'alto'; motivo: string } | null

const SYSTEM_PROMPT =
  'Sos un moderador de contenido para Clasi Click, un marketplace boliviano de productos y servicios profesionales. ' +
  'Te paso el contenido que un usuario acaba de enviar (un producto a la venta, o una solicitud de un profesional para aparecer en el directorio). ' +
  'Evaluá el riesgo de que sea contenido inapropiado, spam, datos incompletos o claramente falsos, o un precio irreal para lo que se describe. ' +
  'Respondé SOLO JSON válido, sin backticks ni texto adicional, con esta forma exacta: ' +
  '{"riesgo": "bajo" | "medio" | "alto", "motivo": "string de máximo 15 palabras explicando por qué"}'

export async function evaluarConIA(contenido: string): Promise<ResultadoModeracion> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // el más liviano y rápido de Groq — alcanza de sobra para clasificar riesgo
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: contenido },
        ],
      }),
    })
    if (!res.ok) {
      console.error('evaluarConIA: Groq respondió', res.status)
      return null
    }
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return null

    const limpio = texto.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(limpio)
    if (!['bajo', 'medio', 'alto'].includes(parsed.riesgo)) return null

    return { riesgo: parsed.riesgo, motivo: String(parsed.motivo || '').slice(0, 200) }
  } catch (err) {
    console.error('evaluarConIA', err)
    return null
  }
}

// Categoriza un anuncio dentro de los rubros que YA existen en la
// plataforma — nunca inventa uno nuevo. Le mandamos la lista completa
// de ids válidos (la misma que arma /api/categorias, con lo que el
// admin haya agregado a mano incluido) y la obligamos a elegir uno de
// esa lista exacta, o null si de verdad no encaja en ninguno. Sirve
// para dos cosas: que /anuncios se pueda filtrar por rubro igual que
// /servicios, y que el macheo automático con profesionales funcione
// también en anuncios donde la persona no eligió un rubro a mano.
export async function categorizarAnuncio(contenido: string, rubros: { id: string; label: string; categoriaLabel?: string }[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || rubros.length === 0) return null

  const lista = rubros.map((r) => `${r.id} (${r.categoriaLabel ? r.categoriaLabel + ' > ' : ''}${r.label})`).join('\n')
  const systemPrompt =
    'Categorizás anuncios clasificados de Clasi Click, un marketplace boliviano. ' +
    'Te paso el título y la descripción de un anuncio, y la lista EXACTA de rubros válidos que existen en la plataforma (id y nombre). ' +
    'Elegí el id del rubro que mejor describe el anuncio, SOLO de esta lista — nunca inventes uno que no esté acá:\n' +
    lista +
    '\nSi ninguno encaja razonablemente, respondé null. ' +
    'Respondé SOLO JSON válido, sin backticks: {"rubroId": "el-id-exacto-de-la-lista" | null}'

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contenido },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return null

    const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
    const rubroId = parsed.rubroId
    // Chequeamos que el id que devolvió sea REALMENTE uno de la lista
    // que le pasamos — si alucina un id que no existe, mejor dejarlo
    // sin categorizar que guardar algo inválido.
    if (typeof rubroId === 'string' && rubros.some((r) => r.id === rubroId)) return rubroId
    return null
  } catch (err) {
    console.error('categorizarAnuncio', err)
    return null
  }
}
export type SugerenciaMatcheoIA = { anuncioId: string; profesionalId: string; motivo: string }

// El macheo automático (ejecutarMacheo, en macheoAnuncios.ts) solo cruza
// por rubro EXACTO — si el anuncio no tiene rubro asignado, o su rubro
// no tiene ningún profesional cargado todavía, ese "Busco X" se queda
// sin nadie a quien avisarle aunque en la plataforma sí haya alguien
// que razonablemente podría ayudar (ej: "se me tapó el desagüe" sin
// rubro asignado, pero hay un plomero disponible).
//
// Esta función es la ayuda de admin para esos casos: le pasamos SOLO
// los anuncios que el macheo exacto no resolvió, más la lista de
// profesionales aprobados, y la IA sugiere pares razonables con un
// motivo corto. Nunca se ejecuta sola ni manda nada — el admin decide,
// anuncio por anuncio, si "Sugerir a ambas partes" (ver
// /api/admin/macheos/sugerir).
export async function sugerirMatcheosIA(
  anuncios: { id: string; titulo: string; descripcion: string }[],
  profesionales: { id: string; nombre: string; rubroLabel: string; descripcion: string }[]
): Promise<SugerenciaMatcheoIA[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || anuncios.length === 0 || profesionales.length === 0) return []

  const listaProfesionales = profesionales
    .map((p) => `${p.id} | ${p.rubroLabel} | ${p.nombre} | ${(p.descripcion || '').slice(0, 140)}`)
    .join('\n')
  const listaAnuncios = anuncios
    .map((a) => `${a.id} | ${a.titulo} | ${(a.descripcion || '').slice(0, 200)}`)
    .join('\n')

  const systemPrompt =
    'Sos un asistente que sugiere posibles coincidencias entre pedidos de gente y profesionales de Clasi Click, un marketplace boliviano. ' +
    'Te paso una lista de ANUNCIOS ("busco X", con id, título y descripción) y una lista de PROFESIONALES disponibles (con id, rubro, nombre y descripción). ' +
    'Estos anuncios NO matchearon por rubro exacto (no tienen rubro asignado, o nadie de ese rubro está cargado todavía), así que buscá coincidencias razonables ' +
    'aunque el rubro no sea idéntico (ej: "se me tapó el desagüe" puede servirle un plomero aunque el anuncio no diga "plomero"). ' +
    'NO inventes ids que no estén en las listas de abajo. Si un anuncio no tiene ningún profesional razonable, no lo incluyas — es mejor no sugerir nada que sugerir algo forzado. ' +
    'Máximo 3 sugerencias por anuncio. ' +
    'Respondé SOLO JSON válido, sin backticks, con esta forma exacta: ' +
    '{"sugerencias": [{"anuncioId": "...", "profesionalId": "...", "motivo": "máximo 20 palabras"}]}'

  const contenido = `ANUNCIOS:\n${listaAnuncios}\n\nPROFESIONALES:\n${listaProfesionales}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contenido },
        ],
      }),
    })
    if (!res.ok) {
      console.error('sugerirMatcheosIA: Groq respondió', res.status)
      return []
    }
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return []

    const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
    const sugerencias = Array.isArray(parsed.sugerencias) ? parsed.sugerencias : []

    // Chequeamos que cada id devuelto sea REALMENTE de las listas que
    // mandamos — si la IA alucina un id, mejor descartar esa sugerencia
    // que guardar/mostrar algo que apunta a nada.
    const idsAnuncios = new Set(anuncios.map((a) => a.id))
    const idsProfesionales = new Set(profesionales.map((p) => p.id))
    return sugerencias
      .filter(
        (s: any) =>
          typeof s?.anuncioId === 'string' &&
          typeof s?.profesionalId === 'string' &&
          idsAnuncios.has(s.anuncioId) &&
          idsProfesionales.has(s.profesionalId)
      )
      .map((s: any) => ({
        anuncioId: s.anuncioId,
        profesionalId: s.profesionalId,
        motivo: String(s.motivo || '').slice(0, 200),
      }))
  } catch (err) {
    console.error('sugerirMatcheosIA', err)
    return []
  }
}

// acá si la IA detecta insultos, la reseña se bloquea directo (no llega
// a publicarse ni pasa por una cola de revisión), porque un insulto en
// una reseña pública no aporta nada que valga la pena revisar a mano.
// Igual que el resto: si GROQ_API_KEY no está configurada o la llamada
// falla, dejamos pasar la reseña — nunca bloqueamos por un error
// técnico ajeno al usuario.
const SYSTEM_PROMPT_RESENA =
  'Analizá el siguiente comentario de una reseña de un marketplace boliviano. ' +
  'Determiná si contiene insultos, lenguaje ofensivo, discriminatorio o difamatorio hacia una persona o negocio. ' +
  'Una crítica negativa pero respetuosa ("tardó mucho", "no me gustó el producto") NO cuenta como ofensiva. ' +
  'Respondé SOLO JSON válido, sin backticks: {"contieneInsultos": true|false}'

export async function contieneInsultos(comentario: string): Promise<boolean> {
  if (!comentario || !comentario.trim()) return false
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return false

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 50,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_RESENA },
          { role: 'user', content: comentario },
        ],
      }),
    })
    if (!res.ok) return false
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return false
    const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
    return parsed.contieneInsultos === true
  } catch (err) {
    console.error('contieneInsultos', err)
    return false
  }
}
