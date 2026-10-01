import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { etiquetasParaProducto } from '@/lib/etiquetasProducto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Admin → Productos → "🏷️ Palabras de búsqueda con IA": genera las
// etiquetas de búsqueda de los productos que ya existían. De a pocos por
// llamada (el panel la repite hasta terminar) para no pasarse del tiempo
// de Vercel ni del límite de Groq.
// GET → { total, conEtiquetas }   POST { todos?: boolean, ids?: string[] } → { procesados, fallidos, restantes }
const LOTE = 8

function esAdmin(req: NextRequest) {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const snap = await getDb().collection('productos').get()
  const conEtiquetas = snap.docs.filter((d) => (d.data().etiquetasBusqueda || []).length > 0).length
  return NextResponse.json({ total: snap.size, conEtiquetas })
}

export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const db = getDb()
  const snap = await db.collection('productos').get()
  // "todos": regenera también los que ya tienen, salteando los ya hechos en esta pasada.
  const hechos = new Set<string>(Array.isArray(body.hechos) ? body.hechos : [])
  const pendientes = snap.docs.filter((d) => !hechos.has(d.id) && (body.todos || !(d.data().etiquetasBusqueda || []).length))
  const lote = pendientes.slice(0, LOTE)
  const procesados: string[] = []
  let fallidos = 0
  for (const d of lote) {
    const etiquetas = await etiquetasParaProducto(d.data())
    if (etiquetas.length) {
      await d.ref.update({ etiquetasBusqueda: etiquetas })
      procesados.push(d.id)
    } else {
      fallidos++
      procesados.push(d.id) // no lo reintentamos en esta pasada
    }
  }
  return NextResponse.json({ procesados, fallidos, restantes: pendientes.length - lote.length })
}
