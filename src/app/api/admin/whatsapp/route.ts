import { NextRequest, NextResponse } from 'next/server'
import { esClaveAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET (admin): qué variables del bot de WhatsApp están cargadas en el
// servidor (solo sí/no, nunca los valores) para Admin → Marketing.
export async function GET(req: NextRequest) {
  if (!(await esClaveAdmin(req.headers.get('x-admin-password')))) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const vars = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ADMINS', 'GROQ_API_KEY', 'IMGBB_API_KEY', 'GEMINI_API_KEY']
  return NextResponse.json({ variables: Object.fromEntries(vars.map((v) => [v, !!process.env[v]])) })
}
