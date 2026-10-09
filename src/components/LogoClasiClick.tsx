// Logo de Clasi Click: el círculo con el borde verde punteado y el "techo"
// verde (el mismo del logo de la marca), más el nombre "ClasiClick".
export function MarcaClasiClick({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#16C35B" strokeWidth="5" strokeDasharray="9 6" />
      <circle cx="50" cy="50" r="38" fill="#111A2E" />
      {/* "techo" / flecha hacia arriba */}
      <path d="M22 66 L50 38 L78 66 L68 66 L50 48 L32 66 Z" fill="#16C35B" />
      <circle cx="50" cy="38" r="8" fill="#16C35B" />
      <path d="M44 41 L49 33 M48 43 L53 35 M52 45 L57 37" stroke="#111A2E" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function LogoClasiClick({ size = 34, conTexto = true, claro = true }: { size?: number; conTexto?: boolean; claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <MarcaClasiClick size={size} />
      {conTexto && (
        <span className="font-display font-bold leading-none tracking-tight" style={{ fontSize: size * 0.62 }}>
          <span className={claro ? 'text-white' : 'text-ink'}>Clasi</span>
          <span className="text-verde">Click</span>
        </span>
      )}
    </span>
  )
}
