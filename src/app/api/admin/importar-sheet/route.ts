import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Lee una planilla de Google compartida como "Cualquiera con el link:
// lector" bajándola como CSV (no hace falta API key ni login). Lee la
// pestaña del link (la que estaba abierta al copiarlo).
// POST { url } → { filas: string[][], titulo? }

function parsearCSV(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++ }
      else if (c === '"') comillas = false
      else celda += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(celda); celda = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(celda); filas.push(fila); fila = []; celda = ''
    } else celda += c
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila) }
  return filas.filter((f) => f.some((x) => x.trim()))
}

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password')
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  const { url } = await req.json().catch(() => ({}))
  const m = String(url || '').match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
  if (!m) return NextResponse.json({ error: 'Pegá el link de una planilla de Google (docs.google.com/spreadsheets/…).' }, { status: 400 })
  const gid = String(url).match(/[#&?]gid=(\d+)/)?.[1]
  const exportUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`
  try {
    const res = await fetch(exportUrl, { redirect: 'follow' })
    const tipo = res.headers.get('content-type') || ''
    if (!res.ok || tipo.includes('text/html')) {
      return NextResponse.json({ error: 'No pudimos abrir la planilla. En Google Sheets tocá Compartir → Acceso general → “Cualquier persona con el enlace” (Lector) y volvé a probar.' }, { status: 400 })
    }
    const filas = parsearCSV(await res.text()).slice(0, 2001)
    if (filas.length < 2) return NextResponse.json({ error: 'La planilla está vacía (necesita la fila de títulos y al menos un producto).' }, { status: 400 })
    return NextResponse.json({ filas })
  } catch (err) {
    console.error('POST /api/admin/importar-sheet', err)
    return NextResponse.json({ error: 'No se pudo leer la planilla. Probá de nuevo.' }, { status: 502 })
  }
}
