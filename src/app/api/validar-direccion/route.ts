import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Valida una dirección contra Nominatim (el geocodificador gratis de
// OpenStreetMap) — no hace falta API key, a cambio de dos reglas de su
// política de uso que hay que respetar si o si:
// 1. Mandar un User-Agent que identifique la app (no el default de fetch).
// 2. Como máximo 1 pedido por segundo PARA TODO EL SITIO, no por usuario
//    — Nominatim es un servicio compartido y gratuito, se corta el acceso
//    si se abusa. Para un negocio chico esto alcanza de sobra, pero si el
//    día de mañana esto se llena de tráfico, hay que pasarse a un
//    proveedor pago (Google Geocoding, Mapbox) con su propio límite.
//
// OJO con lo que esto SÍ y NO garantiza: que Nominatim encuentre una
// coincidencia dice que esa calle/zona existe en el mapa de OpenStreetMap
// — no confirma que el número de puerta exista, ni mucho menos que la
// persona viva ahí. Y que NO la encuentre no significa que la dirección
// sea falsa: OpenStreetMap en Potosí puede tener calles nuevas o barrios
// informales sin mapear todavía. Por eso en el checkout esto se usa como
// aviso, no como bloqueo — ver el comentario en checkout/page.tsx.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const direccion = (body.direccion || '').trim()
    if (!direccion) {
      return NextResponse.json({ error: 'Falta la dirección.' }, { status: 400 })
    }

    const consulta = `${direccion}, Potosí, Bolivia`
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&q=${encodeURIComponent(consulta)}`

    const res = await fetch(url, {
      headers: {
        // Nominatim exige identificar la app que llama — un User-Agent
        // genérico de librería HTTP hace que bloqueen el pedido.
        'User-Agent': 'ClasiClick/1.0 (marketplace Potosí, Bolivia)',
      },
    })
    if (!res.ok) {
      return NextResponse.json({ encontrada: false, motivo: 'servicio_no_disponible' })
    }

    const resultados = await res.json()
    if (!Array.isArray(resultados) || resultados.length === 0) {
      return NextResponse.json({ encontrada: false })
    }

    const match = resultados[0]
    return NextResponse.json({
      encontrada: true,
      lat: Number(match.lat),
      lng: Number(match.lon),
      direccionEncontrada: match.display_name,
    })
  } catch (err) {
    console.error('POST /api/validar-direccion', err)
    // Si Nominatim falla o está lento, no queremos que eso le tranque
    // la compra a nadie — el checkout lo trata igual que "no encontrada".
    return NextResponse.json({ encontrada: false, motivo: 'error' })
  }
}
