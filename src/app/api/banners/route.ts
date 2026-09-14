import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET — público, sin password: solo los banners activos, ordenados.
// Los usa la home cuando estás en "casita" (sin filtro de público).
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('banners').get()
    const banners = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((b: any) => b.activo !== false)
      .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999))
    return NextResponse.json({ banners })
  } catch (err) {
    console.error('GET /api/banners', err)
    return NextResponse.json({ error: 'No se pudieron cargar los banners.' }, { status: 500 })
  }
}

// POST — solo admin: crear un banner nuevo.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const { imagenUrl, link, orden } = await req.json()
    if (!imagenUrl) return NextResponse.json({ error: 'Falta la imagen del banner.' }, { status: 400 })

    const db = getDb()
    const ref = await db.collection('banners').add({
      imagenUrl,
      link: link || null,
      orden: typeof orden === 'number' ? orden : 999,
      activo: true,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('POST /api/banners', err)
    return NextResponse.json({ error: 'No se pudo crear el banner.' }, { status: 500 })
  }
}
