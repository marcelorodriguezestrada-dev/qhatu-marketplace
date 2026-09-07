import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Body = {
  nombre?: string
  categoria?: string
  precio?: number | string
  imagenUrl?: string
  descripcionLarga?: string
  variantes?: number
}

// Endpoint que intenta usar un servicio externo (GROQ) si está configurado
// mediante las vars `GROQ_URL` y `GROQ_API_KEY`. Si no, cae en un fallback
// local muy simple que genera un título corto y una descripción.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const { nombre, categoria, precio, imagenUrl, descripcionLarga } = body
    const variantes = Math.max(1, Number(body.variantes || 1))

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
          body: JSON.stringify({ input: prompt, variantes }),
        })
        const j = await r.json()
        // Si el servicio devuelve varias variantes, respetarlas
        if (Array.isArray(j.suggestions)) {
          return NextResponse.json({ suggestions: j.suggestions })
        }
        // Se asume que el servicio puede devolver un objeto único
        if (j.title || j.short || j.long) {
          return NextResponse.json({ suggestions: [{ title: j.title, short: j.short, long: j.long }] })
        }
        // Si la respuesta no tiene el formato esperado, continuamos al fallback
      } catch (err) {
        console.error('GROQ request failed', err)
      }
    }

    // Fallback local: generar N variantes heurísticas
    function makeBase(i: number) {
      const suffixes = [' en excelente estado', ' — excelente relación precio/calidad', ' (nuevo o poco uso)']
      const title = nombre && nombre.length < 60 ? nombre : (nombre ? `${nombre}` : `Producto ${categoria || ''}`)
      let short = ''
      if (descripcionLarga && descripcionLarga.length > 30) {
        short = descripcionLarga.trim().split('\n')[0].slice(0, 120)
      } else if (nombre) {
        short = nombre
      } else {
        short = `Producto en ${categoria || 'varios'}`
      }
      const long = descripcionLarga || `${title}${suffixes[i % suffixes.length]}. Consultar medidas y envío.`
      return { title: i === 0 ? title : `${title} ${i === 1 ? '- Oferta' : '- Edición limitada'}`, short, long }
    }

    const suggestions = [] as Array<{ title: string; short: string; long: string }>
    for (let i = 0; i < variantes; i++) suggestions.push(makeBase(i))
    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('POST /api/generate-description', err)
    return NextResponse.json({ error: 'No se pudo generar la descripción.' }, { status: 500 })
  }
}
