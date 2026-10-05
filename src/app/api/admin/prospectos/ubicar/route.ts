import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Ubica en el mapa la dirección de un prospecto con Nominatim
// (OpenStreetMap). Nominatim pide 1 consulta por segundo: el panel las
// manda de a una. POST { direccion, nombre, ciudad } →
// { lat, lng, exacta } (exacta = encontró la dirección; si no, el nombre
// del negocio o la calle sola) o { lat: null } si no encontró nada.
const CIUDAD: Record<string, { nombre: string; caja: string }> = {
  potosi: { nombre: 'Potosí', caja: '-65.82,-19.52,-65.69,-19.65' },
  'la-paz': { nombre: 'La Paz', caja: '-68.25,-16.40,-68.02,-16.60' },
}

async function buscar(q: string, caja: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&viewbox=${caja}&bounded=1&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'ClasiClick/1.0 (marketplace Potosí, Bolivia)' } })
  if (!r.ok) throw new Error(String(r.status))
  const d = await r.json()
  return Array.isArray(d) && d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon) } : null
}

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const c = CIUDAD[b.ciudad] || CIUDAD.potosi
  const direccion = String(b.direccion || '').replace(/\([^)]*\)/g, '').trim()
  const nombre = String(b.nombre || '').replace(/\([^)]*\)/g, '').trim()
  try {
    if (direccion) {
      const r = await buscar(`${direccion}, ${c.nombre}, Bolivia`, c.caja)
      if (r) return NextResponse.json({ ...r, exacta: true })
    }
    if (nombre) {
      await new Promise((ok) => setTimeout(ok, 1100))
      const r = await buscar(`${nombre}, ${c.nombre}`, c.caja)
      if (r) return NextResponse.json({ ...r, exacta: false, por: 'nombre' })
    }
    // "Almirante Grau 321, San Pedro" → probamos solo la calle.
    const calle = direccion.split(',')[0].replace(/\d+/g, '').trim()
    if (calle && calle !== direccion) {
      await new Promise((ok) => setTimeout(ok, 1100))
      const r = await buscar(`${calle}, ${c.nombre}, Bolivia`, c.caja)
      if (r) return NextResponse.json({ ...r, exacta: false, por: 'calle' })
    }
    return NextResponse.json({ lat: null, lng: null })
  } catch {
    return NextResponse.json({ lat: null, lng: null, error: 'El buscador de direcciones no respondió.' })
  }
}
