import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { MAX_FOTOS_ADICIONALES_PREMIUM } from '@/lib/planPremium'
import { codigoTienda } from '@/lib/importarCarpeta'

export const dynamic = 'force-dynamic'

// Admin → Productos → Edición rápida → "Unir": el mismo producto cargado
// varias veces con distinta foto ("Banquito a", "Banquito c", "Banquito v")
// queda como UNO ("Banquito") con todas las fotos. Se queda el primero de
// la lista (con sus datos, preguntas y reseñas) y se borran los demás.
// POST { ids: string[], nombre, borrar?: string[] } → { ok, id, fotos }
// borrar: repetidos que se borran SIN sumar sus fotos (ej. el producto ya
// trae todas las fotos y los otros son las cargas viejas de a una).
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((x: unknown) => typeof x === 'string' && x))) : []
  const nombre = String(body.nombre || '').trim().slice(0, 120)
  const borrar: string[] = Array.isArray(body.borrar) ? body.borrar.filter((x: unknown) => typeof x === 'string' && x && !ids.includes(x as string)) : []
  if (ids.length + borrar.length < 2) return NextResponse.json({ error: 'Elegí al menos dos productos para unir.' }, { status: 400 })
  if (nombre.length < 2) return NextResponse.json({ error: 'Falta el nombre del producto.' }, { status: 400 })
  try {
    const db = getDb()
    const docs = await Promise.all(ids.map((id) => db.collection('productos').doc(id).get()))
    const aBorrar = await Promise.all(borrar.map((id) => db.collection('productos').doc(id).get()))
    if ([...docs, ...aBorrar].some((d) => !d.exists)) return NextResponse.json({ error: 'Alguno de los productos ya no existe. Recargá la lista.' }, { status: 404 })
    const datos = docs.map((d) => d.data()!)
    const vendedores = new Set([...datos, ...aBorrar.map((d) => d.data()!)].map((d) => d.vendedorId || ''))
    if (vendedores.size > 1) return NextResponse.json({ error: 'Solo se pueden unir productos de la misma tienda.' }, { status: 400 })
    // Todas las fotos, sin repetir: la principal de cada uno y sus adicionales.
    const fotos: string[] = []
    for (const d of datos) for (const u of [d.imagenUrl, ...(Array.isArray(d.fotosAdicionales) ? d.fotosAdicionales : [])]) if (typeof u === 'string' && u && !fotos.includes(u)) fotos.push(u)
    const [principal, ...resto] = fotos
    const quedan = resto.slice(0, MAX_FOTOS_ADICIONALES_PREMIUM)
    const primero = datos[0]
    const tienda = typeof primero.claveImportacion === 'string' ? primero.claveImportacion.split('::')[0] : ''
    // Stock: si todos lo controlan, se suma (cada carga era una unidad más); si no, el del primero.
    const stocks = datos.map((d) => d.stock)
    const stock = stocks.every((s) => typeof s === 'number') ? stocks.reduce((a, b) => a + b, 0) : primero.stock ?? null
    const cambios: Record<string, unknown> = {
      nombre,
      ...(principal ? { imagenUrl: principal, thumbUrl: datos.find((d) => d.imagenUrl === principal)?.thumbUrl || principal } : {}),
      fotosAdicionales: quedan,
      stock,
      ...(tienda ? { claveImportacion: `${tienda}::${codigoTienda(nombre)}` } : {}),
      updatedAt: new Date().toISOString(),
    }
    const lote = db.batch()
    lote.update(docs[0].ref, cambios)
    for (const d of [...docs.slice(1), ...aBorrar]) lote.delete(d.ref)
    await lote.commit()
    return NextResponse.json({ ok: true, id: ids[0], fotos: fotos.length, sobraron: Math.max(0, resto.length - quedan.length) })
  } catch (err) {
    console.error('POST /api/admin/productos/unir', err)
    return NextResponse.json({ error: 'No se pudieron unir los productos.' }, { status: 500 })
  }
}
