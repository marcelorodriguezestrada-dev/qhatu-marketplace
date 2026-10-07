import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { mesBolivia } from '@/lib/fechaBolivia'
import { mesDe, sumarMeses } from '@/lib/finanzas'
import { limpiarMovimiento } from '@/lib/finanzasServer'

export const dynamic = 'force-dynamic'

// Admin → 💰 Finanzas.
// GET ?desde=YYYY-MM&hasta=YYYY-MM → { movimientos, ventas: { [mes]: { pedidos, vendido, envios } } }
//   (las ventas salen de los pedidos pagados/entregados, sin los de cuentas de prueba)
// POST { tipo, fecha, monto, categoria, descripcion, metodo, recurrente } → crea
// POST { accion: 'recurrentes', mes } → copia al mes los gastos/ingresos fijos que todavía no estén
const autorizado = (req: NextRequest) => {
  const pw = req.headers.get('x-admin-password')
  return !!pw && pw === process.env.ADMIN_PASSWORD
}
const ESTADOS_VENTA = new Set(['pagado', 'en_preparacion', 'en_entrega', 'entregado'])

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const hasta = req.nextUrl.searchParams.get('hasta') || mesBolivia()
  const desde = req.nextUrl.searchParams.get('desde') || sumarMeses(hasta, -11)
  try {
    const db = getDb()
    const [snap, pedidos] = await Promise.all([
      db.collection('finanzas').where('fecha', '>=', `${desde}-01`).where('fecha', '<=', `${hasta}-31`).get(),
      db.collection('pedidos').get(),
    ])
    const movimientos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.createdAt).localeCompare(String(a.createdAt)))
    const ventas: Record<string, { pedidos: number; vendido: number; envios: number }> = {}
    for (const d of pedidos.docs) {
      const p = d.data() as any
      if (p.esPrueba || !ESTADOS_VENTA.has(p.estado) || !p.createdAt) continue
      const mes = mesBolivia(p.createdAt)
      if (mes < desde || mes > hasta) continue
      const v = (ventas[mes] ||= { pedidos: 0, vendido: 0, envios: 0 })
      v.pedidos++
      v.vendido += Number(p.total) || 0
      v.envios += Number(p.costoEnvio) || 0
    }
    return NextResponse.json({ movimientos, ventas, desde, hasta })
  } catch (err) {
    console.error('GET /api/admin/finanzas', err)
    return NextResponse.json({ error: 'No se pudieron leer las finanzas.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const db = getDb()
  const ahora = new Date().toISOString()

  if (b.accion === 'recurrentes') {
    const mes = /^\d{4}-\d{2}$/.test(String(b.mes)) ? String(b.mes) : mesBolivia()
    const fijos = (await db.collection('finanzas').where('recurrente', '==', true).get()).docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    // Ya cargados este mes (el propio o una copia suya).
    const yaEnMes = new Set(fijos.filter((f) => mesDe(f.fecha) === mes).map((f) => f.origenRecurrente || f.id))
    const delMes = (await db.collection('finanzas').where('fecha', '>=', `${mes}-01`).where('fecha', '<=', `${mes}-31`).get()).docs.map((d) => d.data() as any)
    delMes.forEach((x) => x.origenRecurrente && yaEnMes.add(x.origenRecurrente))
    // Un fijo = la serie (el original); se copia el último monto de cada serie.
    const series = new Map<string, any>()
    for (const f of fijos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) if (mesDe(f.fecha) < mes) series.set(f.origenRecurrente || f.id, f)
    const lote = db.batch()
    const creados: any[] = []
    for (const [serie, f] of series) {
      if (yaEnMes.has(serie)) continue
      const dia = Math.min(28, Number(String(f.fecha).slice(8, 10)) || 1)
      const doc = { tipo: f.tipo, fecha: `${mes}-${String(dia).padStart(2, '0')}`, monto: f.monto, categoria: f.categoria, descripcion: f.descripcion, metodo: f.metodo || '', recurrente: true, origenRecurrente: serie, createdAt: ahora }
      const ref = db.collection('finanzas').doc()
      lote.set(ref, doc)
      creados.push({ id: ref.id, ...doc })
    }
    if (creados.length) await lote.commit()
    return NextResponse.json({ ok: true, creados })
  }

  const d = limpiarMovimiento(b, true)
  if ('error' in d) return NextResponse.json({ error: d.error }, { status: 400 })
  const doc = { ...d.datos, origenRecurrente: null, createdAt: ahora }
  const ref = await db.collection('finanzas').add(doc)
  return NextResponse.json({ ok: true, movimiento: { id: ref.id, ...doc } })
}
