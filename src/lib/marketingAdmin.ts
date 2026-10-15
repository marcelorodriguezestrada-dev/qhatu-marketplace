// Textos de marketing del admin (Admin → Marketing). Plantillas listas
// para copiar; la IA puede reescribirlas (mismos datos y mismo link).
// {ciudad} y {link} se completan con la ciudad elegida y el link de la
// campaña (?c=…) para poder medir qué funcionó.

import { gentilicio, v } from '@/lib/estiloRegional'

export type TipoTextoAdmin = {
  id: string
  grupo: 'Invitar (mensaje directo)' | 'Publicar (post)'
  label: string
  // Página a la que conviene mandar (si la campaña no dice otra cosa).
  destino: string
  plantilla: (d: { ciudad: string; link: string; gentilicio: string; ciudadId: string }) => string
}

// Cada texto habla como en la ciudad elegida: tuteo boliviano o voseo
// argentino (t(boliviano, argentino), ver src/lib/estiloRegional.ts).
const conEstilo = (ciudadId: string) => (bo: string, ar: string) => v(ciudadId, bo, ar)

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
    plantilla: ({ ciudad, link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `Hola! 😊 Me encantan tus productos.\n` +
        `Te escribo de Clasi Click, la tienda online de ${ciudad}. ${t('Puedes', 'Podés')} tener tu propia tienda con catálogo, cobro por QR y envíos, gratis, y te llegan clientes que ya están buscando lo que ${t('vendes', 'vendés')}. 🛍️\n` +
        `Si ${t('quieres', 'querés')}, te ayudamos a cargar tus productos: ${link}`
      )
    },
  },
  {
    id: 'profesional',
    grupo: 'Invitar (mensaje directo)',
    label: 'Profesional / oficio',
    destino: '/publicar-servicio',
    plantilla: ({ ciudad, link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `Hola! 👋 Vi que ${t('ofreces', 'ofrecés')} tus servicios.\n` +
        `Somos Clasi Click, el directorio de profesionales de ${ciudad}: la gente que busca un electricista, un abogado, un médico o un profe te encuentra y te escribe directo a tu WhatsApp. Es gratis. 🔧\n` +
        `Te ${t('puedes inscribir', 'podés anotar')} en 2 minutos ${t('aquí', 'acá')}: ${link}`
      )
    },
  },
  {
    id: 'tienda_fisica',
    grupo: 'Invitar (mensaje directo)',
    label: 'Tienda física / comercio',
    destino: '/vender',
    plantilla: ({ ciudad, link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `Buenas! 👋 Somos Clasi Click, el marketplace de ${ciudad}.\n` +
        `Tu negocio puede vender también por internet sin pagar nada: armamos tu tienda online con tus productos, ${t('cobras', 'cobrás')} con tu QR y el cliente pasa a retirar o se lo enviamos. 🏪\n` +
        `Te dejo el link para empezar (o te ayudamos nosotros): ${link}`
      )
    },
  },
  {
    id: 'seguimiento',
    grupo: 'Invitar (mensaje directo)',
    label: 'Seguimiento (no respondió)',
    destino: '/vender',
    plantilla: ({ link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `Hola de nuevo! 🙂 Te escribo por si no viste mi mensaje.\n` +
        `Publicar en Clasi Click es gratis y te lleva 2 minutos. Si ${t('prefieres, mándame', 'preferís, mandame')} fotos y precios por ${t('aquí', 'acá')} y yo te lo cargo. 📸\n` +
        `${link}`
      )
    },
  },
  {
    id: 'post_compradores',
    grupo: 'Publicar (post)',
    label: 'Para compradores',
    destino: '/',
    plantilla: ({ ciudad, link, gentilicio, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `🛍️ ¡${ciudad}, ya ${t('puedes', 'podés')} comprar online a los negocios de tu ciudad!\n\n` +
        `En Clasi Click ${t('encuentras', 'encontrás')} productos y servicios locales en un solo lugar:\n` +
        `✅ ${t('Pagas', 'Pagás')} fácil con QR\n✅ Envío a domicilio o retiro en tienda\n✅ Profesionales y oficios de confianza\n\n` +
        `Apoyemos el comercio ${gentilicio} 💪\n👉 ${link}`
      )
    },
  },
  {
    id: 'post_vendedores',
    grupo: 'Publicar (post)',
    label: 'Convocatoria a vendedores',
    destino: '/vender',
    plantilla: ({ ciudad, link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `📢 ¿${t('Vendes', 'Vendés')} en ${ciudad}? ¡${t('Publica', 'Publicá')} GRATIS en Clasi Click!\n\n` +
        `✅ Tu tienda online con catálogo y fotos\n✅ ${t('Cobras', 'Cobrás')} directo con tu QR\n✅ Te conectamos automáticamente con quien busca lo que ${t('vendes', 'vendés')}\n✅ ${t('Coordinas', 'Coordinás')} la entrega por WhatsApp\n\n` +
        `Sin comisiones para empezar. ${t('Regístrate aquí', 'Registrate acá')} 👉 ${link}`
      )
    },
  },
  {
    id: 'post_profesionales',
    grupo: 'Publicar (post)',
    label: 'Convocatoria a profesionales',
    destino: '/publicar-servicio',
    plantilla: ({ ciudad, link, ciudadId }) => {
      const t = conEstilo(ciudadId)
      return (
        `🔧 Profesionales y oficios de ${ciudad}: ¡que te encuentren!\n\n` +
        `Electricistas, plomeros, abogados, médicos, profes, técnicos… ${t('súmate gratis al directorio de Clasi Click y recibe', 'sumate gratis al directorio de Clasi Click y recibí')} clientes directo en tu WhatsApp. 📲\n\n` +
        `👉 ${link}`
      )
    },
  },
]

export function gentilicioDe(ciudadId: string) {
  return gentilicio(ciudadId)
}
