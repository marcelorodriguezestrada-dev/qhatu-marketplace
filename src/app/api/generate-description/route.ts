import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Body = {
  nombre?: string
  categoria?: string
  precio?: number | string
  imagenUrl?: string
  descripcionLarga?: string
}

// Endpoint que intenta usar un servicio externo (GROQ) si está configurado
// mediante las vars `GROQ_URL` y `GROQ_API_KEY`. Si no, cae en un fallback
// local muy simple que genera un título corto y una descripción.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const { nombre, categoria, precio, imagenUrl, descripcionLarga } = body

    const groqUrl = process.env.GROQ_URL
    const groqKey = process.env.GROQ_API_KEY

    if (groqUrl && groqKey) {
      try {
        const prompt = {
          nombre: nombre || '',
          categoria: categoria || '',
          precio: precio || '',
          imagenUrl: imagenUrl || '',
          descripcion: descripcionLarga || '',
        }
        const r = await fetch(groqUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({ input: prompt }),
        })
        const j = await r.json()
        // Se asume que el servicio devuelve { title, short, long }
        if (j.title || j.short || j.long) {
          return NextResponse.json({ title: j.title, short: j.short, long: j.long })
        }
        // Si la respuesta no tiene el formato esperado, continuamos al fallback
      } catch (err) {
        console.error('GROQ request failed', err)
      }
    }

    // Fallback local: heurísticos simples
    const title = nombre && nombre.length < 60 ? nombre : (nombre ? nombre.slice(0, 60) : `Producto ${categoria || ''}`)
    let short = ''
    if (descripcionLarga && descripcionLarga.length > 30) {
      short = descripcionLarga.trim().split('\n')[0].slice(0, 120)
    } else if (nombre) {
      short = nombre
    } else {
      short = `Producto en ${categoria || 'varios'}`
    }
    let long = descripcionLarga || ''
    if (!long && nombre) long = `${nombre} en excelente estado. Consultar medidas y envío.`

    return NextResponse.json({ title, short, long })
  } catch (err) {
    console.error('POST /api/generate-description', err)
    return NextResponse.json({ error: 'No se pudo generar la descripción.' }, { status: 500 })
  }
}
