import { NextRequest, NextResponse } from 'next/server'
import { guiaIdioma } from '@/lib/estiloRegional'
import { todasLasCiudades } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { esClaveAdmin } from '@/lib/adminAuth'
import { pedidoBase, camposPorRubro, type PedidoProductos } from '@/lib/pedirProductos'

export const dynamic = 'force-dynamic'

// POST { nombre, contacto, rubro, ciudad, requerimiento, tipo } →
// { mensaje, plantilla, consejos, ia } — mensaje de WhatsApp para pedir
// productos y precios (ver src/lib/pedirProductos.ts). Con GROQ_API_KEY
// lo arma la IA según el rubro y lo que escribió el admin; si no, plantilla.
// La ciudad llega como id ("potosi") o como nombre ("Potosí").
const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const ciudadPorNombre = (x: string) => todasLasCiudades().find((c) => c.id === x || sinTildes(c.nombre) === sinTildes(x))?.id || 'potosi'

const SISTEMA =
  'Sos el equipo de Clasi Click, un marketplace de Bolivia (Potosí y La Paz) donde las tiendas suben productos con foto y precio. ' +
  'Escribís mensajes de WhatsApp en español boliviano, cercanos y respetuosos (tuteo), cortos, con algún emoji y *negritas* de WhatsApp (un asterisco). ' +
  'Tu trabajo: pedirle a la persona la información de productos y precios con una ESTRUCTURA fácil de copiar y completar desde el celular ' +
  '(una plantilla numerada, un dato por renglón, "Campo: " para que escriba al lado). No inventes precios, ofertas ni beneficios. Respondé SOLO JSON.'

export async function POST(req: NextRequest) {
  await cargarCiudadesServidor().catch(() => null) // ciudades agregadas desde el admin (Buenos Aires...)
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  const b = await req.json().catch(() => ({}))
  const d = {
    nombre: String(b.nombre || '').slice(0, 120),
    contacto: String(b.contacto || '').slice(0, 80),
    rubro: String(b.rubro || '').slice(0, 80),
    ciudad: String(b.ciudad || '').slice(0, 60),
    requerimiento: String(b.requerimiento || '').slice(0, 1500),
    tipo: b.tipo === 'cliente' ? ('cliente' as const) : ('tienda' as const),
  }
  const base = pedidoBase(d)
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ ...base, ia: false })

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_completion_tokens: 1500,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SISTEMA + guiaIdioma(ciudadPorNombre(d.ciudad)) },
          {
            role: 'user',
            content:
              (d.tipo === 'cliente'
                ? 'Es un CLIENTE (comprador) que nos consultó: pedile qué necesita para poder cotizarle.\n'
                : 'Es una TIENDA que ya contactamos y quiere sumarse: pedile sus productos y precios para cargarle la tienda.\n') +
              `Nombre: ${d.nombre || 'sin dato'}\nPersona de contacto: ${d.contacto || 'sin dato'}\nRubro: ${d.rubro || 'sin dato'}\nCiudad: ${d.ciudad || 'sin dato'}\n` +
              `Campos sugeridos para su rubro: ${camposPorRubro(d.rubro).join(', ')}\n` +
              (d.requerimiento ? `LO QUE PIDE EL ADMIN (respetalo y armá la estructura en base a esto): ${d.requerimiento}\n` : '') +
              'JSON: {"mensaje": "el WhatsApp completo listo para enviar, con saludo, para qué lo pedimos, la plantilla numerada (3 ítems de ejemplo para completar) y cómo mandar las fotos", ' +
              '"plantilla": "solo la plantilla, para copiar aparte", "consejos": ["2 o 3 consejos cortos para el admin sobre cómo conseguir la respuesta"]}',
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Groq ${res.status}`)
    const data = await res.json()
    const r = JSON.parse(String(data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim())
    const out: PedidoProductos = {
      mensaje: String(r.mensaje || '').trim() || base.mensaje,
      plantilla: String(r.plantilla || '').trim() || base.plantilla,
      consejos: Array.isArray(r.consejos) ? r.consejos.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 4) : base.consejos,
    }
    return NextResponse.json({ ...out, ia: true })
  } catch (err) {
    console.error('pedir-productos: IA', err)
    return NextResponse.json({ ...base, ia: false })
  }
}
