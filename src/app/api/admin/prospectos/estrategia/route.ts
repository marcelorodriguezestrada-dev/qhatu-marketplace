import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/anuncioPublico'
import { cuposRestantes, estrategiaBase, type EstrategiaProspecto, type PlanCampana } from '@/lib/prospectos'
import { leerCampana } from '@/lib/prospectosServer'

export const dynamic = 'force-dynamic'

// Admin → 🎯 Captar tiendas: estrategia de marketing con IA (Groq).
// POST { id } → estrategia para ESE prospecto (mensajes de WhatsApp,
//   argumentos, objeciones y pasos); se guarda en el prospecto.
// POST { campana: true } → plan general de la campaña de captación.
// Sin GROQ_API_KEY (o si la IA falla) devuelve una plantilla armada.
async function groqJSON(system: string, user: string, maxTokens: number): Promise<any | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_completion_tokens: maxTokens,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (!res.ok) { console.error('estrategia: Groq respondió', res.status, await res.text().catch(() => '')); return null }
    const data = await res.json()
    return JSON.parse(String(data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim())
  } catch (err) {
    console.error('estrategia: Groq', err)
    return null
  }
}

const SISTEMA =
  'Sos experto en ventas B2B y marketing para pequeños comercios de Bolivia. Clasi Click es un marketplace boliviano (Potosí y La Paz): ' +
  'la tienda sube productos con foto y precio, Clasi Click le trae compradores, cobra con QR y hace el envío a domicilio. ' +
  'Escribí en español boliviano, cercano y respetuoso (tuteo), mensajes de WhatsApp cortos con algún emoji y *negritas* de WhatsApp. ' +
  'No inventes precios, comisiones ni beneficios que no te pase. Respondé SOLO JSON.'

