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
  ingeniero: 'M12 2l3 5h-2v3h3l4 9H4l4-9h3V7H9z M9 12h6',
}

export function ServiceIcon({ kind, size = 34 }: { kind: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind] || PATHS.otro} />
    </svg>
  )
}

// RUBROS: lista plana de los rubros base (Categoría > Rubro), solo
// para los lugares que necesitan buscar una etiqueta rápido a partir
// de un id (ej. un popup del mapa). Ojo: esta lista NO incluye
// categorías ni rubros agregados desde /admin — para eso, o para
// armar un selector completo por categorías, usar `useCategorias()`
// (src/lib/useCategorias.ts), que trae la taxonomía real (base +
// lo agregado) desde /api/categorias.
import { CATEGORIAS_BASE } from '@/data/categorias'

export const RUBROS = CATEGORIAS_BASE.flatMap((c) => c.rubros).sort((a, b) =>
  a.id === 'otro' ? 1 : b.id === 'otro' ? -1 : a.label.localeCompare(b.label, 'es')
)
