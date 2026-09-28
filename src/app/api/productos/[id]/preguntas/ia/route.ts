import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { responderPreguntaProductoIA } from '@/lib/moderacionIA'
import { MAX_PREGUNTA } from '@/lib/preguntas'
import { tieneControlStock, agotado } from '@/lib/stock'

export const dynamic = 'force-dynamic'

// POST { pregunta } — respuesta instantánea de la IA (no hace falta
// sesión). Solo usa lo publicado del producto, la tienda y las
// preguntas que el vendedor ya respondió. Tope por IP para no gastar
// de más (la API de Groq es gratis, pero con límite diario).
const usos = new Map<string, number[]>()
const MAX_POR_IP = 12
const VENTANA_MS = 10 * 60 * 1000

const TIPOS_VENTA: Record<string, string> = {
  mayorista: 'vende por mayor', minorista: 'vende por menor', haceEnvios: 'hace envíos', aceptaCambios: 'acepta cambios',
  permiteProbar: 'permite probarse', pagoQr: 'acepta pago con QR', videollamada: 'atiende por videollamada', pagoTarjeta: 'acepta tarjeta',
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip'
  const ahora = Date.now()
  const recientes = (usos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS)
  if (recientes.length >= MAX_POR_IP) {
    return NextResponse.json({ error: 'Hiciste muchas preguntas seguidas. Esperá unos minutos o preguntale al vendedor.' }, { status: 429 })
  }
  recientes.push(ahora)
  usos.set(ip, recientes)

  try {
    const body = await req.json()
    const pregunta = String(body.pregunta || '').trim().replace(/\s+/g, ' ').slice(0, MAX_PREGUNTA)
    if (pregunta.length < 3) return NextResponse.json({ error: 'Escribí tu pregunta.' }, { status: 400 })

    const db = getDb()
    const doc = await db.collection('productos').doc(params.id).get()
    if (!doc.exists) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    const p = doc.data() as any
    const [tiendaDoc, respondidas] = await Promise.all([
      p.vendedorId ? db.collection('vendedores').doc(p.vendedorId).get() : null,
      db.collection('preguntas').where('productoId', '==', params.id).get(),
    ])
    const t = (tiendaDoc?.data() || {}) as any
    const qa = respondidas.docs
      .map((d) => d.data())
      .filter((q) => q.respuesta)
      .slice(0, 10)
      .map((q) => `- P: ${q.texto}\n  R (vendedor): ${q.respuesta}`)
      .join('\n')

    const lineas = [
      `Producto: ${p.nombre}`,
      `Precio: Bs ${p.precio}${p.precioOriginal ? ` (antes Bs ${p.precioOriginal})` : ''}`,
      p.descripcionCorta && `Descripción corta: ${p.descripcionCorta}`,
      p.descripcionLarga && `Descripción: ${String(p.descripcionLarga).slice(0, 1500)}`,
      p.talles?.length && `Talles: ${p.talles.join(', ')}`,
      p.colores?.length && `Colores: ${p.colores.join(', ')}`,
      p.materiales && `Material: ${p.materiales}`,
      p.publico && `Para: ${p.publico}`,
      `Stock: ${!tieneControlStock(p) ? 'disponible (el vendedor no informó cantidad)' : agotado(p) ? 'AGOTADO' : `${p.stock} unidades`}`,
      p.compraMinima > 1 && `Compra mínima: ${p.compraMinima} unidades`,
      `Tienda: ${t.nombreNegocio || p.tiendaNombre || 'sin nombre'}`,
      t.direccion && `Dirección de la tienda: ${t.direccion}`,
      t.horarios && `Horarios: ${t.horarios}`,
      t.tiposVenta && `La tienda: ${Object.entries(t.tiposVenta).filter(([, v]) => v).map(([k]) => TIPOS_VENTA[k] || k).join(', ') || 'sin datos'}`,
      'Clasi Click: se compra desde la página y se paga por QR interbancario; hay envío a domicilio en Potosí (el costo se ve al elegir la dirección en el checkout) y envío express los días hábiles pidiendo antes de las 17 hs.',
      qa && `Preguntas que ya respondió el vendedor:\n${qa}`,
    ].filter(Boolean)

    const r = await responderPreguntaProductoIA(lineas.join('\n'), pregunta)
    if (!r) {
      return NextResponse.json({ respuesta: null, seguro: false, error: 'La respuesta automática no está disponible ahora. Preguntale al vendedor.' })
    }
    return NextResponse.json(r)
  } catch (err) {
    console.error('POST /api/productos/[id]/preguntas/ia', err)
    return NextResponse.json({ error: 'No se pudo responder ahora.' }, { status: 500 })
  }
}
