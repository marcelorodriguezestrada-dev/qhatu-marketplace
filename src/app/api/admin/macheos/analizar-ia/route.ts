import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { construirArbolCategorias } from '@/lib/categoriasServer'
import { sugerirMatcheosIA } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// Para no mandar un prompt gigante (y porque un análisis manual del
// admin no necesita ver los últimos 500 anuncios de una), nos quedamos
// con los más recientes de cada lista.
const MAX_ANUNCIOS = 15
const MAX_PROFESIONALES = 60

// POST — botón "Analizar con IA posibles matcheos" de /admin. Busca
// los anuncios "busco X" aprobados que el macheo automático por rubro
// NO resolvió (sin rubro, o rubro sin ningún profesional cargado), y le
// pide a la IA sugerencias razonables cruzando texto. No guarda nada ni
// avisa a nadie — solo devuelve la lista para que el admin decida qué
// mandar con el otro botón ("Sugerir a ambas partes").
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const [anunciosSnap, profesionalesSnap, arbol] = await Promise.all([
      db.collection('anuncios').where('tipo', '==', 'busqueda').where('estado', '==', 'aprobado').get(),
      db.collection('profesionales').where('estado', '==', 'aprobado').get(),
      construirArbolCategorias(),
    ])

    const anuncios = anunciosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const profesionales = profesionalesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const labelPorRubro = new Map(arbol.rubrosFlat.map((r) => [r.id, r.label]))

    // Rubros que ya tienen al menos un profesional aprobado — un
    // anuncio con uno de estos rubros ya recibió el macheo exacto
    // normal, así que no hace falta gastarle presupuesto de IA.
    const rubrosConProfesional = new Set(profesionales.map((p) => p.rubro).filter(Boolean))

    const anunciosSinMatch = anuncios
      .filter((a) => !a.rubro || !rubrosConProfesional.has(a.rubro))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, MAX_ANUNCIOS)

    if (anunciosSinMatch.length === 0) {
      return NextResponse.json({ sugerencias: [], mensaje: 'Todos los anuncios activos ya tienen matcheo por rubro exacto — no hay nada que la IA pueda sumar por ahora.' })
    }

    const profesionalesRecientes = [...profesionales]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, MAX_PROFESIONALES)

    const sugerenciasCrudas = await sugerirMatcheosIA(
      anunciosSinMatch.map((a) => ({ id: a.id, titulo: a.titulo, descripcion: a.descripcion })),
      profesionalesRecientes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        rubroLabel: labelPorRubro.get(p.rubro) || p.rubro || 'Sin rubro',
        descripcion: p.descripcion || p.especialidad || '',
      }))
    )

    const anuncioPorId = new Map(anunciosSinMatch.map((a) => [a.id, a]))
    const profesionalPorId = new Map(profesionalesRecientes.map((p) => [p.id, p]))

    // Enriquecemos con los nombres para que el admin no tenga que
    // cruzar ids a mano en la pantalla.
    const sugerencias = sugerenciasCrudas
      .map((s) => {
        const anuncio = anuncioPorId.get(s.anuncioId)
        const profesional = profesionalPorId.get(s.profesionalId)
        if (!anuncio || !profesional) return null
        return {
          anuncioId: s.anuncioId,
          anuncioTitulo: anuncio.titulo,
          anuncioDescripcion: anuncio.descripcion,
          profesionalId: s.profesionalId,
          profesionalNombre: profesional.nombre,
          profesionalRubroLabel: labelPorRubro.get(profesional.rubro) || profesional.rubro || 'Sin rubro',
          motivo: s.motivo,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ sugerencias, analizados: anunciosSinMatch.length })
  } catch (err) {
    console.error('POST /api/admin/macheos/analizar-ia', err)
    return NextResponse.json({ error: 'No se pudo analizar con IA.' }, { status: 500 })
  }
}
