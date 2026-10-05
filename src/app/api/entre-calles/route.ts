import { NextRequest, NextResponse } from 'next/server'
import { analizarEntreCalles, type CalleOSM } from '@/lib/entreCalles'

export const dynamic = 'force-dynamic'

// Entre qué calles queda la casa del comprador: pide a Overpass (la API
// gratis de OpenStreetMap) las calles con nombre a 350 m del punto y
// calcula la calle y sus dos esquinas (ver src/lib/entreCalles.ts).
// POST { lat, lng, calle } → { calle, sugeridas, cruces, cercanas }
// Si Overpass no responde devuelve { calle: null } y el checkout no
// verifica nada (no es culpa del comprador que el servicio esté caído).
const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const cache = new Map<string, { t: number; calles: CalleOSM[] }>()

async function callesCerca(lat: number, lng: number): Promise<CalleOSM[] | null> {
  const k = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const c = cache.get(k)
  if (c && Date.now() - c.t < 24 * 3600_000) return c.calles
  const q = `[out:json][timeout:12];way(around:350,${lat},${lng})[highway][name];out tags geom;`
  for (const url of SERVIDORES) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12_000)
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ClasiClick/1.0 (marketplace Potosí, Bolivia)' },
        body: `data=${encodeURIComponent(q)}`,
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer))
      if (!r.ok) continue
      const d = await r.json()
      const calles: CalleOSM[] = (d.elements || [])
        .filter((e: any) => e.type === 'way' && e.tags?.name && Array.isArray(e.geometry))
        .map((e: any) => ({ nombre: String(e.tags.name), puntos: e.geometry.map((g: any) => ({ lat: g.lat, lon: g.lon })) }))
      if (cache.size > 500) cache.clear()
      cache.set(k, { t: Date.now(), calles })
      return calles
    } catch {
      // probamos el otro servidor
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Falta el punto.' }, { status: 400 })
  }
  const calles = await callesCerca(lat, lng)
  if (!calles) return NextResponse.json({ calle: null, sugeridas: [], cruces: [], cercanas: [], motivo: 'servicio_no_disponible' })
  return NextResponse.json(analizarEntreCalles(calles, { lat, lng }, String(body.calle || '').slice(0, 120)))
}
