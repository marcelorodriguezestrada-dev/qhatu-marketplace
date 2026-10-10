import { getDb } from '@/lib/firebaseAdmin'
import { codigoCampana } from '@/lib/campanas'
import { buscarCiudad } from '@/data/ciudades'
import { CONFIG_POR_DEFECTO, OBJETIVOS_PUBLICACION, REDES_LANZAMIENTO, faseDe, fasesLanzamiento, sanearConfig, sanearPublicacion, type ConfigLanzamiento, type Publicacion } from '@/lib/lanzamiento'

// Plan de lanzamiento en Firestore: config/lanzamiento y la colección
// publicacionesMarketing. Solo servidor.

export async function leerConfigLanzamiento(): Promise<ConfigLanzamiento> {
  const d = await getDb().collection('config').doc('lanzamiento').get().catch(() => null)
  return d?.exists ? sanearConfig(d.data()) : CONFIG_POR_DEFECTO
}

// Crea la publicación con su link rastreable (una campaña propia).
export async function crearPublicacion(v: any): Promise<Publicacion | null> {
  const p = sanearPublicacion(v)
  if (!p) return null
  const db = getDb()
  const red = REDES_LANZAMIENTO.find((r) => r.id === p.red)!
  const obj = OBJETIVOS_PUBLICACION.find((o) => o.id === p.objetivo) || OBJETIVOS_PUBLICACION[0]
  const cfg = await leerConfigLanzamiento()
  const ahora = new Date().toISOString()
  const campanaId = codigoCampana(`${red.id} ${p.fecha.slice(5)} ${p.titulo}`)
  await db.collection('campanas').doc(campanaId).set({
    nombre: `${red.label} ${p.fecha.slice(8, 10)}/${p.fecha.slice(5, 7)} · ${p.titulo}`.slice(0, 60),
    canal: red.id,
    objetivo: obj.id,
    destino: obj.destino,
    ciudad: cfg.ciudad,
    activa: true,
    lanzamiento: true,
    createdAt: ahora,
  })
  const ref = db.collection('publicacionesMarketing').doc()
  const doc = { ...p, campanaId, createdAt: ahora }
  await ref.set(doc)
  return { id: ref.id, ...doc }
}

// La IA arma el calendario de un rango de días. null si no hay IA.
export async function calendarioIA(cfg: ConfigLanzamiento, desde: string, dias: number, extra: string): Promise<any[] | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  const ciudad = buscarCiudad(cfg.ciudad).nombre
  const fases = fasesLanzamiento(cfg.fecha).map((f) => `${f.label} (${f.desde} a ${f.hasta}): ${f.que}`).join('\n')
  const diasTxt = Array.from({ length: dias }, (_, i) => {
    const d = new Date(`${desde}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    const iso = d.toISOString().slice(0, 10)
    return `${iso} (${d.toLocaleDateString('es-BO', { weekday: 'long', timeZone: 'UTC' })}, fase ${faseDe(cfg.fecha, iso).label})`
  }).join('\n')
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_completion_tokens: 6000,
        reasoning_effort: 'medium',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `Sos el responsable de marketing de Clasi Click, un marketplace de ${ciudad}, Bolivia (productos de tiendas locales con envío a domicilio y pago por QR, más servicios profesionales y anuncios). ` +
              `Armá un calendario de publicaciones para redes sociales para el lanzamiento del ${cfg.fecha}.\n` +
              `Fases:\n${fases}\n` +
              `Redes a usar: ${cfg.redes.join(', ')}. Metas: ${cfg.metas.visitas} visitas, ${cfg.metas.registros} cuentas, ${cfg.metas.pedidos} compras, ${cfg.metas.vendedores} tiendas nuevas.\n` +
              `Promos reales (usá SOLO estas, no inventes otras ni descuentos): ${cfg.promos || 'ninguna'}.\n` +
              'Reglas: 1 o 2 publicaciones por día, variando las redes; TikTok casi siempre video corto (9–15 s); Instagram reel o carrusel; Facebook imagen para grupos de compra-venta de la ciudad; WhatsApp estado. ' +
              'En "idea" explicá en 1–3 frases qué grabar o diseñar, concreto y fácil de hacer con un celular. "texto" es el caption listo para pegar, en español de Bolivia, cercano, con emojis moderados y la palabra {LINK} donde va el link (en TikTok/Instagram: "link en la bio"). ' +
              '"objetivo": "compradores", "vendedores" o "profesionales". "formato": video, reel, imagen, carrusel, estado o historia. ' +
              'Respondé SOLO JSON: {"publicaciones":[{"fecha":"yyyy-mm-dd","red":"tiktok|instagram|facebook|whatsapp","formato":"...","titulo":"corto","idea":"...","texto":"...","hashtags":"#...","objetivo":"..."}]}',
          },
          { role: 'user', content: `Días a planificar:\n${diasTxt}${extra ? `\n\nPedido extra del dueño: ${extra.slice(0, 400)}` : ''}` },
        ],
      }),
    })
    if (!res.ok) {
      console.error('calendarioIA: Groq respondió', res.status)
      return null
    }
    const data = await res.json()
    const parsed = JSON.parse(String(data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim())
    const lista = Array.isArray(parsed.publicaciones) ? parsed.publicaciones : []
    const hasta = (() => { const d = new Date(`${desde}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias - 1); return d.toISOString().slice(0, 10) })()
    return lista.map(sanearPublicacion).filter((p: any) => p && p.fecha >= desde && p.fecha <= hasta && cfg.redes.includes(p.red)).slice(0, dias * 3)
  } catch (err) {
    console.error('calendarioIA', err)
    return null
  }
}
