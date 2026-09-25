import { sanearHistorialLaboral, sanearIdiomas, type PuestoLaboral, type Idioma } from '@/lib/cvEstandar'

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
  servicios: string[]
  telefono: string
  email: string
  direccion: string
  dondeTrabaja: string
  educacion: string
  historialLaboral: PuestoLaboral[]
  idiomas: Idioma[]
}

const SYSTEM_PROMPT_CV =
  'Sos un asistente que arma la presentación de un profesional para el directorio de Clasi Click, un marketplace boliviano de servicios profesionales, ' +
  'a partir del texto crudo extraído de su CV (puede tener errores de OCR, columnas mezcladas o texto desordenado — hacé lo posible por entenderlo igual). ' +
  'Armá una presentación breve pero lo más informativa posible, para que un cliente que nunca lo vio decida contactarlo, y de paso rescatá los datos de contacto que el CV ya trae para no hacérselos escribir de nuevo. Devolvé estos campos: ' +
  '"nombre": el nombre completo de la persona tal como aparece en el CV. ' +
  '"especialidad": frase corta (máximo 8 palabras) con su profesión o especialidad principal — sirve de titular, así que puede ser un poco más vendedora que un cargo pelado (ej: en vez de "Ingeniero de sistemas" mejor "Ingeniero de Datos Senior"), pero siempre basada en el cargo/título real del CV, sin inventar un rango que no tiene. ' +
  '"experiencia": resumen corto (máximo 25 palabras) de su trayectoria a nivel general — cuántos años de experiencia tiene y en qué industria, rubro o tipo de proyectos se mueve. NO menciones acá nombres de empresas, cargos puntuales ni fechas: eso va en "dondeTrabaja", para que los dos campos no digan lo mismo. ' +
  '"descripcion": descripción tipo LANDING PAGE (2 o 3 oraciones, máximo 65 palabras, tercera persona), pensada para que alguien que nunca lo vio decida escribirle. No es un resumen neutro de CV: es un texto de venta, así que priorizá esto en orden — ' +
  '1) quién es y su nivel (senior, especialidad, años); ' +
  '2) el logro, resultado o número más fuerte que el CV realmente tenga (ej: "redujo 70% el tiempo de procesamiento", "lideró la migración de...") y/o nombres de empresas o clientes reconocibles como prueba social, si los hay; ' +
  '3) cerrá conectando eso con el beneficio concreto para quien lo contrate — qué problema le resuelve o qué gana el cliente, no solo qué sabe hacer él. ' +
  'Usá un tono profesional pero con gancho, de venta real, no un resumen aburrido de tareas. Nunca inventes números, logros o clientes que el CV no menciona — si no hay ningún logro medible, apoyate en la trayectoria y los lugares donde trabajó como prueba social. ' +
  '"servicios": lista de 3 a 6 servicios que esta persona puede ofrecer a un cliente, redactados como el BENEFICIO o resultado que el cliente se lleva, no como una tarea técnica interna — cada uno una frase corta que empieza con un verbo de acción orientado a resultado ' +
  '(ejemplo, si es ingeniero de datos: ["Ordena y centraliza los datos de tu empresa en un solo lugar confiable", "Automatiza reportes para que dejes de armarlos a mano", "Acelera tus consultas migrando a bases de datos en la nube"] — en vez de listar simplemente herramientas como "Usa Airflow" o "Sabe SQL"). ' +
  'Deducilos de su experiencia y especialidad real en el CV — no listes tareas genéricas que cualquiera pondría, y no inventes servicios que su perfil no respalda. ' +
  'Si no hay suficiente información para armar ninguno con confianza, devolvé un array vacío []. ' +
  '"telefono": su número de teléfono o WhatsApp tal como aparece en el CV (con código de país si lo tiene), o "" si no aparece ninguno. ' +
  '"email": su email de contacto tal como aparece en el CV, o "" si no aparece. ' +
  '"direccion": su dirección o ciudad de residencia si el CV la menciona explícitamente, o "" si no aparece. ' +
  '"dondeTrabaja": resumen DETALLADO (hasta 70 palabras) de dónde atiende o trabaja esta persona, pero armado para leerse rápido, NO como un párrafo corrido: ' +
  'primero una línea "Actualmente: " con el lugar donde trabaja o atiende HOY (empresa, consultorio, clínica o institución), el cargo o rol que ocupa ahí, la zona/dirección si la hay, y días u horarios de atención si el CV los da — si atiende en más de un lugar a la vez, sumalos ahí mismo, separados por coma. ' +
  'Después, si hay experiencia previa relevante, otra línea aparte "Antes: " con los 2 o 3 empleadores anteriores más importantes, cada uno solo con nombre y años (sin repetir tareas ni tecnologías, de eso ya se encargan "servicios" y "descripcion"). ' +
  'Separá esas dos líneas con un salto de línea real (\\n) dentro del string. Si no hay experiencia previa que valga la pena mencionar, dejá solo la línea "Actualmente: ". Si el CV no da nada de esto, dejalo en "". ' +
  '"educacion": estudios formales de la persona (títulos universitarios, maestrías, doctorados, certificaciones relevantes) — es otro punto fuerte para generar confianza, así que rescatalo si el CV lo trae. Formato compacto: cada título separado por " · ", como "Maestría en Data Mining (UBA) · Maestría en Finanzas (UTDT) · Ingeniería en Sistemas (UCB)". Máximo 40 palabras en total; si hay muchos títulos, priorizá los de nivel más alto o más relevantes para su especialidad. No incluyas colegio secundario. Si el CV no menciona estudios formales, dejalo en "". ' +
  '"historialLaboral": lista de TODOS los puestos del CV (máximo 12), del más reciente al más viejo, para armar su CV estandarizado. Cada uno con: ' +
  '"cargo" (tal como figura), "empresa" (nombre de la empresa o institución), "cliente" (aclaración opcional como "Cliente: KAVAK" o "Proyecto X vía Y", o ""), ' +
  '"desde" y "hasta" en formato "AAAA-MM" si el CV da el mes, o "AAAA" si solo da el año, o "" si no da nada; "actual": true si es su trabajo actual (ahí "hasta" va ""); ' +
  '"logros": de 1 a 5 logros o responsabilidades, cada uno con el formato "Título corto: descripción" (ej: "Optimización de pipelines: Reingeniería de los pipelines ETL, logrando una reducción del 70% en el tiempo de procesamiento") — respetá los números y resultados que el CV da, sin inventar ninguno; ' +
  '"stack": herramientas, tecnologías o materiales que el CV menciona para ese puesto (máximo 12, nombres cortos), o [] si no menciona. ' +
  'Si el CV no tiene experiencia laboral, devolvé []. ' +
  '"idiomas": lista de idiomas que el CV menciona, cada uno {"idioma": "Español", "nivel": "Nativo"} (nivel tal como lo dice el CV, ej: "Profesional — Lectura y escritura técnica avanzada"), o [] si no menciona. ' +
  'Si algún dato no aparece en el CV, dejá ese campo como string vacío ("") o array vacío ([]) — NUNCA inventes datos que no estén en el texto. ' +
  'Respondé SOLO JSON válido, sin backticks ni texto adicional, con esta forma exacta: ' +
  '{"nombre": "...", "especialidad": "...", "experiencia": "...", "descripcion": "...", "servicios": ["...", "..."], "telefono": "...", "email": "...", "direccion": "...", "dondeTrabaja": "...", "educacion": "...", ' +
  '"historialLaboral": [{"cargo": "...", "empresa": "...", "cliente": "...", "desde": "...", "hasta": "...", "actual": false, "logros": ["..."], "stack": ["..."]}], "idiomas": [{"idioma": "...", "nivel": "..."}]}'

