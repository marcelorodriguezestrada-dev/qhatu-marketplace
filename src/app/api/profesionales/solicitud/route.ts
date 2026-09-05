import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { evaluarConIA } from '@/lib/moderacionIA'

export const dynamic = 'force-dynamic'

// POST público (sin login, sin contraseña) — es el formulario que
// llena un profesional que quiere aparecer en el directorio. Queda
// guardado con estado "pendiente_revision": no aparece en /servicios
// hasta que vos lo apruebes desde /admin. No acepta foto — para evitar
// abrir el endpoint de subida de imágenes al público sin ningún tipo de
// autenticación, la foto se agrega después, cuando aprobás la
// solicitud (o coordinándola directamente con el profesional).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, rubro, descripcion, zona, whatsapp, precio, experiencia } = body
    if (!nombre || !rubro || !whatsapp) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (nombre, rubro, WhatsApp).' }, { status: 400 })
    }

    // Pre-filtro de moderación con IA — solo etiqueta el riesgo para
    // ayudarte a priorizar en la cola de /admin, nunca aprueba o
    // rechaza por su cuenta.
    const moderacionIA = await evaluarConIA(
      `Solicitud de profesional.\nNombre: ${nombre}\nRubro: ${rubro}\nZona: ${zona || 'no especificada'}\n` +
      `Descripción: ${descripcion || '(sin descripción)'}\n` +
      `Precio: ${precio ? `Bs ${precio}` : 'a convenir'}\nExperiencia declarada: ${experiencia || 'no especificada'}`
    )

    const db = getDb()
    const ref = await db.collection('profesionales').add({
      nombre,
      rubro,
      descripcion: descripcion || '',
      zona: zona || '',
      lat: null,
      lng: null,
      whatsapp,
      icono: 'otro',
      imagenUrl: '',
      precio: precio ? Number(precio) : null,
      experiencia: experiencia || '',
      plan: 'basico',
      estado: 'pendiente_revision',
      moderacionIA,
      ratingPromedio: 0,
      cantidadResenas: 0,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/profesionales/solicitud', err)
    return NextResponse.json({ error: 'No se pudo enviar la solicitud.' }, { status: 500 })
  }
}
