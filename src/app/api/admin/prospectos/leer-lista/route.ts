import { NextRequest, NextResponse } from 'next/server'
import { leerListaPegada, type FilaPegada } from '@/lib/prospectos'

export const dynamic = 'force-dynamic'

// Admin → 🎯 Captar tiendas → "📋 Pegar lista": convierte un texto
// (tabla copiada de una planilla, de un chat o de otra IA) en filas
// { nombre, direccion, telefono, rubro, notas }. Con GROQ_API_KEY la IA
// lo ordena y adivina el rubro; si no hay IA (o falla) se lee renglón por
// renglón (src/lib/prospectos.ts → leerListaPegada).
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const texto = String(b.texto || '').slice(0, 12000)
  if (!texto.trim()) return NextResponse.json({ error: 'Pegá la lista de tiendas.' }, { status: 400 })
  const local = leerListaPegada(texto)

  const apiKey = process.env.GROQ_API_KEY
  if (apiKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          max_completion_tokens: 3000,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Extraé tiendas/negocios de Bolivia de un texto pegado (tabla, lista o chat). Una por negocio. ' +
                'nombre: solo el nombre del negocio (sin aclaraciones). direccion: calle, número y zona tal cual (sin la ciudad). ' +
                'telefono: el número tal cual, con +591 si lo tiene. rubro: en 1 o 2 palabras en castellano según el nombre (ej. Ropa, Calzado, Boutique, Accesorios); vacío si no se puede saber. ' +
                'notas: aclaraciones entre paréntesis u otros datos (ej. "ya tiene web", "fijo", "sin calle exacta"). No inventes datos. ' +
                'Ignorá encabezados. Respondé SOLO JSON: {"filas": [{"nombre": "", "direccion": "", "telefono": "", "rubro": "", "notas": ""}]}',
            },
            { role: 'user', content: texto },
          ],
        }),
      })
      if (res.ok) {
        const d = await res.json()
        const j = JSON.parse(String(d.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim())
        const filas: FilaPegada[] = (Array.isArray(j.filas) ? j.filas : [])
          .map((f: any) => ({ nombre: String(f.nombre || '').trim(), direccion: String(f.direccion || '').trim(), telefono: String(f.telefono || '').trim(), rubro: String(f.rubro || '').trim(), notas: String(f.notas || '').trim() }))
          .filter((f: FilaPegada) => f.nombre.length >= 2)
          .slice(0, 200)
        if (filas.length >= local.length) return NextResponse.json({ filas, ia: true })
      } else {
        console.error('leer-lista: Groq respondió', res.status)
      }
    } catch (err) {
      console.error('leer-lista', err)
    }
  }
  if (!local.length) return NextResponse.json({ error: 'No encontré tiendas en ese texto: poné una por renglón (nombre, dirección, teléfono).' }, { status: 400 })
  return NextResponse.json({ filas: local, ia: false })
}
