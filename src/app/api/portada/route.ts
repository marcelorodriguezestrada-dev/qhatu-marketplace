import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Qué secciones de la portada se muestran (ver src/lib/portada.ts).
const IDS = ['ofertas', 'cupon', 'banners', 'accesos']

async function leer(): Promise<Record<string, boolean>> {
  const base: Record<string, boolean> = Object.fromEntries(IDS.map((id) => [id, true]))
  try {
    const guardada = (await getDb().collection('config').doc('portada').get()).data()?.secciones || {}
    for (const id of IDS) if (typeof guardada[id] === 'boolean') base[id] = guardada[id]
  } catch {}
  return base
}

export async function GET() {
  // Cache corto: al apagar algo desde el admin, se nota en menos de un minuto.
  return NextResponse.json({ portada: await leer() }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' } })
}

// POST (admin) { secciones: { ofertas: false, ... } }
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const actual = await leer()
    for (const id of IDS) if (typeof body.secciones?.[id] === 'boolean') actual[id] = body.secciones[id]
    await getDb().collection('config').doc('portada').set({ secciones: actual, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, portada: actual })
  } catch (err) {
    console.error('POST /api/portada', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
