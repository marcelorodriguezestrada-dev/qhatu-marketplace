import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { CIUDADES, CIUDAD_POR_DEFECTO, esCiudadId } from '@/data/ciudades'

export const dynamic = 'force-dynamic'

// Qué ciudades están abiertas (y con envío Clasi Click). El admin las
// prende/apaga desde Admin → Inicio → Ciudades; se guarda en
// config/ciudades. Sin config guardada, vale lo de src/data/ciudades.ts.
type ConfigCiudad = { activa: boolean; envioClasiClick: boolean }

async function leerConfig(): Promise<Record<string, ConfigCiudad>> {
  const base: Record<string, ConfigCiudad> = {}
  for (const c of CIUDADES) base[c.id] = { activa: c.activa, envioClasiClick: c.envioClasiClick }
  try {
    const doc = await getDb().collection('config').doc('ciudades').get()
    const guardada = (doc.data()?.ciudades || {}) as Record<string, Partial<ConfigCiudad>>
    for (const [id, v] of Object.entries(guardada)) {
      if (!base[id]) continue
      if (typeof v.activa === 'boolean') base[id].activa = v.activa
      if (typeof v.envioClasiClick === 'boolean') base[id].envioClasiClick = v.envioClasiClick
    }
  } catch {}
  base[CIUDAD_POR_DEFECTO].activa = true // Potosí siempre abierta
  return base
}

export async function GET() {
  const config = await leerConfig()
  const ciudades = CIUDADES.map((c) => ({ id: c.id, nombre: c.nombre, departamento: c.departamento, ...config[c.id] }))
  return NextResponse.json({ ciudades }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } })
}

// POST (admin) { ciudades: { 'la-paz': { activa, envioClasiClick } } }
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const actual = await leerConfig()
    for (const [id, v] of Object.entries((body.ciudades || {}) as Record<string, any>)) {
      if (!esCiudadId(id)) continue
      if (typeof v?.activa === 'boolean') actual[id].activa = id === CIUDAD_POR_DEFECTO ? true : v.activa
      if (typeof v?.envioClasiClick === 'boolean') actual[id].envioClasiClick = v.envioClasiClick
    }
    await getDb().collection('config').doc('ciudades').set({ ciudades: actual, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, ciudades: actual })
  } catch (err) {
    console.error('POST /api/ciudades', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
