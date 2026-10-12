'use client'

import { detectarRed, MAX_REDES, type RedDetectada, type RedSocialId } from '@/lib/redesSociales'

// Íconos de cada red (SVG propio, sin librerías) con su color.
const ESTILO: Record<RedSocialId, { fondo: string; svg: JSX.Element }> = {
  instagram: {
    fondo: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
    svg: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  facebook: {
    fondo: '#1877F2',
    svg: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.1v3h2.5V21h2.9z" />
      </svg>
    ),
  },
  linkedin: {
    fondo: '#0A66C2',
    svg: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
        <path d="M6.9 8.8H3.8V20h3.1V8.8zM5.3 4a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM20.2 13.6c0-3-1.6-4.9-4.2-4.9-1.5 0-2.4.8-2.8 1.5V8.8h-3V20h3.1v-5.9c0-1.5.6-2.6 2-2.6s1.8 1.1 1.8 2.6V20h3.1v-6.4z" />
      </svg>
    ),
  },
  tiktok: {
    fondo: '#000000',
    svg: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M16.6 3c.3 2.2 1.6 3.6 3.8 3.8v3c-1.4.1-2.6-.3-3.8-1v6.1c0 3.9-4.2 6.3-7.6 4.4-2.6-1.5-3.3-5-1.5-7.4 1.2-1.6 3.2-2.4 5.2-2.1v3.2c-1.1-.4-2.4.1-2.9 1.1-.6 1.1-.1 2.6 1.1 3 1.3.5 2.7-.4 2.7-1.8V3h3z" />
      </svg>
    ),
  },
  youtube: {
    fondo: '#FF0000',
    svg: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M10 15.5v-7l6 3.5-6 3.5z" />
      </svg>
    ),
  },
  x: {
    fondo: '#000000',
    svg: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5z" />
      </svg>
    ),
  },
  web: {
    fondo: '#475569',
    svg: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
    ),
  },
}

export function IconoRed({ id, chico }: { id: RedSocialId; chico?: boolean }) {
  const e = ESTILO[id]
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-white shrink-0 ${chico ? 'w-7 h-7 scale-90' : 'w-11 h-11'}`} style={{ background: e.fondo }}>
      {e.svg}
    </span>
  )
}

// Perfil público: un ícono por red, sin el usuario escrito.
export function IconosRedes({ redes }: { redes: RedDetectada[] }) {
  if (!redes.length) return null
  return (
    <div className="flex justify-center gap-2.5 mt-3">
      {redes.map((r) => (
        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.label} title={r.label} className="hover:opacity-90 transition shadow-sm rounded-full">
          <IconoRed id={r.id} />
        </a>
      ))}
    </div>
  )
}

// Formularios: hasta 5 links; al pegar cada uno se ve qué red detectamos.
export function CampoRedes({ valor, onChange, className = '' }: { valor: string[]; onChange: (v: string[]) => void; className?: string }) {
  const filas = valor.length ? valor : ['']
  function cambiar(i: number, t: string) {
    const nuevo = [...filas]
    nuevo[i] = t
    onChange(nuevo)
  }
  return (
    <div className={className}>
      <div className="font-body text-xs font-semibold text-ink mb-1">🔗 Redes sociales o página web (opcional)</div>
      <div className="font-body text-[11px] text-inksoft mb-1.5">Pegá el link de tu Instagram, Facebook, LinkedIn, TikTok o web: el ícono aparece solo.</div>
      {filas.map((t, i) => {
        const red = detectarRed(t)
        return (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            {red ? <IconoRed id={red.id} chico /> : <span className="w-7 h-7 rounded-full bg-panelalt border border-line shrink-0" />}
            <input
              value={t}
              onChange={(e) => cambiar(i, e.target.value)}
              placeholder={i === 0 ? 'Ej: instagram.com/tu_usuario' : 'Otra red (ej: linkedin.com/in/tu-nombre)'}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-line font-body text-sm"
            />
            {filas.length > 1 && (
              <button type="button" onClick={() => onChange(filas.filter((_, j) => j !== i))} className="font-body text-xs text-inksoft px-1" aria-label="Quitar">✕</button>
            )}
          </div>
        )
      })}
      {filas.length < MAX_REDES && filas[filas.length - 1]?.trim() && (
        <button type="button" onClick={() => onChange([...filas, ''])} className="font-body text-xs text-teal font-semibold">+ Agregar otra red</button>
      )}
    </div>
  )
}
