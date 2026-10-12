// Redes sociales de un profesional: el profesional pega el link (o el
// @usuario) y acá se detecta de qué red es, para mostrar su ícono en el
// perfil. Antes había un solo campo `instagram`; ahora es `redes` (una
// lista), y el `instagram` viejo se sigue leyendo.

export type RedSocialId = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'x' | 'web'

export type RedDetectada = { id: RedSocialId; label: string; url: string }

export const MAX_REDES = 5

const DOMINIOS: { id: RedSocialId; label: string; dominios: string[] }[] = [
  { id: 'instagram', label: 'Instagram', dominios: ['instagram.com', 'instagr.am'] },
  { id: 'facebook', label: 'Facebook', dominios: ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'] },
  { id: 'linkedin', label: 'LinkedIn', dominios: ['linkedin.com', 'lnkd.in'] },
  { id: 'tiktok', label: 'TikTok', dominios: ['tiktok.com'] },
  { id: 'youtube', label: 'YouTube', dominios: ['youtube.com', 'youtu.be'] },
  { id: 'x', label: 'X (Twitter)', dominios: ['x.com', 'twitter.com'] },
]

// Termina en un dominio conocido (anaquispe.com, mi-estudio.com.bo…).
const TLD = /\.(com|net|org|info|biz|io|me|co|app|dev|pro|site|online|store|shop|page|link|bo|ar|pe|cl|mx|es|uy|py|edu|gob|gov)(\.[a-z]{2})?$/i

export function detectarRed(texto: string): RedDetectada | null {
  const t = String(texto || '').trim()
  if (!t) return null
  // "@usuario" o "usuario" suelto (sin dominio): como era el campo viejo, es Instagram.
  const pareceDominio = t.includes('/') || TLD.test(t)
  if (/^@[A-Za-z0-9._]{2,30}$/.test(t) || (!pareceDominio && /^[A-Za-z0-9._]{2,30}$/.test(t))) {
    return { id: 'instagram', label: 'Instagram', url: `https://instagram.com/${t.replace(/^@/, '')}` }
  }
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  if (!host.includes('.')) return null
  const red = DOMINIOS.find((d) => d.dominios.some((dom) => host === dom || host.endsWith(`.${dom}`)))
  if (red) return { id: red.id, label: red.label, url }
  return { id: 'web', label: 'Página web', url }
}

// Las redes de un perfil, ya detectadas y sin repetir.
export function redesDe(perfil: { redes?: unknown; instagram?: unknown } | null | undefined): RedDetectada[] {
  const crudas = [
    ...(Array.isArray(perfil?.redes) ? (perfil!.redes as unknown[]) : []),
    ...(typeof perfil?.instagram === 'string' && perfil.instagram ? [perfil.instagram] : []),
  ]
  const vistas = new Set<string>()
  const out: RedDetectada[] = []
  for (const c of crudas) {
    const r = detectarRed(String(c))
    if (!r) continue
    const clave = r.url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
    if (vistas.has(clave)) continue
    vistas.add(clave)
    out.push(r)
  }
  return out.slice(0, MAX_REDES)
}

// Para guardar: solo textos que se reconocen como red o web.
export function sanearRedes(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x || '').trim().slice(0, 200))
    .filter((x) => !!detectarRed(x))
    .slice(0, MAX_REDES)
}
