// Lee el comprobante con OCR (Tesseract.js) para chequear que el monto
// coincida con lo que el comprador tiene que pagar.
//
// IMPORTANTE — esto NO aprueba pagos. Es solo una ayuda visual: si el
// monto no coincide o no se llega a leer, el pedido igual avanza y el
// vendedor confirma a mano como siempre. Un OCR sobre una foto sacada
// con el celular falla seguido (reflejos, foco, recortes), así que
// nunca puede ser la única barrera antes de dar un pago por válido.
//
// Tesseract se importa dinámicamente (no arriba del archivo) porque
// pesa varios MB: así solo lo descarga quien realmente sube un
// comprobante, y no todos los que abren el checkout.

export type ResultadoOCR = {
  montoDetectado: number | null
  fechaDetectada: string | null
  coincide: boolean | null // null = no se pudo leer el monto
  // false = la imagen no tiene el texto típico de un comprobante (una
  // foto cualquiera, una captura de otra cosa). En ese caso coincide y
  // montoDetectado quedan en null: no damos por "leído" ningún número.
  pareceComprobante: boolean
  // El comprobante muestra montos en otra moneda ($, USD, ARS, €) — por
  // ejemplo una transferencia argentina de "$ 20.000".
  otraMoneda: boolean
  textoCrudo: string
}

export const MAX_INTENTOS_COMPROBANTE = 3

// Regla del checkout: el comprobante SOLO se acepta si parece un
// comprobante y el monto leído coincide con el total. Cualquier otra
// cosa (foto cualquiera, monto distinto, otra moneda, monto ilegible)
// cuenta como un intento fallido — a los 3, la compra se anula.
export function comprobanteValido(r: ResultadoOCR | null): boolean {
  return !!r && r.pareceComprobante && r.coincide === true
}

export function motivoRechazo(r: ResultadoOCR, montoEsperado: number): string {
  if (!r.pareceComprobante) return 'La imagen no parece un comprobante de pago.'
  if (r.otraMoneda && r.coincide !== true) return 'El comprobante está en otra moneda (no en Bs).'
  if (r.coincide === false && r.montoDetectado != null) return `El monto del comprobante (${r.montoDetectado}) no coincide con el total (Bs ${montoEsperado}).`
  return 'No se pudo leer el monto del comprobante.'
}

// Palabras que aparecen en los comprobantes de bancos y billeteras
// bolivianas (sin tildes, en minúscula). Una foto cualquiera casi nunca
// junta 3 de estas; un comprobante real trae varias.
const PALABRAS_COMPROBANTE = [
  'transferencia', 'transaccion', 'comprobante', 'pago', 'pagado', 'monto', 'importe', 'total',
  'bs', 'bob', 'boliviano', 'bolivianos', 'banco', 'cuenta', 'destinatario', 'beneficiario',
  'origen', 'destino', 'qr', 'operacion', 'numero', 'nro', 'fecha', 'hora', 'exitosa', 'exitoso',
  'enviado', 'enviaste', 'titular', 'glosa', 'referencia', 'codigo', 'cliente',
  'bnb', 'bcp', 'mercantil', 'santa cruz', 'union', 'economico', 'fie', 'ganadero', 'sol', 'tigo money',
  'simple', 'recibo', 'detalle', 'debito', 'abono', 'cargo',
]

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function contarPalabrasComprobante(texto: string): number {
  const t = ' ' + normalizar(texto).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' '
  return new Set(PALABRAS_COMPROBANTE.filter((p) => t.includes(` ${p} `))).size
}

function aNumero(crudo: string): number {
  // Decidir cuál separador es decimal: el último que aparezca, si deja
  // 1-2 dígitos detrás. Si no, es separador de miles.
  const posDecimal = Math.max(crudo.lastIndexOf(','), crudo.lastIndexOf('.'))
  const normalizado =
    posDecimal > -1 && crudo.length - posDecimal - 1 <= 2
      ? crudo.slice(0, posDecimal).replace(/[.,]/g, '') + '.' + crudo.slice(posDecimal + 1)
      : crudo.replace(/[.,]/g, '')
  return parseFloat(normalizado)
}

