import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sumarMetricaDiaria } from '@/lib/metricasDiarias'

export const dynamic = 'force-dynamic'

// POST público, sin autenticación — se llama cada vez que alguien filtra
// por una categoría de producto o un rubro de servicio. Es la base real
// para identificar qué nichos buscan más (medicina, inmuebles, etc.),
// en vez de adivinar. Solo guarda un contador por categoría, nada de
// datos personales de quién hizo la búsqueda.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tipo, valor } = body // tipo: "producto" | "servicio", valor: nombre de la categoría/rubro
    if (!tipo || !valor || !['producto', 'servicio'].includes(tipo)) {
      return NextResponse.json({ ok: false })
    }
    const id = `${tipo}:${valor}`
    await getDb().collection('analitica_categorias').doc(id).set(
      { tipo, valor, clics: FieldValue.increment(1) },
      { merge: true }
    )
    sumarMetricaDiaria(tipo === 'producto' ? 'busquedasProductos' : 'busquedasServicios').catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}
