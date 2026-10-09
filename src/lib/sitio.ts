// Dominio público del sitio (sin barra al final), para armar links
// absolutos: mensajes de WhatsApp, vista previa al compartir, etc. Se
// puede cambiar con NEXT_PUBLIC_SITE_URL en Vercel.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.clasiclick.com').replace(/\/$/, '')
