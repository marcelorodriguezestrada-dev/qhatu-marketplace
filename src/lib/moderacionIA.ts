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
//
// IMPORTANTE (fix 23/09/2026): los modelos openai/gpt-oss-* de Groq son
// modelos de razonamiento. Groq dejó `max_tokens` deprecado para estos
// modelos en favor de `max_completion_tokens` — usar el parámetro viejo
// ahora devuelve 400 directo ("extraerDatosCV: Groq respondió 400" era
// este mismo bug). Además, como son modelos de razonamiento, gastan
// tokens "pensando" antes de escribir el contenido — por eso subimos un
// poco los presupuestos y agregamos reasoning_effort: 'low' en las
// tareas de clasificación simple, para que no gasten de más pensando y
// se quede sin presupuesto para el contenido real.

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
        model: 'openai/gpt-oss-20b', // liviano y rápido — alcanza de sobra para clasificar riesgo. (llama-3.1-8b-instant quedó discontinuado por Groq el 16/08/2026, este es el reemplazo que recomienda Groq)
        max_completion_tokens: 300,
        reasoning_effort: 'low',
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
        model: 'openai/gpt-oss-20b',
        max_completion_tokens: 200,
        reasoning_effort: 'low',
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
// Arma la presentación de un profesional (nombre, especialidad,
// experiencia y descripción) a partir del texto crudo de su CV — ver
// /api/profesionales/extraer-cv. El texto llega desde el navegador
// (leído con pdf.js si era PDF, o con Tesseract si era foto/escaneo, en
// src/lib/leerArchivoTexto.ts), así que puede traer errores de OCR,
// saltos de línea raros o columnas mezcladas; el prompt está pensado
// para tolerar eso.
//
// Es SOLO una propuesta: nunca se guarda directo en el perfil. La
// persona (desde /mi-perfil) o vos (desde /admin) la ven en el
// formulario, la pueden editar o descartar entera, y recién ahí se
// guarda — igual que evaluarConIA no aprueba nada por su cuenta.
export type DatosCVExtraidos = {
  nombre: string
  especialidad: string
  experiencia: string
  descripcion: string
}

const SYSTEM_PROMPT_CV =
  'Sos un asistente que arma la presentación de un profesional para el directorio de Clasi Click, un marketplace boliviano de servicios profesionales, ' +
  'a partir del texto crudo extraído de su CV (puede tener errores de OCR, columnas mezcladas o texto desordenado — hacé lo posible por entenderlo igual). ' +
  'Armá una presentación breve pero lo más informativa posible, para que un cliente que nunca lo vio decida contactarlo. Devolvé estos campos: ' +
  '"nombre": el nombre completo de la persona tal como aparece en el CV. ' +
  '"especialidad": frase corta (máximo 8 palabras) con su profesión o especialidad principal. ' +
  '"experiencia": resumen corto (máximo 25 palabras) de su trayectoria — años de experiencia y/o los lugares más relevantes donde trabajó. ' +
  '"descripcion": descripción atractiva en 2 o 3 oraciones (máximo 60 palabras), en tercera persona, que combine quién es, dónde trabajó y qué servicios ofrece. ' +
  'Si algún dato no aparece en el CV, dejá ese campo como string vacío ("") — NUNCA inventes datos que no estén en el texto. ' +
  'Respondé SOLO JSON válido, sin backticks ni texto adicional, con esta forma exacta: ' +
  '{"nombre": "...", "especialidad": "...", "experiencia": "...", "descripcion": "..."}'

export async function extraerDatosCV(textoCV: string): Promise<DatosCVExtraidos | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !textoCV || !textoCV.trim()) return null

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Este sí se beneficia de un modelo más capaz que el liviano de
        // arriba: tiene que leer texto desordenado de OCR y redactar
        // bien, no solo clasificar — así que usamos el modelo grande,
        // todavía gratis en Groq.
        model: 'openai/gpt-oss-120b',
        max_completion_tokens: 1200, // antes 500 con max_tokens (deprecado) — subido con margen porque es modelo de razonamiento y gasta tokens "pensando" antes de escribir
        reasoning_effort: 'low', // no necesita razonar mucho, es redacción/extracción — así deja más presupuesto para el contenido
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_CV },
          { role: 'user', content: textoCV },
        ],
      }),
    })
    if (!res.ok) {
      console.error('extraerDatosCV: Groq respondió', res.status)
      return null
    }
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return null

    const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
    return {
      nombre: String(parsed.nombre || '').slice(0, 100),
      especialidad: String(parsed.especialidad || '').slice(0, 120),
      experiencia: String(parsed.experiencia || '').slice(0, 200),
      descripcion: String(parsed.descripcion || '').slice(0, 500),
    }
  } catch (err) {
    console.error('extraerDatosCV', err)
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
        model: 'openai/gpt-oss-20b',
        max_completion_tokens: 1800, // antes 1200 con max_tokens (deprecado) — subido con margen por ser modelo de razonamiento
        reasoning_effort: 'low',
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
        model: 'openai/gpt-oss-20b',
        max_completion_tokens: 150,
        reasoning_effort: 'low',
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