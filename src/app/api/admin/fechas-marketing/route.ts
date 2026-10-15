import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// Admin → Marketing → "Fechas especiales": las fechas propias (aniversario
// de la ciudad, ferias...) que se suman a las de src/lib/fechasEspeciales.ts
// en la "Estrategia con IA" de las tiendas. Se repiten todos los años.
//   GET → lista · POST { nombre, mmdd, emoji?, idea?, ciudad? } · DELETE ?id=

const esAdmin = async (req: NextRequest) => await esClaveAdmin(req.headers.get('x-admin-password'))
const noAutorizado = () => NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

export async function GET(req: NextRequest) {
  if (!(await esAdmin(req))) return noAutorizado()
  const snap = await getDb().collection('fechasMarketing').get()
  const fechas = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(a.mmdd).localeCompare(String(b.mmdd)))
  return NextResponse.json({ fechas })
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin(req))) return noAutorizado()
  const b = await req.json().catch(() => ({}))
  const nombre = String(b.nombre || '').trim().slice(0, 60)
  const mmdd = String(b.mmdd || '')
  const [mes, dia] = mmdd.split('-').map(Number)
  if (!nombre || !/^\d{2}-\d{2}$/.test(mmdd) || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return NextResponse.json({ error: 'Poné el nombre y la fecha.' }, { status: 400 })
  }
  const ref = await getDb().collection('fechasMarketing').add({
    nombre,
    mmdd,
    emoji: String(b.emoji || '📅').slice(0, 8),
    idea: String(b.idea || '').trim().slice(0, 300),
    ciudad: typeof b.ciudad === 'string' ? b.ciudad.slice(0, 40) : '',
    createdAt: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true, id: ref.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await esAdmin(req))) return noAutorizado()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 })
  await getDb().collection('fechasMarketing').doc(id).delete()
  return NextResponse.json({ ok: true })
}
