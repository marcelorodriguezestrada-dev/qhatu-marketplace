import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Código de tienda de las carpetas/archivos (ej: "cachitos") → vendedor
// de Clasi Click. Se asocia una vez y queda para las próximas
// importaciones. Firestore config/codigosTiendas { codigos: { cachitos: uid } }.
const ok = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}
const ref = () => getDb().collection('config').doc('codigosTiendas')

export async function GET(req: NextRequest) {
  if (!ok(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  try {
    return NextResponse.json({ codigos: (await ref().get()).data()?.codigos || {} })
  } catch {
    return NextResponse.json({ codigos: {} })
  }
}

// POST { codigo, vendedorId } (vendedorId vacío = olvidar la asociación)
export async function POST(req: NextRequest) {
  if (!ok(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const { codigo, vendedorId } = await req.json().catch(() => ({}))
  const c = String(codigo || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
  if (!c) return NextResponse.json({ error: 'Código inválido.' }, { status: 400 })
  const actual = (await ref().get()).data()?.codigos || {}
  if (vendedorId) actual[c] = String(vendedorId)
  else delete actual[c]
  await ref().set({ codigos: actual, updatedAt: new Date().toISOString() })
  return NextResponse.json({ ok: true, codigos: actual })
}
