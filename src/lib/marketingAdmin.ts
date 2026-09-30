// Textos de marketing del admin (Admin → Marketing). Plantillas listas
// para copiar; la IA puede reescribirlas (mismos datos y mismo link).
// {ciudad} y {link} se completan con la ciudad elegida y el link de la
// campaña (?c=…) para poder medir qué funcionó.

export type TipoTextoAdmin = {
  id: string
  grupo: 'Invitar (mensaje directo)' | 'Publicar (post)'
  label: string
  // Página a la que conviene mandar (si la campaña no dice otra cosa).
  destino: string
  plantilla: (d: { ciudad: string; link: string; gentilicio: string }) => string
}

export const TEXTOS_ADMIN: TipoTextoAdmin[] = [
  {
    id: 'vendedor_marketplace',
    grupo: 'Invitar (mensaje directo)',
    label: 'Vendedor de Marketplace',
    destino: '/vender',
    plantilla: ({ ciudad, link, gentilicio }) =>
      `Hola! 👋 Vi tu publicación en Marketplace.\n` +
      `Somos Clasi Click, un e-commerce 100% ${gentilicio} dedicado a conectar vendedores de productos con compradores de la ciudad, sin costo alguno. 💡\n` +
      `Podemos publicar tu producto gratis en nuestra web: ${link}\n` +
      `Lo genial es que el sistema realiza un matcheo automático en tiempo real con las personas que están buscando comprar tu producto en ${ciudad}.`,
  },
  {
    id: 'vendedor_instagram',
    grupo: 'Invitar (mensaje directo)',
    label: 'Tienda de Instagram / TikTok',
    destino: '/vender',
    plantilla: ({ ciudad, link }) =>
      `Hola! 😊 Me encantan tus productos.\n` +
      `Te escribo de Clasi Click, la tienda online de ${ciudad}. Podés tener tu propia tienda con catálogo, cobro por QR y envíos, gratis, y te llegan clientes que ya están buscando lo que vendés. 🛍️\n` +
      `Si querés, te ayudamos a cargar tus productos: ${link}`,
  },
  {
    id: 'profesional',
    grupo: 'Invitar (mensaje directo)',
    label: 'Profesional / oficio',
    destino: '/publicar-servicio',
    plantilla: ({ ciudad, link }) =>
      `Hola! 👋 Vi que ofrecés tus servicios.\n` +
      `Somos Clasi Click, el directorio de profesionales de ${ciudad}: la gente que busca un electricista, un abogado, un médico o un profe te encuentra y te escribe directo a tu WhatsApp. Es gratis. 🔧\n` +
      `Te podés anotar en 2 minutos acá: ${link}`,
  },
  {
    id: 'tienda_fisica',
    grupo: 'Invitar (mensaje directo)',
    label: 'Tienda física / comercio',
    destino: '/vender',
    plantilla: ({ ciudad, link }) =>
      `Buenas! 👋 Somos Clasi Click, el marketplace de ${ciudad}.\n` +
      `Tu negocio puede vender también por internet sin pagar nada: armamos tu tienda online con tus productos, cobrás con tu QR y el cliente pasa a retirar o se lo enviamos. 🏪\n` +
      `Te dejo el link para empezar (o te ayudamos nosotros): ${link}`,
  },
  {
    id: 'seguimiento',
    grupo: 'Invitar (mensaje directo)',
    label: 'Seguimiento (no respondió)',
    destino: '/vender',
    plantilla: ({ link }) =>
      `Hola de nuevo! 🙂 Te escribo por si no viste mi mensaje.\n` +
      `Publicar en Clasi Click es gratis y te lleva 2 minutos. Si preferís, mandame fotos y precios por acá y yo te lo cargo. 📸\n` +
      `${link}`,
  },
  {
    id: 'post_compradores',
    grupo: 'Publicar (post)',
    label: 'Para compradores',
    destino: '/',
    plantilla: ({ ciudad, link, gentilicio }) =>
      `🛍️ ¡${ciudad}, ya podés comprar online a los negocios de tu ciudad!\n\n` +
      `En Clasi Click encontrás productos y servicios locales en un solo lugar:\n` +
      `✅ Pagás fácil con QR\n✅ Envío a domicilio o retiro en tienda\n✅ Profesionales y oficios de confianza\n\n` +
      `Apoyemos el comercio ${gentilicio} 💪\n👉 ${link}`,
  },
  {
    id: 'post_vendedores',
    grupo: 'Publicar (post)',
    label: 'Convocatoria a vendedores',
    destino: '/vender',
    plantilla: ({ ciudad, link }) =>
      `📢 ¿Vendés en ${ciudad}? ¡Publicá GRATIS en Clasi Click!\n\n` +
      `✅ Tu tienda online con catálogo y fotos\n✅ Cobrás directo con tu QR\n✅ Te conectamos automáticamente con quien busca lo que vendés\n✅ Coordinás la entrega por WhatsApp\n\n` +
      `Sin comisiones para empezar. Registrate acá 👉 ${link}`,
  },
  {
    id: 'post_profesionales',
    grupo: 'Publicar (post)',
    label: 'Convocatoria a profesionales',
    destino: '/publicar-servicio',
    plantilla: ({ ciudad, link }) =>
      `🔧 Profesionales y oficios de ${ciudad}: ¡que te encuentren!\n\n` +
      `Electricistas, plomeros, abogados, médicos, profes, técnicos… sumate gratis al directorio de Clasi Click y recibí clientes directo en tu WhatsApp. 📲\n\n` +
      `👉 ${link}`,
  },
]

export function gentilicioDe(ciudadId: string) {
  return ciudadId === 'la-paz' ? 'paceño' : 'potosino'
}