// Recorta un texto a `max` caracteres sin partir una palabra al medio
// (evita cosas como "...fuente de ve" en vez de "...fuente de verdad") —
// si el corte cae a mitad de palabra, retrocede hasta el último espacio.
function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const cortado = texto.slice(0, max)
  const ultimoEspacio = cortado.lastIndexOf(' ')
  return (ultimoEspacio > max * 0.5 ? cortado.slice(0, ultimoEspacio) : cortado).trim()
}

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
        max_completion_tokens: 4500, // antes 1500 (y antes 1200) — ahora también devuelve el historial laboral completo con logros por puesto, que es lo más largo de la respuesta; — subido de nuevo porque descripcion/servicios ahora piden más elaboración (copy de venta) y sigue siendo modelo de razonamiento que gasta tokens "pensando" antes de escribir
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
    const serviciosCrudos = Array.isArray(parsed.servicios) ? parsed.servicios : []
    return {
      nombre: recortar(String(parsed.nombre || ''), 100),
      especialidad: recortar(String(parsed.especialidad || ''), 120),
      experiencia: recortar(String(parsed.experiencia || ''), 200),
      descripcion: recortar(String(parsed.descripcion || ''), 500),
      servicios: serviciosCrudos
        .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => recortar(s.trim(), 110)) // 80 se quedaba corto para frases de servicio orientadas a beneficio, más largas que un simple "Hace X"
        .slice(0, 6),
      // Datos de contacto/ubicación que a veces ya están en el CV — son
      // solo una propuesta más: siempre se muestran en un campo
      // editable para que la persona los revise (y complete o corrija)
      // antes de guardar, igual que el resto.
      telefono: recortar(String(parsed.telefono || ''), 40),
      email: recortar(String(parsed.email || ''), 150),
      direccion: recortar(String(parsed.direccion || ''), 200),
      dondeTrabaja: recortar(String(parsed.dondeTrabaja || ''), 500),
      educacion: recortar(String(parsed.educacion || ''), 300),
      // CV estandarizado: mismo saneo que cuando se guarda desde el
      // formulario, así la propuesta ya viene con los mismos límites.
      historialLaboral: sanearHistorialLaboral(parsed.historialLaboral),
      idiomas: sanearIdiomas(parsed.idiomas),
    }
  } catch (err) {
    console.error('extraerDatosCV', err)
    return null
  }
}