const lista = (v: unknown, max = 8) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [])

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const db = getDb()
  const campana = await leerCampana()
  const todos = (await db.collection('prospectos').get()).docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
  const quedan = cuposRestantes(campana, todos)
  const sitio = `${SITE_URL}/vender`

  if (b.campana) {
    const porEstado = todos.reduce((m: Record<string, number>, p) => ({ ...m, [p.estado]: (m[p.estado] || 0) + 1 }), {})
    const rubros = Array.from(new Set(todos.map((p) => p.rubro).filter(Boolean))).slice(0, 15)
    const r = await groqJSON(
      SISTEMA,
      `Armá un plan de campaña para sumar tiendas a Clasi Click.\nOferta: ${campana.oferta} para las ${campana.cupos} primeras tiendas (quedan ${quedan}).\n` +
        `Prospectos: ${todos.length} (${Object.entries(porEstado).map(([k, v]) => `${k}: ${v}`).join(', ') || 'ninguno todavía'}). Rubros: ${rubros.join(', ') || 'varios'}.\n` +
        `Link para registrarse: ${sitio}\n` +
        'JSON: {"resumen": "2-3 frases", "fases": [{"nombre": "...", "cuando": "Semana 1", "acciones": ["..."]}] (3 o 4 fases), ' +
        '"mensajeGeneral": "mensaje de WhatsApp para enviar a cualquier tienda, con el link", "publicacion": "post para Facebook/grupos anunciando los cupos", "metas": ["metas medibles"]}',
      1800,
    )
    const plan: PlanCampana = r
      ? { resumen: String(r.resumen || ''), fases: (Array.isArray(r.fases) ? r.fases : []).slice(0, 5).map((f: any) => ({ nombre: String(f.nombre || ''), cuando: String(f.cuando || ''), acciones: lista(f.acciones) })), mensajeGeneral: String(r.mensajeGeneral || ''), publicacion: String(r.publicacion || ''), metas: lista(r.metas) }
      : {
          resumen: `Campaña de lanzamiento: ${campana.oferta} para las ${campana.cupos} primeras tiendas. La escasez ("quedan ${quedan} cupos") es el gancho principal.`,
          fases: [
            { nombre: 'Lista y primer contacto', cuando: 'Semana 1', acciones: ['Marcar en el mapa 30 tiendas de rubros que se venden bien online (ropa, calzado, accesorios, tecnología).', 'Escribir por WhatsApp a 10 por día con el mensaje inicial.'] },
            { nombre: 'Demostración', cuando: 'Semana 2', acciones: ['Visitar a los interesados y cargar 3 productos juntos.', 'Publicar en redes cada tienda nueva ("¡Bienvenida X!").'] },
            { nombre: 'Cierre por escasez', cuando: 'Semana 3', acciones: [`Avisar a los pendientes que quedan ${quedan} cupos.`, 'Seguimiento 2 a los que no respondieron.'] },
            { nombre: 'Después del cupo', cuando: 'Semana 4+', acciones: ['Nueva oferta para los siguientes (ej. 3 meses gratis).', 'Pedir a las tiendas registradas que recomienden a otras.'] },
          ],
          mensajeGeneral: `¡Hola! 👋 Soy de *Clasi Click*. Las *${campana.cupos} primeras tiendas* que se sumen tienen *${campana.oferta}* 🎁 (quedan ${quedan}). Te traemos compradores, cobramos con QR y hacemos el envío. ¿Te muestro cómo quedaría tu tienda? 👉 ${sitio}`,
          publicacion: `🎁 ¿Tenés una tienda en Potosí o La Paz? Las ${campana.cupos} primeras que se sumen a Clasi Click tienen ${campana.oferta}. Quedan ${quedan} cupos 👉 ${sitio}`,
          metas: [`${campana.cupos} tiendas registradas en 4 semanas`, '30 tiendas contactadas por semana', '50% de respuesta a los mensajes'],
        }
    return NextResponse.json({ plan, ia: !!r, quedan })
  }

  const p = todos.find((x) => x.id === b.id)
  if (!p) return NextResponse.json({ error: 'Prospecto no encontrado.' }, { status: 404 })
  const base = estrategiaBase(p, campana, quedan, sitio)
  const r = await groqJSON(
    SISTEMA,
    `Estrategia para convencer a esta tienda de sumarse a Clasi Click.\nTienda: ${p.nombre}\nRubro: ${p.rubro || 'sin dato'}\nCiudad: ${p.ciudad === 'la-paz' ? 'La Paz' : 'Potosí'}\n` +
      `Dirección: ${p.direccion || 'sin dato'}\nPersona de contacto: ${p.contacto || 'sin dato'}\nRedes: ${p.redes || 'sin dato'}\nEstado: ${p.estado}\nNotas del admin: ${p.notas || 'ninguna'}\n` +
      `Oferta: ${campana.oferta} para las ${campana.cupos} primeras tiendas (quedan ${quedan}).\nLink: ${sitio}\n` +
      (campana.mensajeBase ? `Tono/mensaje base que usa el admin: ${campana.mensajeBase}\n` : '') +
      'Adaptá los argumentos a su rubro (qué se vende bien online de ese rubro, fotos, temporadas). ' +
      'JSON: {"resumen": "1-2 frases con el enfoque", "mensajeInicial": "primer WhatsApp con la oferta y el link", "seguimiento1": "a los 2 días si no responde", ' +
      '"seguimiento2": "cierre por escasez", "argumentos": ["4-6 argumentos para su rubro"], "objeciones": [{"objecion": "...", "respuesta": "..."}] (3-5), "pasos": ["plan día por día"]}',
    1800,
  )
  const estrategia: EstrategiaProspecto = r
    ? {
        resumen: String(r.resumen || base.resumen),
        mensajeInicial: String(r.mensajeInicial || base.mensajeInicial),
        seguimiento1: String(r.seguimiento1 || base.seguimiento1),
        seguimiento2: String(r.seguimiento2 || base.seguimiento2),
        argumentos: lista(r.argumentos).length ? lista(r.argumentos) : base.argumentos,
        objeciones: (Array.isArray(r.objeciones) ? r.objeciones : []).slice(0, 6).map((o: any) => ({ objecion: String(o.objecion || ''), respuesta: String(o.respuesta || '') })).filter((o: any) => o.objecion) || base.objeciones,
        pasos: lista(r.pasos, 10).length ? lista(r.pasos, 10) : base.pasos,
      }
    : base
  if (!estrategia.objeciones.length) estrategia.objeciones = base.objeciones
  await db.collection('prospectos').doc(p.id).update({ estrategia, updatedAt: new Date().toISOString() })
  return NextResponse.json({ estrategia, ia: !!r, quedan })
}
