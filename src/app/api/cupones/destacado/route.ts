import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { describirCupon, hoyBolivia, cuponVencido, textoVencimiento, type Cupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

// GET — público: el cupón marcado como "destacado" que esté vigente hoy
// (activo, dentro de fechas y con usos disponibles), para el banner de
// la portada y los productos. Solo datos para mostrar, nada de usos.
export async function GET() {
  try {
    const snap = await getDb().collection('cupones').where('destacado', '==', true).get()
    const hoy = hoyBolivia()
    const vigentes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Cupon)
      .filter((c) => c.activo && (!c.desde || hoy >= c.desde) && !cuponVencido(c) && !(c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    const c = vigentes[0]
    if (!c) return NextResponse.json({ cupon: null })
    return NextResponse.json(
      { cupon: { codigo: c.codigo, campana: c.campana || '', tipo: c.tipo, descripcion: describirCupon(c), hasta: c.hasta || '', vence: textoVencimiento(c) } },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (err) {
    console.error('GET /api/cupones/destacado', err)
    return NextResponse.json({ cupon: null })
  }
}