// Ayuda para quien NO tiene CV propio y arma el suyo desde /mi-perfil o
// /admin: escribe con sus palabras qué hacía en un puesto (aunque sea
// desordenado, "arreglaba cañerías, hice la obra del edificio X") y la
// IA lo devuelve redactado como logros prolijos "Título: descripción",
// más las herramientas que se mencionan. Como siempre, es una
// propuesta: vuelve al formulario para revisarla antes de guardar.
const SYSTEM_PROMPT_PUESTO =
  'Ayudás a profesionales bolivianos (de cualquier rubro: oficios, salud, ingeniería, comercio, etc.) a armar su CV en Clasi Click. ' +
  'Te paso un puesto de trabajo (cargo, empresa) y lo que la persona escribió con sus palabras sobre lo que hacía ahí. ' +
  'Reescribilo como de 2 a 5 logros o responsabilidades, cada uno con el formato "Título corto: descripción" (título de 2 a 5 palabras; descripción de una oración clara, en tercera persona implícita, empezando con un sustantivo o verbo de acción, ej: "Mantenimiento preventivo: Revisión mensual de instalaciones sanitarias en 3 edificios, reduciendo las urgencias por fugas"). ' +
  'Usá SOLO lo que la persona dijo: podés ordenar, agrupar y mejorar la redacción, pero NUNCA inventes números, clientes, resultados ni tareas que no mencionó. ' +
  'En "stack" devolvé las herramientas, tecnologías, equipos o materiales que la persona mencionó explícitamente (máximo 12, nombres cortos), o [] si no mencionó ninguna. ' +
  'Respondé SOLO JSON válido, sin backticks: {"logros": ["...", "..."], "stack": ["..."]}'

