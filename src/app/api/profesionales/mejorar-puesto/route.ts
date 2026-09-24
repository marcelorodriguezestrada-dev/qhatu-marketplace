import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { mejorarPuestoLaboral } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// POST { cargo, empresa, texto, especialidad? } — la persona escribió
// con sus palabras qué hacía en un puesto y la IA lo devuelve como
// logros prolijos para su CV (ver mejorarPuestoLaboral). No escribe
// nada en la base: la propuesta vuelve al formulario para revisarla.
//
// Mismas dos formas de autenticarse que /api/profesionales/extraer-cv:
// usuario logueado (/mi-perfil) o contraseña de admin (/admin).
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  const passwordAdmin = req.headers.get('x-admin-password')
  const esAdmin = !!passwordAdmin && passwordAdmin === process.env.ADMIN_PASSWORD

  if (!usuario && !esAdmin) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para usar esto.' }, { status: 401 })
  }

  try {
    const { cargo, empresa, texto, especialidad } = await req.json()
    const textoLimpio = typeof texto === 'string' ? texto.trim().slice(0, 3000) : ''
    if (textoLimpio.length < 10) {
      return NextResponse.json({ error: 'Contá con un poco más de detalle qué hacías en ese puesto.' }, { status: 400 })
    }
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Esta función todavía no está configurada en el servidor (falta GROQ_API_KEY).' }, { status: 500 })
    }

    const resultado = await mejorarPuestoLaboral({
      cargo: String(cargo || '').slice(0, 100),
      empresa: String(empresa || '').slice(0, 100),
      especialidad: String(especialidad || '').slice(0, 120),
      texto: textoLimpio,
    })
    if (!resultado) {
      return NextResponse.json({ error: 'No se pudo redactar con IA. Intentá de nuevo en un momento.' }, { status: 500 })
    }
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('POST /api/profesionales/mejorar-puesto', err)
    return NextResponse.json({ error: 'No se pudo procesar el pedido.' }, { status: 500 })
  }
}
