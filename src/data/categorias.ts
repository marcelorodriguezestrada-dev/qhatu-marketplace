// Taxonomía por defecto: Categoría > Rubro. Esta es la base fija que
// viene con el código. El admin puede además:
//  - agregar categorías nuevas (colección Firestore `categorias_personalizadas`)
//  - agregar rubros nuevos dentro de cualquier categoría (colección
//    `rubros_personalizados`, la misma que ya se usaba para las
//    categorías que un profesional escribía a mano al elegir "Otro")
//  - mover un rubro de acá a otra categoría si no corresponde
//    (colección `rubro_categoria_overrides`)
//
// El armado final (base + lo agregado en Firestore) lo arma
// `/api/categorias`, que es la única fuente de verdad que debería
// consultar la UI (ver `src/lib/useCategorias.ts`). Este archivo es
// solo el punto de partida.

export type Rubro = { id: string; label: string }
export type Categoria = { id: string; label: string; rubros: Rubro[] }

export const CATEGORIAS_BASE: Categoria[] = [
  {
    id: 'salud',
    label: 'Salud',
    rubros: [
      { id: 'medico', label: 'Médico' },
      { id: 'enfermera', label: 'Enfermera a domicilio' },
      { id: 'odontologo', label: 'Odontólogo' },
      { id: 'oftalmologo', label: 'Oftalmólogo' },
    ],
  },
  {
    id: 'ingenieria',
    label: 'Ingeniería y construcción',
    rubros: [
      { id: 'ing-civil', label: 'Ingeniero civil' },
      { id: 'ing-sistemas', label: 'Ingeniero de sistemas' },
      { id: 'electricista', label: 'Electricista' },
      { id: 'plomero', label: 'Plomero' },
      { id: 'pintor', label: 'Pintor' },
    ],
  },
  {
    id: 'legal-y-finanzas',
    label: 'Legal y finanzas',
    rubros: [
      { id: 'abogado', label: 'Abogado' },
      { id: 'contador', label: 'Contador' },
    ],
  },
  {
    id: 'belleza',
    label: 'Belleza y estética',
    rubros: [
      { id: 'estilista', label: 'Estilista / peluquero' },
      { id: 'manicurista', label: 'Manicurista' },
    ],
  },
  {
    id: 'educacion',
    label: 'Educación',
    rubros: [
      { id: 'profesor', label: 'Profesor / clases' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    rubros: [
      { id: 'otro', label: 'Otro' },
    ],
  },
]

// Id de la categoría donde cae, por defecto, cualquier rubro nuevo que
// no se le asignó explícitamente una categoría.
export const CATEGORIA_FALLBACK_ID = 'otros'
