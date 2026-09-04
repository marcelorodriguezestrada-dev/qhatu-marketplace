const PATHS: Record<string, string> = {
  contador: 'M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5',
  odontologo: 'M12 3c-3 0-5 2-5 5 0 3 1 4 1 7 0 2 1 3 2 3s1-2 2-4 1-2 2 0 1 4 2 4 2-1 2-3c0-3 1-4 1-7 0-3-2-5-5-5z',
  pintor: 'M9 3h6v6l3 3v7a2 2 0 01-2 2H8a2 2 0 01-2-2v-7l3-3z M9 3v3h6V3',
  plomero: 'M6 4h5v6H6z M11 7h4v3a3 3 0 003 3v7h-4v-5H9v5H6v-8a3 3 0 013-3z',
  electricista: 'M13 2L4 14h6l-1 8 9-12h-6z',
  profesor: 'M3 8l9-4 9 4-9 4-9-4z M7 10.5V15c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5',
  otro: 'M12 3a4 4 0 100 8 4 4 0 000-8z M5 21c0-4 3-7 7-7s7 3 7 7',
}

export function ServiceIcon({ kind, size = 34 }: { kind: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind] || PATHS.otro} />
    </svg>
  )
}

export const RUBROS = [
  { id: 'contador', label: 'Contador' },
  { id: 'odontologo', label: 'Odontólogo' },
  { id: 'pintor', label: 'Pintor' },
  { id: 'plomero', label: 'Plomero' },
  { id: 'electricista', label: 'Electricista' },
  { id: 'profesor', label: 'Profesor / clases' },
  { id: 'otro', label: 'Otro' },
]
