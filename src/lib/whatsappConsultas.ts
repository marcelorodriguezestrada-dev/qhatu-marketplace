import { getDb } from '@/lib/firebaseAdmin'
import { diaBolivia } from '@/lib/fechaBolivia'
import { leerDiasUsuario } from '@/lib/estadisticasUsuario'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { guiaIdioma } from '@/lib/estiloRegional'
import { SITE_URL } from '@/lib/sitio'

// Bot de WhatsApp → preguntas sobre la tienda ("¿cuánto stock tengo del
// buzo?", "resumen", "¿cómo me fue esta semana?", "¿qué pedidos tengo?",
// "¿cómo van mis publicaciones?"). Se juntan los números reales de la
// tienda y la IA responde con esos datos (nunca inventa).

const SIN_VENTA = new Set(['cancelado', 'rechazado'])
const ESTADO_PEDIDO: Record<string, string> = {
  verificando_stock: 'verificando stock',
  pendiente_pago: 'esperando el pago',
  pago_informado: 'pago informado (revisar)',
  confirmado: 'confirmado',
  preparando: 'preparando',
  en_camino: 'en camino',
  listo_retiro: 'listo para retirar',
  entregado: 'entregado',
  cancelado: 'cancelado',
  rechazado: 'rechazado',
}

const restar = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

type Producto = { id: string; nombre: string; precio: number; precioOriginal?: number | null; stock?: number | null; estado?: string; vistas?: number }

