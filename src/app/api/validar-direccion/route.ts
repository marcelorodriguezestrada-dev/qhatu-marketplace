import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Valida una dirección contra Nominatim (el geocodificador gratis de
// OpenStreetMap) — no hace falta API key, a cambio de dos reglas de su
// política de uso que hay que respetar sí o sí:
// 1. Mandar un User-Agent que identifique la app (no el default de fetch).
// 2. Como máximo 1 pedido por segundo PARA TODO EL SITIO, no por usuario
//    — Nominatim es un servicio compartido y gratuito, se corta el acceso
//    si se abusa. Para un negocio chico esto alcanza de sobra, pero si el
//    día de mañana esto se llena de tráfico, hay que pasarse a un
//    proveedor pago (Google Geocoding, Mapbox) con su propio límite.
//
// Este endpoint devuelve tres resultados posibles, a propósito
// distintos entre sí porque el checkout los trata distinto (ver el
// comentario largo en checkout/page.tsx sobre por qué es bloqueante):
// - encontrada: true  → hay una calle/zona que matchea en OpenStreetMap.
// - encontrada: false → se pudo consultar bien, y NO matchea nada
//   razonable (dirección demasiado corta/vacía de contenido, o
//   Nominatim no encontró nada parecido). Esto bloquea el checkout.
// - encontrada: null  → no se pudo ni consultar (Nominatim caído,
//   sin red, etc.). Esto NO bloquea — no es culpa de la persona que
//   compra que el servicio gratuito esté caído, y frenarle la compra
//   por un corte de un tercero sería peor negocio que dejarla pasar.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const direccion = (body.direccion || '').trim()
    if (!direccion) {
      return NextResponse.json({ error: 'Falta la dirección.' }, { status: 400 })
    }

    // Filtro rápido antes de gastar el pedido a Nominatim: una
    // dirección real en Potosí siempre tiene alguna letra (nombre de
    // calle/zona), no solo números — esto es lo que dejaba pasar cosas
    // como "33" o "1" (Nominatim a veces matchea un número suelto con
    // cualquier cosa, un código postal, un kilómetro de ruta, etc.).
    const tieneLetras = /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(direccion)
    if (direccion.length < 5 || !tieneLetras) {
      return NextResponse.json({ encontrada: false, motivo: 'Escribí la calle y el número, no alcanza con un número solo.' })
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
      return NextResponse.json({ encontrada: null, motivo: 'servicio_no_disponible' })
    }

    const resultados = await res.json()
    if (!Array.isArray(resultados) || resultados.length === 0) {
      return NextResponse.json({ encontrada: false, motivo: 'No encontramos esa dirección — revisá que esté bien escrita.' })
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
    // Nominatim falló de verdad (timeout, red, etc.) — distinto de "no
    // la encontramos": acá no sabemos si es válida o no, así que no
    // bloqueamos (ver el comentario de arriba sobre encontrada: null).
    return NextResponse.json({ encontrada: null, motivo: 'error' })
  }
}
