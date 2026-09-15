// Parsea bloques de texto pegados de canales de WhatsApp de tipo
// "bolsa de trabajo" / clasificados, con este formato repetido:
//
//   TÍTULO
//
//   TÍTULO            (se repite igual, es así como lo exporta WhatsApp)
//
//    71234567 | 12 sept 2026, 19:14:23
//
//   Descripción del aviso, puede terminar cortada con "..." si el
//   mensaje original era muy largo.
//
// Se usa en /admin, pestaña "Anuncios", para subir muchos anuncios de
// clientes de una sola vez en vez de tipearlos uno por uno.

export type AnuncioParseado = {
  titulo: string
  telefono: string
  fecha: string
  descripcion: string
  // Si la descripción quedó cortada en el "...", probablemente falten
  // datos — es la señal para no publicarlo directo y en cambio
  // preguntarle al número de contacto si puede mandar el texto completo.
  incompleto: boolean
}

export function parsearAnunciosWhatsapp(textoOriginal: string): AnuncioParseado[] {
  // Normalizamos saltos de línea (Windows manda \r\n) y nos aseguramos
  // de que el texto termine en \n, para que el último bloque también
  // calce con el patrón "header + línea en blanco".
  const normalizado = textoOriginal.replace(/\r\n/g, '\n').trim() + '\n'

  // Un "header" es el bloque atómico título+título+teléfono|fecha que
  // marca el arranque de cada aviso. Usar el título DUPLICADO como
  // ancla (en vez de buscarlo por separado) evita confundirse cuando
  // el mismo título aparece más de una vez en avisos distintos del
  // mismo texto (pasa seguido: "SE REQUIERE PERSONAL" se repite).
  const headerRegex = /(^|\n)([^\n]+)\n\n\2\n\n[ \t]*(\d{6,12})[ \t]*\|[ \t]*([^\n]+)\n\n/g
  const headers = [...normalizado.matchAll(headerRegex)]

  const resultados: AnuncioParseado[] = []
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    const titulo = h[2].trim()
    const telefono = h[3].replace(/\s+/g, '')
    const fecha = h[4].trim()
    const finHeader = h.index! + h[0].length
    const finDescripcion = i + 1 < headers.length ? headers[i + 1].index! + headers[i + 1][1].length : normalizado.length
    const descripcion = normalizado.slice(finHeader, finDescripcion).trim()

    resultados.push({
      titulo,
      telefono,
      fecha,
      descripcion,
      incompleto: descripcion.endsWith('...') || descripcion.length < 20,
    })
  }

  return resultados
}

// Mensaje de invitación que se manda por WhatsApp a cada contacto de
// un anuncio importado (por ejemplo, copiado de "Cambalache" u otro
// canal externo) — invitándolo a subir su anuncio gratis a Clasi
// Click. Es el mismo texto para todos a propósito: no se personaliza
// por anuncio porque ya funciona como mensaje genérico de invitación.
export function mensajeInvitacionAnuncio(): string {
  return `¡Hola! 👋 Vi tu anuncio en Cambalache y me pareció excelente tu propuesta. 👏
Te escribo porque desde Clasi Click —un emprendimiento 100% potosino creado para impulsar a nuestra gente y a los negocios locales— queremos ayudarte a multiplicar tus ventas. 🚀
Podemos subir este mismo anuncio que pusiste en Cambalache a nuestra plataforma totalmente gratis, o si prefieres promocionar otro producto/servicio, ¡también es 100% gratuito!
Además, nuestra página cuenta con un sistema inteligente que realiza un matcheo o conexión automática: en cuanto alguien busca o solicita en Potosí lo que tú vendes, el sistema los conecta en tiempo real para que tu anuncio se escuche y atienda al instante.
Puedes ver la sección de anuncios e ingresar aquí: https://clasiclick.ezeti.pro/anuncios
¿Te parece bien que publiquemos este anuncio o prefieres enviarme fotos e información nueva para subirlo hoy mismo? 🙌`
}
