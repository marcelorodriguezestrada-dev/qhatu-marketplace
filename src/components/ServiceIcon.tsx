const PATHS: Record<string, string> = {
  abogado: 'M12 3v18 M7 6h10 M5 6l3 6a3 3 0 006 0l-3-6z M19 6l-3 6a3 3 0 006 0l-3-6z',
  contador: 'M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5',
  electricista: 'M13 2L4 14h6l-1 8 9-12h-6z',
  enfermera: 'M12 3v8 M8 7h8 M5 13h14v6a2 2 0 01-2 2H7a2 2 0 01-2-2z',
  estilista: 'M6 6a2 2 0 100 4 2 2 0 000-4z M6 14a2 2 0 100 4 2 2 0 000-4z M7.5 7.5L20 20 M7.5 16.5L20 4',
  manicurista: 'M8 3v8a4 4 0 008 0V3 M8 3a1 1 0 00-1 1v1a1 1 0 001 1 M16 21v-6',
  medico: 'M12 3v6 M9 6h6 M5 11h14v6a2 2 0 01-2 2H7a2 2 0 01-2-2z M9 15h6',
  odontologo: 'M12 3c-3 0-5 2-5 5 0 3 1 4 1 7 0 2 1 3 2 3s1-2 2-4 1-2 2 0 1 4 2 4 2-1 2-3c0-3 1-4 1-7 0-3-2-5-5-5z',
  oftalmologo: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z M12 15a3 3 0 100-6 3 3 0 000 6z',
  otro: 'M12 3a4 4 0 100 8 4 4 0 000-8z M5 21c0-4 3-7 7-7s7 3 7 7',
  pintor: 'M9 3h6v6l3 3v7a2 2 0 01-2 2H8a2 2 0 01-2-2v-7l3-3z M9 3v3h6V3',
  plomero: 'M6 4h5v6H6z M11 7h4v3a3 3 0 003 3v7h-4v-5H9v5H6v-8a3 3 0 013-3z',
  profesor: 'M3 8l9-4 9 4-9 4-9-4z M7 10.5V15c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5',
}

export function ServiceIcon({ kind, size = 34 }: { kind: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind] || PATHS.otro} />
    </svg>
  )
}

// Orden alfabético por "label" — así se ve como pide el documento: una
// lista vertical prolija, no botones amontonados sin criterio. "Otro"
// siempre queda al final, sea cual sea su posición alfabética.
export const RUBROS = [
  { id: 'abogado', label: 'Abogado' },
  { id: 'contador', label: 'Contador' },
  { id: 'electricista', label: 'Electricista' },
  { id: 'enfermera', label: 'Enfermera a domicilio' },
  { id: 'estilista', label: 'Estilista / peluquero' },
  { id: 'manicurista', label: 'Manicurista' },
  { id: 'medico', label: 'Médico' },
  { id: 'odontologo', label: 'Odontólogo' },
  { id: 'oftalmologo', label: 'Oftalmólogo' },
  { id: 'pintor', label: 'Pintor' },
  { id: 'plomero', label: 'Plomero' },
  { id: 'profesor', label: 'Profesor / clases' },
  { id: 'otro', label: 'Otro' },
].sort((a, b) => (a.id === 'otro' ? 1 : b.id === 'otro' ? -1 : a.label.localeCompare(b.label, 'es')))
