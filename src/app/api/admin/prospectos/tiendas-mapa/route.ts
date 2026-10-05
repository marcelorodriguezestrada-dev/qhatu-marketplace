import { NextRequest, NextResponse } from 'next/server'
import { rubroOSM, type TiendaMapa } from '@/lib/prospectos'

export const dynamic = 'force-dynamic'

// Admin → 🎯 Captar tiendas: las tiendas que OpenStreetMap conoce en la
// parte del mapa que estás mirando (Overpass, gratis, sin API key).
// POST { sur, oeste, norte, este } → { tiendas: TiendaMapa[] }
// OSM no tiene todas las tiendas ni casi nunca su teléfono: lo que falte
// se completa a mano al guardar el prospecto.
const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const [s, o, n, e] = [b.sur, b.oeste, b.norte, b.este].map(Number)
  if (![s, o, n, e].every(Number.isFinite) || n <= s || e <= o) return NextResponse.json({ error: 'Falta la zona del mapa.' }, { status: 400 })
  // Más de ~5 km de lado es demasiado (tarda y trae miles): que acerque el mapa.
  if (n - s > 0.06 || e - o > 0.06) return NextResponse.json({ error: 'Acercá un poco más el mapa para buscar tiendas.' }, { status: 400 })
  const bbox = `${s},${o},${n},${e}`
  const q = `[out:json][timeout:20];(nwr[shop][name](${bbox});nwr[craft][name](${bbox});nwr[amenity~"^(restaurant|cafe|fast_food|pharmacy|ice_cream)$"][name](${bbox}););out tags center 400;`
  for (const url of SERVIDORES) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20_000)
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ClasiClick/1.0 (marketplace Potosí, Bolivia)' },
        body: `data=${encodeURIComponent(q)}`,
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer))
      if (!r.ok) continue
      const d = await r.json()
      const tiendas: TiendaMapa[] = (d.elements || [])
        .map((el: any) => {
          const t = el.tags || {}
          const lat = el.lat ?? el.center?.lat
          const lng = el.lon ?? el.center?.lon
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return {
            osmId: `${el.type}/${el.id}`,
            nombre: String(t.name),
            rubro: rubroOSM(t),
            lat,
            lng,
            telefono: String(t['contact:whatsapp'] || t['contact:mobile'] || t.mobile || t.phone || t['contact:phone'] || ''),
            direccion: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
            web: String(t.website || t['contact:website'] || t['contact:facebook'] || t['contact:instagram'] || ''),
          }
        })
        .filter(Boolean)
      return NextResponse.json({ tiendas })
    } catch {
      // probamos el otro servidor
    }
  }
  return NextResponse.json({ error: 'El mapa de tiendas (OpenStreetMap) no respondió. Probá de nuevo en un rato.' }, { status: 502 })
}
