import { randomBytes } from 'crypto'
import { getDb } from '@/lib/firebaseAdmin'
import { linkCampana } from '@/lib/campanas'
import { OBJETIVOS_PUBLICACION } from '@/lib/lanzamiento'
import { SITE_URL } from '@/lib/sitio'

// Calendario de marketing compartido por link (Admin → Marketing → Plan
// de lanzamiento → 🔗 Compartir): quien tenga el link ve el calendario
// sin entrar al admin y, si se le dio permiso, marca lo que publicó.
// config/calendarioCompartido = { token, permiso: 'ver' | 'marcar' }. Solo servidor.

export type PermisoCalendario = 'ver' | 'marcar'

export async function leerCompartido(): Promise<{ token: string; permiso: PermisoCalendario; creadoAt: string } | null> {
  const d = await getDb().collection('config').doc('calendarioCompartido').get().catch(() => null)
  const x = d?.data()
  return x?.token ? { token: x.token, permiso: x.permiso === 'marcar' ? 'marcar' : 'ver', creadoAt: x.creadoAt || '' } : null
}

export async function crearCompartido(permiso: PermisoCalendario) {
  const doc = { token: randomBytes(18).toString('base64url'), permiso, creadoAt: new Date().toISOString() }
  await getDb().collection('config').doc('calendarioCompartido').set(doc)
  return doc
}

export async function revocarCompartido() {
  await getDb().collection('config').doc('calendarioCompartido').delete()
}

// ¿El token del link es el vigente? (comparación de largo fijo)
export async function validarToken(token: string) {
  const c = await leerCompartido()
  if (!c || typeof token !== 'string' || token.length !== c.token.length) return null
  let dif = 0
  for (let i = 0; i < token.length; i++) dif |= token.charCodeAt(i) ^ c.token.charCodeAt(i)
  return dif === 0 ? c : null
}

// Las publicaciones como las ve quien tiene el link: sin números, con el
// texto final (link ya puesto).
export async function publicacionesCompartidas() {
  const snap = await getDb().collection('publicacionesMarketing').get()
  return snap.docs
    .map((d) => {
      const p = d.data() as any
      const destino = OBJETIVOS_PUBLICACION.find((o) => o.id === p.objetivo)?.destino || '/'
      const link = p.campanaId ? linkCampana(SITE_URL, { id: p.campanaId, destino }) : ''
      const texto = `${String(p.texto || '').replaceAll('{LINK}', link)}${p.hashtags ? `\n\n${p.hashtags}` : ''}`
      return { id: d.id, fecha: p.fecha, red: p.red, formato: p.formato, titulo: p.titulo, idea: p.idea || '', texto, link, estado: p.estado }
    })
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
}
