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
  textoCrudo: string
}

/**
 * Busca montos en el texto del comprobante. Contempla los formatos que
 * usan los bancos/billeteras bolivianas: "Bs 1.234,56", "1234.56",
 * "Bs. 250", etc.
 */
function extraerMontos(texto: string): number[] {
  const montos: number[] = []
  // Captura números con separadores de miles y decimales opcionales
  const regex = /(?:bs\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi
  let match
  while ((match = regex.exec(texto)) !== null) {
    const crudo = match[1]
    // Decidir cuál separador es decimal: el último que aparezca, si deja
    // 1-2 dígitos detrás. Si no, es separador de miles.
    let normalizado = crudo
    const ultimaComa = crudo.lastIndexOf(',')
    const ultimoPunto = crudo.lastIndexOf('.')
    const posDecimal = Math.max(ultimaComa, ultimoPunto)
    if (posDecimal > -1 && crudo.length - posDecimal - 1 <= 2) {
      normalizado = crudo.slice(0, posDecimal).replace(/[.,]/g, '') + '.' + crudo.slice(posDecimal + 1)
    } else {
      normalizado = crudo.replace(/[.,]/g, '')
    }
    const valor = parseFloat(normalizado)
    if (!isNaN(valor) && valor > 0) montos.push(valor)
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

  const montos = extraerMontos(texto)
  const fechaDetectada = extraerFecha(texto)

  // Buscamos si ALGUNO de los montos leídos coincide con el esperado
  // (con 1 Bs de tolerancia, por errores típicos de lectura). Un
  // comprobante trae varios números: saldo, comisión, código de
  // operación — no alcanza con tomar el primero que aparece.
  const coincidente = montos.find((m) => Math.abs(m - montoEsperado) < 1)
  // Si no coincide ninguno, mostramos el monto más grande como
  // referencia — suele ser el del pago.
  const montoDetectado = coincidente ?? (montos.length ? Math.max(...montos) : null)

  return {
    montoDetectado,
    fechaDetectada,
    coincide: montoDetectado === null ? null : coincidente !== undefined,
    textoCrudo: texto,
  }
}
