import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { extraerDatosCV, categorizarAnuncio } from '@/lib/moderacionIA'
import { construirArbolCategorias } from '@/lib/categoriasServer'

export const dynamic = 'force-dynamic'

// POST { texto: string } — el navegador ya leyó el CV (PDF o
// foto/escaneo, ver src/lib/leerArchivoTexto.ts) y acá le pedimos a la
// IA que arme una propuesta de presentación: nombre, especialidad,
// experiencia, descripción, y de yapa un rubro sugerido de entre los
// que ya existen en la plataforma. Es solo una PROPUESTA — se muestra
// en el formulario para que la persona (o el admin) la revise, edite lo
// que haga falta y recién ahí la guarde. Nada de esto escribe en la
// base de datos.
//
// Acepta dos formas de autenticarse, igual que /api/upload-image: un
// usuario logueado (lo usa /mi-perfil) o la contraseña de admin (lo usa
// /admin) — así no queda un endpoint que llama a la IA abierto a
// cualquiera.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  const passwordAdmin = req.headers.get('x-admin-password')
  const esAdmin = !!passwordAdmin && passwordAdmin === process.env.ADMIN_PASSWORD

  if (!usuario && !esAdmin) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para usar esto.' }, { status: 401 })
  }

  try {
    const { texto } = await req.json()
    if (!texto || typeof texto !== 'string' || texto.trim().length < 30) {
      return NextResponse.json(
        { error: 'No se pudo leer suficiente texto del archivo. Probá con un PDF con texto real o una foto más clara.' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Esta función todavía no está configurada en el servidor (falta GROQ_API_KEY).' }, { status: 500 })
    }

    // Recortamos por las dudas — un CV largo no necesita mandarse
    // entero para que la IA saque lo esencial, y así el costo/latencia
    // no dependen de qué tan largo sea el archivo que subió la persona.
    const textoRecortado = texto.trim().slice(0, 6000)

    const datos = await extraerDatosCV(textoRecortado)
    if (!datos) {
      return NextResponse.json({ error: 'No se pudo procesar el CV con IA. Intentá de nuevo en un momento.' }, { status: 500 })
    }

    // Sugerencia de rubro sobre la lista REAL de rubros de la
    // plataforma (misma mecánica que ya usa /api/anuncios) — si ninguno
    // encaja bien, queda null y la persona lo elige a mano como siempre.
    let rubroSugerido: string | null = null
    try {
      const { rubrosFlat } = await construirArbolCategorias()
      rubroSugerido = await categorizarAnuncio(`${datos.especialidad}\n${datos.descripcion}`, rubrosFlat)
    } catch (err) {
      console.error('extraer-cv: sugerencia de rubro', err)
    }

    return NextResponse.json({ datos: { ...datos, rubroSugerido } })
  } catch (err) {
    console.error('POST /api/profesionales/extraer-cv', err)
    return NextResponse.json({ error: 'No se pudo procesar el CV.' }, { status: 500 })
  }
}
