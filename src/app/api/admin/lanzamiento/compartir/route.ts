import { NextRequest, NextResponse } from 'next/server'
import { crearCompartido, leerCompartido, revocarCompartido } from '@/lib/calendarioCompartido'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const esAdmin = async (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return (await esClaveAdmin(p))
}

// GET → { compartido } · POST { accion: 'crear', permiso } | { accion: 'revocar' }
export async function GET(req: NextRequest) {
  if (!(await esAdmin(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  return NextResponse.json({ compartido: await leerCompartido() })
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin(req))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    if (body.accion === 'revocar') {
      await revocarCompartido()
      return NextResponse.json({ compartido: null })
    }
    return NextResponse.json({ compartido: await crearCompartido(body.permiso === 'marcar' ? 'marcar' : 'ver') })
  } catch (err) {
    console.error('POST /api/admin/lanzamiento/compartir', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
