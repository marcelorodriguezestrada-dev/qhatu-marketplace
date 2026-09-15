import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// GET — solo admin: todos los candidatos, sin filtrar (la pantalla de
// /admin decide cómo agruparlos por estado).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const snap = await getDb().collection('candidatosProfesional').get()
    const candidatos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json({ candidatos })
  } catch (err) {
    console.error('GET /api/admin/candidatos-profesional', err)
    return NextResponse.json({ error: 'No se pudieron cargar los candidatos.' }, { status: 500 })
  }
}

// POST — solo admin: alta en lote desde texto pegado de WhatsApp
// (mismo parser que ya usás para anuncios). A DIFERENCIA de anuncios,
// ACÁ NADA se aprueba automáticamente, ni siquiera los que llegan
// completos — un profesional en el directorio es una garantía pública
// hacia los usuarios, así que cada uno pasa sí o sí por tu revisión
// manual antes de convertirse en un profesional real.
export async function POST(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const { candidatos } = await req.json()
    if (!Array.isArray(candidatos) || candidatos.length === 0) {
      return NextResponse.json({ error: 'No hay nada para importar.' }, { status: 400 })
    }

    const db = getDb()
    const batch = db.batch()
    let creados = 0
    for (const c of candidatos) {
      if (!c.titulo || !c.telefono) continue
      const ref = db.collection('candidatosProfesional').doc()
      batch.set(ref, {
        titulo: c.titulo,
        descripcion: c.descripcion || '',
        telefono: c.telefono,
        fecha: c.fecha || null,
        incompleto: !!c.incompleto,
        estado: 'pendiente',
        notaAdmin: null,
        createdAt: new Date().toISOString(),
      })
      creados++
    }
    await batch.commit()
    return NextResponse.json({ creados })
  } catch (err) {
    console.error('POST /api/admin/candidatos-profesional', err)
    return NextResponse.json({ error: 'No se pudo importar.' }, { status: 500 })
  }
}
