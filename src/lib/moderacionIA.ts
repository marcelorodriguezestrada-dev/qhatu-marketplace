// Pre-filtro de moderación con IA (API de Claude). Esto NO reemplaza tu
// revisión manual en /admin — solo le pone una etiqueta de riesgo a
// cada envío nuevo para que puedas priorizar qué mirar primero. La
// decisión final (aprobar/rechazar/ocultar) siempre la tomás vos.
//
// Si ANTHROPIC_API_KEY no está configurada, o la llamada falla por
// cualquier motivo, devolvemos null y seguimos adelante sin romper el
// flujo de publicación — la moderación con IA es una ayuda opcional,
// nunca un bloqueo.

type ResultadoModeracion = { riesgo: 'bajo' | 'medio' | 'alto'; motivo: string } | null

const SYSTEM_PROMPT =
  'Sos un moderador de contenido para Qhatu, un marketplace boliviano de productos y servicios profesionales. ' +
  'Te paso el contenido que un usuario acaba de enviar (un producto a la venta, o una solicitud de un profesional para aparecer en el directorio). ' +
  'Evaluá el riesgo de que sea contenido inapropiado, spam, datos incompletos o claramente falsos, o un precio irreal para lo que se describe. ' +
  'Respondé SOLO JSON válido, sin backticks ni texto adicional, con esta forma exacta: ' +
  '{"riesgo": "bajo" | "medio" | "alto", "motivo": "string de máximo 15 palabras explicando por qué"}'

export async function evaluarConIA(contenido: string): Promise<ResultadoModeracion> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // el más barato y rápido — alcanza de sobra para clasificar riesgo
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contenido }],
      }),
    })
    if (!res.ok) {
      console.error('evaluarConIA: API respondió', res.status)
      return null
    }
    const data = await res.json()
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    if (!textBlock) return null

    const limpio = textBlock.text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(limpio)
    if (!['bajo', 'medio', 'alto'].includes(parsed.riesgo)) return null

    return { riesgo: parsed.riesgo, motivo: String(parsed.motivo || '').slice(0, 200) }
  } catch (err) {
    console.error('evaluarConIA', err)
    return null
  }
}
