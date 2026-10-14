import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/sitio'

// Qué puede leer Google: todo lo público; nada del admin, del checkout ni
// de las cuentas de los usuarios.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/checkout', '/login', '/mi-perfil', '/mis-pedidos', '/mis-anuncios', '/mis-estadisticas', '/vender', '/reparto-hoy', '/calendario/', '/publicar-anuncio', '/publicar-servicio'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
