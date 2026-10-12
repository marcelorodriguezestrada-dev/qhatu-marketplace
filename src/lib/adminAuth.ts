import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { getDb } from '@/lib/firebaseAdmin'

// Quién puede usar el panel /admin (header x-admin-password):
// - La contraseña principal (ADMIN_PASSWORD en Vercel): el dueño.
// - Una clave de admin personal (cc_adm_…) que el dueño le da a un
//   usuario desde Admin → Usuarios → "🛡️ Hacer admin". Se guarda solo
//   su hash en administradores/{hash}, y se puede anular cuando quiera.
// Solo la contraseña principal puede crear o quitar admins.

const PREFIJO = 'cc_adm_'
const CACHE_MS = 30_000
const cache = new Map<string, { ok: boolean; hasta: number }>()

export function hashClave(clave: string) {
  return createHash('sha256').update(clave).digest('hex')
}

export function esClaveMaestra(pw: string | null | undefined): boolean {
  const maestra = process.env.ADMIN_PASSWORD
  if (!pw || !maestra) return false
  const a = Buffer.from(pw)
  const b = Buffer.from(maestra)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function esClaveAdmin(pw: string | null | undefined): Promise<boolean> {
  if (!pw) return false
  if (esClaveMaestra(pw)) return true
  if (!pw.startsWith(PREFIJO) || pw.length < 30) return false
  const hash = hashClave(pw)
  const enCache = cache.get(hash)
  if (enCache && enCache.hasta > Date.now()) return enCache.ok
  try {
    const ref = getDb().collection('administradores').doc(hash)
    const doc = await ref.get()
    const ok = doc.exists && doc.get('activo') !== false
    cache.set(hash, { ok, hasta: Date.now() + CACHE_MS })
    if (ok) ref.update({ ultimoAcceso: new Date().toISOString() }).catch(() => {})
    return ok
  } catch {
    return false
  }
}

export function nuevaClaveAdmin() {
  return PREFIJO + randomBytes(24).toString('base64url')
}

export function olvidarClaveEnCache(hash: string) {
  cache.delete(hash)
}
