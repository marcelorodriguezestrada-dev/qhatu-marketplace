// Extrae el texto plano de un CV subido como PDF, Word (.docx) o como
// imagen (foto o escaneo), para después mandárselo a la IA y que arme
// la presentación del profesional (ver /api/profesionales/extraer-cv).
//
// Igual que con ocrComprobante.ts, las librerías pesadas (pdfjs-dist,
// mammoth, tesseract.js) se importan de forma dinámica adentro de cada
// función: así solo las descarga quien realmente sube un CV, no todo
// el que abre /mi-perfil o /admin.

export type ResultadoLecturaCV = {
  texto: string
  paginas?: number
}

// PDF: leemos el texto ya embebido con pdf.js — no hace falta OCR
// porque casi todos los CVs en PDF tienen texto real, no son solo una
// imagen escaneada.
async function extraerTextoPDF(file: File): Promise<ResultadoLecturaCV> {
  const pdfjsLib: any = await import('pdfjs-dist')
  // pdf.js corre la extracción en un Web Worker aparte. En vez de meter
  // el worker en el bundle (necesitaría tocar la config de webpack de
  // Next), lo servimos desde un CDN público, en la misma versión exacta
  // del paquete instalado — así no hay descalce de versiones.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let textoCompleto = ''
  const maxPaginas = Math.min(pdf.numPages, 10) // un CV no debería pasar de 10 páginas
  for (let i = 1; i <= maxPaginas; i++) {
    const page = await pdf.getPage(i)
    const contenido = await page.getTextContent()
    const textoPagina = contenido.items.map((item: any) => item.str || '').join(' ')
    textoCompleto += textoPagina + '\n\n'
  }

  return { texto: textoCompleto.trim(), paginas: pdf.numPages }
}

// Word moderno (.docx): mammoth lee el XML del documento y devuelve el
// texto plano. Corre entero en el navegador, sin subir el archivo a
// ningún lado.
async function extraerTextoDocx(file: File): Promise<ResultadoLecturaCV> {
  const mammoth: any = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer })
  return { texto: (value || '').trim() }
}

// Imagen (foto del CV impreso, captura de pantalla, escaneo): OCR con
// Tesseract, igual que el comprobante de pago.
async function extraerTextoImagen(file: File): Promise<ResultadoLecturaCV> {
  const { default: Tesseract } = await import('tesseract.js')
  const { data } = await Tesseract.recognize(file, 'spa')
  return { texto: (data.text || '').trim() }
}

export async function extraerTextoDeArchivo(file: File): Promise<ResultadoLecturaCV> {
  const nombre = file.name.toLowerCase()
  const esPDF = file.type === 'application/pdf' || nombre.endsWith('.pdf')
  if (esPDF) return extraerTextoPDF(file)

  const esDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    nombre.endsWith('.docx')
  if (esDocx) return extraerTextoDocx(file)

  // .doc viejo (formato binario de Word 97-2003): no hay forma
  // confiable de leerlo en el navegador sin una librería pesada de
  // servidor — le pedimos a la persona que suba PDF, .docx o una foto
  // en vez de este formato.
  const esDocLegado = file.type === 'application/msword' || nombre.endsWith('.doc')
  if (esDocLegado) {
    throw new Error('El formato .doc (Word 97-2003) no se puede leer. Subí el CV como PDF, Word .docx o una foto/escaneo.')
  }

  return extraerTextoImagen(file)
}
