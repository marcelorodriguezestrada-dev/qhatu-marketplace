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

// Filtro de insultos para reseñas — distinto del pre-filtro de arriba:
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