export async function mejorarPuestoLaboral(datos: { cargo: string; empresa: string; texto: string; especialidad?: string }): Promise<{ logros: string[]; stack: string[] } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !datos.texto.trim()) return null

  const contenido =
    `Cargo: ${datos.cargo || '(sin cargo)'}\n` +
    `Empresa: ${datos.empresa || '(sin empresa)'}\n` +
    (datos.especialidad ? `Especialidad general de la persona: ${datos.especialidad}\n` : '') +
    `Lo que hacía (con sus palabras):\n${datos.texto}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // redacción, igual que extraerDatosCV
        max_completion_tokens: 1200,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_PUESTO },
          { role: 'user', content: contenido },
        ],
      }),
    })
    if (!res.ok) {
      console.error('mejorarPuestoLaboral: Groq respondió', res.status)
      return null
    }
    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content
    if (!texto) return null
    const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
    // Reusamos el saneo del historial para aplicar los mismos límites.
    const [puesto] = sanearHistorialLaboral([{ cargo: datos.cargo || '-', logros: parsed.logros, stack: parsed.stack }])
    return puesto ? { logros: puesto.logros, stack: puesto.stack } : null
  } catch (err) {
    console.error('mejorarPuestoLaboral', err)
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

export type PrioridadInvitacionIA = { id: string; puntaje: number; motivo: string }

// Orden de invitación para las solicitudes de profesionales pendientes
// (casi todas importadas de avisos de Cambalache): la IA le pone a cada
// una un puntaje 0-100 según qué tan probable es que la persona acepte
// sumarse a Clasi Click y que valga la pena tenerla en el directorio,
// para que el admin invite primero a los mejores. No manda nada ni
// cambia estados — solo ordena (ver /api/admin/profesionales/priorizar).
export async function priorizarInvitacionesIA(
  profesionales: { id: string; nombre: string; rubroLabel: string; especialidad: string; descripcion: string; zona: string; experiencia: string; precio: string }[]
): Promise<PrioridadInvitacionIA[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || profesionales.length === 0) return []

  const systemPrompt =
    'Sos un asistente comercial de Clasi Click, un marketplace de Potosí, Bolivia, que suma profesionales a su directorio gratis. ' +
    'Te paso solicitudes de personas que ofrecen servicios (la mayoría sacadas de avisos en grupos de WhatsApp como Cambalache). ' +
    'A cada una ponele un puntaje de 0 a 100 de PRIORIDAD DE INVITACIÓN: qué tan probable es que acepte la invitación y que sea un buen profesional para el directorio. ' +
    'Puntuá alto: servicios profesionales u oficios claros (médicos, abogados, contadores, técnicos, electricistas, plomeros, docentes, profesionales de salud, etc.), ' +
    'que ofrecen su servicio de forma activa y buscan clientes, con descripción concreta, zona, experiencia o precio (señales de que viven de eso y quieren más clientes). ' +
    'Puntuá bajo: avisos que en realidad son venta de productos y no un servicio, pedidos ("busco..."), textos vagos o sin datos, spam, ' +
    'esquemas de ganancias/multinivel/préstamos, o contenido dudoso. ' +
    'NO inventes ids. Respondé SOLO JSON válido, sin backticks, con esta forma exacta: ' +
    '{"prioridades": [{"id": "...", "puntaje": 0-100, "motivo": "máximo 15 palabras"}]}'

  const idsValidos = new Set(profesionales.map((p) => p.id))
  const resultados: PrioridadInvitacionIA[] = []

  // De a 25 para no pasarnos de tokens con listas largas.
  for (let i = 0; i < profesionales.length; i += 25) {
    const tanda = profesionales.slice(i, i + 25)
    const contenido = tanda
      .map((p) =>
        [p.id, p.rubroLabel, p.nombre, p.especialidad, p.zona, p.experiencia && `exp: ${p.experiencia}`, p.precio && `precio: ${p.precio}`, (p.descripcion || '').slice(0, 300)]
          .filter(Boolean)
          .join(' | ')
      )
      .join('\n')
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          max_completion_tokens: 2500,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contenido },
          ],
        }),
      })
      if (!res.ok) {
        console.error('priorizarInvitacionesIA: Groq respondió', res.status)
        continue
      }
      const data = await res.json()
      const texto = data.choices?.[0]?.message?.content
      if (!texto) continue
      const parsed = JSON.parse(texto.replace(/```json|```/g, '').trim())
      for (const r of Array.isArray(parsed.prioridades) ? parsed.prioridades : []) {
        const puntaje = Number(r?.puntaje)
        if (typeof r?.id !== 'string' || !idsValidos.has(r.id) || !Number.isFinite(puntaje)) continue
        resultados.push({ id: r.id, puntaje: Math.max(0, Math.min(100, Math.round(puntaje))), motivo: String(r.motivo || '').slice(0, 200) })
      }
    } catch (err) {
      console.error('priorizarInvitacionesIA', err)
    }
  }
  return resultados
}
