import { NextRequest, NextResponse } from 'next/server'
import { esClaveAdmin } from '@/lib/adminAuth'
import { getDb } from '@/lib/firebaseAdmin'
import { LIMITE_GRATIS_DIA, RUTAS_SIN_PAUSA, aplicarConfig, diaCuota, guardarConsumoAhora } from '@/lib/consumoFirestore'
import { AJUSTES, IDS_AJUSTES, valorAjuste } from '@/lib/ajustesConsumo'

export const dynamic = 'force-dynamic'

const noAutorizado = () => NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

// GET (admin): lecturas de la base de hoy y de los últimos 7 días, por
// página/API (ver src/lib/consumoFirestore.ts), y la config de pausas.
export async function GET(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return noAutorizado()
  guardarConsumoAhora()
  const db = getDb()
  const dias = Array.from({ length: 7 }, (_, i) => diaCuota(new Date(Date.now() - i * 86_400_000)))
  try {
    const [config, ...docs] = await db.getAll(db.collection('config').doc('consumoFirestore'), ...dias.map((d) => db.collection('consumoFirestore').doc(d)))
    const c = config.data() || {}
    return NextResponse.json({
      limite: LIMITE_GRATIS_DIA,
      hoy: dias[0],
      dias: docs.map((d, i) => {
        const x = d.data() || {}
        const rutas = Object.values(x.rutas || {})
          .map((r: any) => ({ ruta: String(r?.nombre || ''), lecturas: Number(r?.lecturas || 0) }))
          .filter((r) => r.ruta)
          .sort((a, b) => b.lecturas - a.lecturas)
        return { dia: dias[i], total: Number(x.total || 0), horas: x.horas || {}, rutas, actualizado: x.actualizado || null }
      }),
      pausadas: Array.isArray(c.pausadas) ? c.pausadas : [],
      ahorro: c.ahorro === true,
      intervalos: Object.fromEntries(IDS_AJUSTES.map((id) => [id, valorAjuste(id, c.intervalos)])),
      sinPausa: RUTAS_SIN_PAUSA,
    })
  } catch (err: any) {
    const sinCuota = /RESOURCE_EXHAUSTED|Quota/i.test(String(err?.message || err))
    return NextResponse.json(
      { error: sinCuota ? 'Se acabaron las lecturas gratis de hoy: los números vuelven cuando se reinicie la cuota (medianoche de EE.UU., 03:00–04:00 en Bolivia).' : 'No se pudo leer el consumo.', sinCuota },
      { status: 503 }
    )
  }
}

// POST (admin) { pausadas?: string[], ahorro?: boolean, intervalos?: { campanita: 300, ... } }
export async function POST(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return noAutorizado()
  const body = await req.json().catch(() => ({}))
  const cambios: { pausadas?: string[]; ahorro?: boolean; intervalos?: Record<string, number> } = {}
  if (Array.isArray(body.pausadas)) {
    cambios.pausadas = Array.from(new Set(body.pausadas.map((r: unknown) => String(r).slice(0, 120)).filter((r: string) => r && !RUTAS_SIN_PAUSA.includes(r)))).slice(0, 50) as string[]
  }
  if (typeof body.ahorro === 'boolean') cambios.ahorro = body.ahorro
  if (body.intervalos && typeof body.intervalos === 'object') {
    // Solo valores de la lista de opciones de cada ajuste.
    cambios.intervalos = Object.fromEntries(IDS_AJUSTES.filter((id) => AJUSTES[id].opciones.includes(Number(body.intervalos[id]))).map((id) => [id, Number(body.intervalos[id])]))
  }
  try {
    const ref = getDb().collection('config').doc('consumoFirestore')
    if (cambios.intervalos) {
      // Se combinan con los guardados (cambiar uno no borra los otros).
      const previos = (await ref.get()).data()?.intervalos || {}
      cambios.intervalos = { ...previos, ...cambios.intervalos }
    }
    await ref.set({ ...cambios, actualizado: new Date().toISOString() }, { merge: true })
    aplicarConfig(cambios)
    return NextResponse.json({ ok: true, ...cambios })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar (¿sin cuota de la base?).' }, { status: 503 })
  }
}