// Todos los números de la tienda, en texto, para pasárselos a la IA.
export async function datosDeTienda(tienda: { id: string; nombreNegocio?: string }, productos: Producto[], ciudadId: string): Promise<string> {
  const db = getDb()
  const plata = (n: number) => formatoMoneda(Math.round(n * 100) / 100, paisDeCiudad(ciudadId))
  const hoy = diaBolivia()
  const desde30 = restar(hoy, 29)
  const desde7 = restar(hoy, 6)
  const [pedidosSnap, dias, campanasSnap] = await Promise.all([
    db.collection('pedidos').where('vendedorId', '==', tienda.id).get(),
    leerDiasUsuario(tienda.id, desde30).catch(() => []),
    db.collection('campanas').where('vendedorId', '==', tienda.id).get().catch(() => null),
  ])

  // Visitas, contactos y carrito por producto (7 y 30 días).
  const porProducto = new Map<string, { v7: number; v30: number; c30: number }>()
  let vistas7 = 0, vistas30 = 0, carrito30 = 0, contactos30 = 0
  for (const d of dias) {
    for (const [clave, x] of Object.entries(d.items)) {
      if (!clave.startsWith('p_')) continue
      const id = clave.slice(2)
      const p = porProducto.get(id) || { v7: 0, v30: 0, c30: 0 }
      const v = Number(x?.vistas || 0)
      p.v30 += v
      p.c30 += Number(x?.carrito || 0)
      if (d.fecha >= desde7) p.v7 += v
      porProducto.set(id, p)
      vistas30 += v
      carrito30 += Number(x?.carrito || 0)
      contactos30 += Number(x?.contactos || 0)
      if (d.fecha >= desde7) vistas7 += v
    }
  }

  // Pedidos: los del mes y los que están abiertos (sin terminar).
  const pedidos = pedidosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => !p.esPrueba)
  const delMes = pedidos.filter((p) => p.createdAt && diaBolivia(p.createdAt) >= desde30 && !SIN_VENTA.has(p.estado))
  const deLaSemana = delMes.filter((p) => diaBolivia(p.createdAt) >= desde7)
  const abiertos = pedidos.filter((p) => p.estado && !['entregado', 'cancelado', 'rechazado'].includes(p.estado))
  const vendidas = new Map<string, number>()
  for (const p of delMes) for (const it of Array.isArray(p.items) ? p.items : []) vendidas.set(String(it?.id || ''), (vendidas.get(String(it?.id || '')) || 0) + (Number(it?.cantidad) || 0))

  // Marketing: publicaciones compartidas desde Vender → Marketing.
  const publicaciones = (campanasSnap?.docs || [])
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((c) => c.origen === 'vendedor' && c.estado === 'publicada')
    .sort((a, b) => String(b.publicadaAt || b.createdAt || '').localeCompare(String(a.publicadaAt || a.createdAt || '')))

  const activos = productos.filter((p) => !p.estado || p.estado === 'activo')
  const sinStock = activos.filter((p) => p.stock === 0)
  const pocoStock = activos.filter((p) => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3)
  const masVistos = [...productos].sort((a, b) => (porProducto.get(b.id)?.v30 || 0) - (porProducto.get(a.id)?.v30 || 0)).slice(0, 5)

  return [
    `TIENDA: ${tienda.nombreNegocio || 'sin nombre'} · link ${SITE_URL}/tienda/${tienda.id} · hoy ${hoy}`,
    `PRODUCTOS: ${productos.length} en total, ${activos.length} publicados, ${productos.filter((p) => p.estado === 'oculto').length} ocultos, ${productos.filter((p) => p.estado === 'pendiente').length} pendientes de revisión.`,
    `Sin stock: ${sinStock.map((p) => p.nombre).join(', ') || 'ninguno'}. Poco stock (≤3): ${pocoStock.map((p) => `${p.nombre} (${p.stock})`).join(', ') || 'ninguno'}.`,
    `DETALLE DE PRODUCTOS (nombre | precio | stock | estado | vistas 7d | vistas 30d | al carrito 30d | vendidas 30d):`,
    ...productos.slice(0, 120).map((p) => {
      const n = porProducto.get(p.id)
      return `- ${p.nombre} | ${plata(p.precio)}${p.precioOriginal ? ` (antes ${plata(p.precioOriginal)})` : ''} | ${p.stock ?? 'sin control'} | ${p.estado || 'activo'} | ${n?.v7 || 0} | ${n?.v30 || 0} | ${n?.c30 || 0} | ${vendidas.get(p.id) || 0}`
    }),
    `ACTIVIDAD: vistas de productos últimos 7 días ${vistas7}, últimos 30 días ${vistas30}; agregados al carrito 30d ${carrito30}; contactos por WhatsApp 30d ${contactos30}.`,
    `Más vistos (30d): ${masVistos.map((p) => `${p.nombre} (${porProducto.get(p.id)?.v30 || 0})`).join(', ') || 'sin datos'}.`,
    `VENTAS: últimos 7 días ${deLaSemana.length} pedidos por ${plata(deLaSemana.reduce((t, p) => t + Number(p.total || 0), 0))}; últimos 30 días ${delMes.length} pedidos por ${plata(delMes.reduce((t, p) => t + Number(p.total || 0), 0))}.`,
    `PEDIDOS ABIERTOS (${abiertos.length}): ${abiertos.slice(0, 15).map((p) => `${p.nombreComprador || 'cliente'} · ${plata(Number(p.total || 0))} · ${ESTADO_PEDIDO[p.estado] || p.estado} · ${String(p.createdAt || '').slice(0, 10)}`).join(' / ') || 'ninguno'}.`,
    `MARKETING (publicaciones compartidas desde Clasi Click, con su link medido): ${publicaciones.length} publicaciones. ` +
      (publicaciones.slice(0, 8).map((c) => `"${c.nombre || c.canal}" en ${c.lugar || c.canal || 'redes'} (${String(c.publicadaAt || c.createdAt || '').slice(0, 10)}): ${c.visitas || 0} visitas, ${c.pedidos || 0} pedidos, ${plata(Number(c.ventasBs || 0))}`).join(' / ') || 'todavía no compartió ninguna'),
  ].join('\n')
}

export async function responderConsulta(pregunta: string, datos: string, ciudadId: string): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_completion_tokens: 2500,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Sos el asistente de WhatsApp de una tienda en Clasi Click (marketplace). Respondé la pregunta del vendedor usando SOLO los datos que te paso; si algo no está en los datos, decilo. ' +
              'Formato WhatsApp: corto y claro (máx. 15 renglones), *negritas* con un asterisco, viñetas con •, emojis moderados. ' +
              'Si piden un "resumen", incluí productos (y stock bajo), actividad, ventas, pedidos abiertos y marketing, y terminá con 1 consejo concreto basado en los números. ' +
              'Respondé SOLO JSON: {"respuesta": "..."}' +
              guiaIdioma(ciudadId),
          },
          { role: 'user', content: `DATOS:\n${datos}\n\nPREGUNTA: ${pregunta.slice(0, 600)}` },
        ],
      }),
    })
    if (!r.ok) return null
    const d = await r.json()
    const texto = String(JSON.parse(String(d.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim()).respuesta || '').trim()
    return texto ? texto.slice(0, 3500) : null
  } catch {
    return null
  }
}
