'use client'

// "📲 Capturas de catálogo" cuando ninguna IA del servidor puede mirar
// fotos (sin GEMINI_API_KEY y sin modelos de visión en Groq):
// 1. El navegador lee el texto de la captura con Tesseract (gratis, sin
//    clave; baja el idioma español la primera vez, ~2 MB).
// 2. El servidor ordena ese texto en productos con la IA de texto.
// 3. La foto se ubica acá: en la vista de un producto es la franja más
//    grande sin texto; en una lista, el cuadrado a la izquierda del nombre.

export type Caja = { x: number; y: number; ancho: number; alto: number }
export type Renglon = { texto: string; x: number; y: number; x1: number; y1: number } // fracciones de la captura

let worker: Promise<any> | null = null

async function obtenerWorker() {
  if (!worker) {
    worker = import('tesseract.js').then(({ createWorker }) => createWorker('spa'))
    worker.catch(() => { worker = null })
  }
  return worker
}

export async function leerTextoCaptura(url: string, ancho: number, alto: number): Promise<Renglon[]> {
  const w = await obtenerWorker()
  const { data } = await w.recognize(url, {}, { blocks: true })
  const lineas = (data.blocks || []).flatMap((b: any) => (b.paragraphs || []).flatMap((p: any) => p.lines || []))
  return lineas
    .filter((l: any) => l.confidence >= 45 && String(l.text || '').replace(/[^\p{L}\p{N}$]/gu, '').length >= 2)
    .map((l: any) => ({
      texto: String(l.text).replace(/\s+/g, ' ').trim(),
      x: l.bbox.x0 / ancho,
      y: l.bbox.y0 / alto,
      x1: l.bbox.x1 / ancho,
      y1: l.bbox.y1 / alto,
    }))
    .sort((a: Renglon, b: Renglon) => a.y - b.y || a.x - b.x)
}

// Vista de un producto: la foto es la franja (a todo el ancho) más alta sin
// texto ARRIBA del nombre (`hastaY`: abajo suele haber espacio vacío).
// Si es más alta que ancha, se toma un cuadrado desde arriba.
export function cajaDetalle(renglones: Renglon[], ancho: number, alto: number, hastaY = 1): { caja: Caja; segura: boolean } {
  // Recorre los renglones de arriba abajo y mide el hueco entre el final de uno y el comienzo del siguiente.
  const tramos = [...renglones.filter((r) => r.y < hastaY).map((r) => [r.y, r.y1] as const), [hastaY, hastaY] as const].sort((a, b) => a[0] - b[0])
  let mejor = { desde: 0.08, hasta: 0.08 + Math.min(0.6, ancho / alto) }
  let mayor = 0
  let ocupado = 0
  for (const [y0, y1] of tramos) {
    if (y0 - ocupado > mayor) {
      mayor = y0 - ocupado
      mejor = { desde: ocupado, hasta: y0 }
    }
    ocupado = Math.max(ocupado, y1)
  }
  const margen = 0.004
  const desde = Math.min(mejor.desde + margen, 1)
  const cuadrado = ancho / alto // alto de un cuadrado de todo el ancho, en fracción del alto
  const altoCaja = Math.max(0.02, Math.min(mejor.hasta - margen - desde, cuadrado * 1.25))
  return { caja: { x: 0, y: desde, ancho: 1, alto: altoCaja }, segura: mayor >= 0.2 }
}

// Lista: la miniatura está a la izquierda del texto del producto. Toma los
// renglones del producto (desde su nombre hasta el siguiente producto) y
// arma un cuadrado entre el borde y el texto, centrado en esos renglones.
export function cajaLista(renglones: Renglon[], desde: number, hasta: number, ancho: number, alto: number): Caja {
  const propios = renglones.slice(desde, Math.max(desde + 1, hasta))
  const textoX = Math.min(...propios.map((r) => r.x))
  const y0 = Math.min(...propios.map((r) => r.y))
  const y1 = Math.max(...propios.map((r) => r.y1))
  // Sin lugar a la izquierda (texto pegado al borde): la miniatura está arriba.
  if (textoX < 0.15) {
    const lado = Math.min(0.5, (y0 * alto) / ancho)
    return { x: 0.02, y: Math.max(0, y0 - (lado * ancho) / alto - 0.005), ancho: lado, alto: (lado * ancho) / alto }
  }
  const lado = Math.max(0.08, textoX - 0.06) // en fracción del ancho
  const ladoAlto = (lado * ancho) / alto // el mismo lado en fracción del alto
  const centro = (y0 + y1) / 2
  const y = Math.min(Math.max(centro - ladoAlto / 2, 0), 1 - ladoAlto)
  return { x: 0.03, y, ancho: lado, alto: ladoAlto }
}

// Afina arriba y abajo de una franja: el hueco sin texto suele incluir un
// pedazo del encabezado (color liso) o del fondo. Busca, cerca de cada
// borde, el salto de color más fuerte entre dos filas (encabezado → foto,
// foto → fondo blanco) y corta ahí.
export async function afinarBordes(url: string, caja: Caja): Promise<Caja> {
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const W = 160
    const H = Math.round((img.naturalHeight * W) / img.naturalWidth)
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, W, H)
    const datos = ctx.getImageData(0, 0, W, H).data
    const fila = (y: number) => {
      let r = 0, g = 0, b = 0
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; r += datos[i]; g += datos[i + 1]; b += datos[i + 2] }
      return [r / W, g / W, b / W]
    }
    const salto = (y: number) => { const a = fila(y), b = fila(y + 1); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) }
    const y0 = Math.round(caja.y * H)
    const y1 = Math.min(H - 2, Math.round((caja.y + caja.alto) * H))
    const zona = Math.max(2, Math.round((y1 - y0) * 0.25))
    const mayorSalto = (desde: number, hasta: number) => {
      let mejor = -1, valor = 40 // menos de esto es ruido de la foto, no un borde
      for (let y = Math.max(0, desde); y < Math.min(hasta, H - 1); y++) { const s = salto(y); if (s > valor) { valor = s; mejor = y } }
      return mejor
    }
    const arriba = mayorSalto(y0, y0 + zona)
    const abajo = mayorSalto(y1 - zona, y1)
    const nuevoY0 = arriba >= 0 ? arriba + 1 : y0
    const nuevoY1 = abajo >= 0 ? abajo + 1 : y1
    if (nuevoY1 - nuevoY0 < (y1 - y0) * 0.5) return caja
    return { ...caja, y: nuevoY0 / H, alto: (nuevoY1 - nuevoY0) / H }
  } catch {
    return caja
  }
}