/**
 * Busca montos en el texto del comprobante ("Bs 1.234,56", "250.00 BOB",
 * "Monto: 250"). Solo cuenta números que tienen pinta de monto:
 *  - pegados a "Bs"/"BOB" (antes o después), o
 *  - en una línea que dice monto/importe/total/pago, o
 *  - con 2 decimales (250,00).
 * Un número suelto ("6", un código, basura que el OCR ve en una foto)
 * NO cuenta — antes cualquier cifra servía y una foto de un gato daba
 * "coincide" si por casualidad aparecía el número del total.
 */
function extraerMontos(texto: string): { valor: number; extranjera: boolean }[] {
  const montos: { valor: number; extranjera: boolean }[] = []
  for (const linea of texto.split(/\n+/)) {
    const lineaNorm = normalizar(linea)
    const lineaDeMonto = /\b(monto|importe|total|pago|pagado|pagaste|enviaste)\b/.test(lineaNorm)
    // Moneda antes o después del número. "$", "US$", "USD", "ARS", "€"
    // también cuentan como monto, pero marcados como otra moneda: así un
    // "$ 20.000" se detecta (y se rechaza) en vez de pasar como ilegible.
    const regex = /(bs\.?|bob|us\$|usd|ars|\$|€)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(bs\.?|bob|usd|ars|€)?/gi
    let match
    while ((match = regex.exec(linea)) !== null) {
      const crudo = match[2]
      const moneda = normalizar(match[1] || match[3] || '')
      const conDecimales = /[.,]\d{2}$/.test(crudo)
      if (!moneda && !lineaDeMonto && !conDecimales) continue
      const valor = aNumero(crudo)
      if (!isNaN(valor) && valor > 0) montos.push({ valor, extranjera: !!moneda && !moneda.startsWith('bs') && moneda !== 'bob' })
    }
  }
  return montos
}

function extraerFecha(texto: string): string | null {
  // dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy
  const match = texto.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/)
  if (!match) return null
  return match[0]
}

export async function leerComprobante(file: File, montoEsperado: number): Promise<ResultadoOCR> {
  const { default: Tesseract } = await import('tesseract.js')
  const { data } = await Tesseract.recognize(file, 'spa')
  const texto = data.text || ''
  const fechaDetectada = extraerFecha(texto)

  // Primero: ¿esto es un comprobante? Pedimos al menos 3 palabras
  // típicas de comprobante y una confianza mínima del OCR (en una foto
  // sin texto, Tesseract "lee" basura con confianza muy baja).
  const pareceComprobante = contarPalabrasComprobante(texto) >= 3 && (data.confidence ?? 0) >= 35
  if (!pareceComprobante) {
    return { montoDetectado: null, fechaDetectada, coincide: null, pareceComprobante: false, otraMoneda: false, textoCrudo: texto }
  }

  const todos = extraerMontos(texto)
  const otraMoneda = todos.some((m) => m.extranjera)
  // Solo los montos en Bs (o sin moneda) pueden coincidir con el total.
  const montos = todos.filter((m) => !m.extranjera).map((m) => m.valor)
  // Buscamos si ALGUNO de los montos coincide con el esperado. Un
  // comprobante trae varios (saldo, comisión, monto): no alcanza con el
  // primero. Tolerancia de centavos nada más — antes era ±1 Bs, que en
  // un pedido de Bs 6 aceptaba cualquier cosa entre 5 y 7.
  const coincidente = montos.find((m) => Math.abs(m - montoEsperado) < 0.05)
  // Si no coincide ninguno, mostramos el monto más grande como
  // referencia — suele ser el del pago.
  const referencia = montos.length ? montos : todos.map((m) => m.valor)
  const montoDetectado = coincidente ?? (referencia.length ? Math.max(...referencia) : null)

  return {
    montoDetectado,
    fechaDetectada,
    coincide: montoDetectado === null ? null : coincidente !== undefined,
    pareceComprobante: true,
    otraMoneda,
    textoCrudo: texto,
  }
}
