import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { sanearStock } from '@/lib/stock'

export const dynamic = 'force-dynamic'

// Admin → Productos → "⚡ Edición rápida": guarda los cambios de muchos
// productos de una (lotes de Firestore de hasta 400 escrituras).
// POST { cambios: [{ id, nombre?, rubro?, publico?, precio?, precioOriginal?, stock?, talles?, colores?, estado? }] }
const lista = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60) : [])

export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const entradas: any[] = Array.isArray(body.cambios) ? body.cambios.slice(0, 2000) : []
  if (!entradas.length) return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })

  const errores: { id: string; error: string }[] = []
  const validos: { id: string; datos: Record<string, unknown> }[] = []
  const ahora = new Date().toISOString()
  for (const e of entradas) {
    const id = typeof e?.id === 'string' ? e.id : ''
    if (!id) continue
    const d: Record<string, unknown> = {}
    if (typeof e.nombre === 'string') {
      if (e.nombre.trim().length < 2) { errores.push({ id, error: 'Nombre vacío' }); continue }
      d.nombre = e.nombre.trim().slice(0, 120)
    }
    if (typeof e.rubro === 'string' && e.rubro) d.rubro = e.rubro
    if (e.publico !== undefined) d.publico = ['mujer', 'hombre', 'ninos', 'unisex'].includes(e.publico) ? e.publico : 'unisex'
    if (e.precio !== undefined) {
      const n = Number(e.precio)
      if (!(n > 0)) { errores.push({ id, error: 'Precio inválido' }); continue }
      d.precio = Math.round(n * 100) / 100
    }
    if (e.precioOriginal !== undefined) {
      const n = e.precioOriginal === null || e.precioOriginal === '' ? null : Number(e.precioOriginal)
      d.precioOriginal = n && n > 0 ? Math.round(n * 100) / 100 : null
    }
    if (e.stock !== undefined) d.stock = sanearStock(e.stock)
    if (e.talles !== undefined) d.talles = lista(e.talles)
    if (e.colores !== undefined) d.colores = lista(e.colores)
    if (e.estado !== undefined) {
      if (!['activo', 'pendiente', 'rechazado', 'oculto'].includes(e.estado)) { errores.push({ id, error: 'Estado inválido' }); continue }
      d.estado = e.estado
    }
    if (!Object.keys(d).length) continue
    const precio = (d.precio as number | undefined) ?? (typeof e.precioActual === 'number' ? e.precioActual : undefined)
    if (d.precioOriginal && precio && (d.precioOriginal as number) <= precio) d.precioOriginal = null // "antes" tiene que ser mayor
    d.updatedAt = ahora
    validos.push({ id, datos: d })
  }

  const db = getDb()
  let guardados = 0
  for (let i = 0; i < validos.length; i += 400) {
    const lote = db.batch()
    for (const v of validos.slice(i, i + 400)) lote.update(db.collection('productos').doc(v.id), v.datos)
    try {
      await lote.commit()
      guardados += Math.min(400, validos.length - i)
    } catch (err) {
      console.error('POST /api/admin/productos/lote', err)
      // Si el lote falla (ej. un id borrado), probamos de a uno para salvar el resto.
      for (const v of validos.slice(i, i + 400)) {
        try { await db.collection('productos').doc(v.id).update(v.datos); guardados++ } catch { errores.push({ id: v.id, error: 'No se pudo guardar' }) }
      }
    }
  }
  return NextResponse.json({ ok: true, guardados, errores })
}
