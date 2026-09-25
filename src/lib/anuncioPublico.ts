import { getDb } from '@/lib/firebaseAdmin'

// URL pública del sitio, para armar links absolutos (vista previa al
// compartir por WhatsApp, botón Compartir).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasiclick.ezeti.pro').replace(/\/$/, '')

// Anuncio aprobado leído del lado del servidor (para la vista previa
// al compartir). null si no existe o todavía no está aprobado — mismo
// criterio que GET /api/anuncios/[id], pero sin sumar vistas.
export async function leerAnuncioPublico(id: string): Promise<Record<string, any> | null> {
  try {
    const doc = await getDb().collection('anuncios').doc(id).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.estado !== 'aprobado') return null
    return { id: doc.id, ...data }
  } catch (err) {
    console.error('leerAnuncioPublico', err)
    return null
  }
}
