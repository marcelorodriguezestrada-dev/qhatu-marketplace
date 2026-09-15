// Taxonomía por defecto: Categoría > Grupo (opcional) > Rubro. Esta es
// la base fija que viene con el código. El admin puede además:
//  - agregar categorías nuevas (colección Firestore `categorias_personalizadas`)
//  - agregar rubros nuevos dentro de cualquier categoría (colección
//    `rubros_personalizados`, la misma que ya se usaba para las
//    categorías que un profesional escribía a mano al elegir "Otro")
//  - mover un rubro de acá a otra categoría si no corresponde
//    (colección `rubro_categoria_overrides`)
//
// El nivel intermedio `grupo` es OPCIONAL y sirve para especialidades:
// "Salud > Médicos > Neurocirujano". Un rubro sin `grupo` se muestra
// directo bajo su categoría, como antes ("Salud > Odontólogo").
//
// El armado final (base + lo agregado en Firestore) lo arma
// `/api/categorias`, que es la única fuente de verdad que debería
// consultar la UI (ver `src/lib/useCategorias.ts`). Este archivo es
// solo el punto de partida.

export type Grupo = { id: string; label: string }
export type Rubro = { id: string; label: string; grupo?: Grupo }
export type Categoria = { id: string; label: string; rubros: Rubro[] }

const G_MEDICOS: Grupo = { id: 'medicos', label: 'Médicos' }
const G_SALUD_MENTAL: Grupo = { id: 'salud-mental', label: 'Salud mental' }
const G_TERAPIAS: Grupo = { id: 'terapias', label: 'Terapias y rehabilitación' }
const G_INGENIEROS: Grupo = { id: 'ingenieros', label: 'Ingenieros' }
const G_OFICIOS: Grupo = { id: 'oficios', label: 'Oficios de obra' }
const G_ABOGADOS: Grupo = { id: 'abogados', label: 'Abogados' }

export const CATEGORIAS_BASE: Categoria[] = [
  {
    id: 'salud',
    label: 'Salud',
    rubros: [
      // Médicos — el id 'medico' se mantiene tal cual porque ya hay
      // profesionales publicados con ese valor; ahora es "clínico" y
      // convive con las especialidades nuevas.
      { id: 'medico', label: 'Médico clínico / general', grupo: G_MEDICOS },
      { id: 'medico-ginecologo', label: 'Ginecólogo/a', grupo: G_MEDICOS },
      { id: 'medico-pediatra', label: 'Pediatra', grupo: G_MEDICOS },
      { id: 'medico-neurocirujano', label: 'Neurocirujano/a', grupo: G_MEDICOS },
      { id: 'medico-traumatologo', label: 'Traumatólogo/a', grupo: G_MEDICOS },
      { id: 'medico-cardiologo', label: 'Cardiólogo/a', grupo: G_MEDICOS },
      { id: 'medico-dermatologo', label: 'Dermatólogo/a', grupo: G_MEDICOS },
      { id: 'medico-gastroenterologo', label: 'Gastroenterólogo/a', grupo: G_MEDICOS },
      { id: 'medico-otorrino', label: 'Otorrinolaringólogo/a', grupo: G_MEDICOS },
      { id: 'medico-urologo', label: 'Urólogo/a', grupo: G_MEDICOS },
      { id: 'oftalmologo', label: 'Oftalmólogo/a', grupo: G_MEDICOS },

      { id: 'psicologo', label: 'Psicólogo/a', grupo: G_SALUD_MENTAL },
      { id: 'psiquiatra', label: 'Psiquiatra', grupo: G_SALUD_MENTAL },

      { id: 'kinesiologo', label: 'Kinesiólogo/a / fisioterapeuta', grupo: G_TERAPIAS },
      { id: 'fonoaudiologo', label: 'Fonoaudiólogo/a', grupo: G_TERAPIAS },
      { id: 'nutricionista', label: 'Nutricionista', grupo: G_TERAPIAS },

      { id: 'enfermera', label: 'Enfermera/o a domicilio' },
      { id: 'odontologo', label: 'Odontólogo/a' },
    ],
  },
  {
    id: 'ingenieria',
    label: 'Ingeniería y construcción',
    rubros: [
      { id: 'ing-civil', label: 'Ingeniero/a civil', grupo: G_INGENIEROS },
      { id: 'ing-sistemas', label: 'Ingeniero/a de sistemas', grupo: G_INGENIEROS },
      { id: 'ing-electrico', label: 'Ingeniero/a eléctrico', grupo: G_INGENIEROS },
      { id: 'ing-industrial', label: 'Ingeniero/a industrial', grupo: G_INGENIEROS },
      { id: 'arquitecto', label: 'Arquitecto/a', grupo: G_INGENIEROS },

      { id: 'electricista', label: 'Electricista', grupo: G_OFICIOS },
      { id: 'plomero', label: 'Plomero/a', grupo: G_OFICIOS },
      { id: 'pintor', label: 'Pintor/a', grupo: G_OFICIOS },
      { id: 'albanil', label: 'Albañil', grupo: G_OFICIOS },
      { id: 'carpintero', label: 'Carpintero/a', grupo: G_OFICIOS },
      { id: 'soldador', label: 'Soldador/a', grupo: G_OFICIOS },
      { id: 'gasista', label: 'Gasista', grupo: G_OFICIOS },
    ],
  },
  {
    id: 'legal-y-finanzas',
    label: 'Legal y finanzas',
    rubros: [
      { id: 'abogado', label: 'Abogado/a (general)', grupo: G_ABOGADOS },
      { id: 'abogado-laboral', label: 'Abogado/a laboral', grupo: G_ABOGADOS },
      { id: 'abogado-familia', label: 'Abogado/a de familia', grupo: G_ABOGADOS },
      { id: 'abogado-penal', label: 'Abogado/a penalista', grupo: G_ABOGADOS },
      { id: 'abogado-civil', label: 'Abogado/a civil', grupo: G_ABOGADOS },

      { id: 'contador', label: 'Contador/a' },
      { id: 'notario', label: 'Notario/a de fe pública' },
    ],
  },
  {
    id: 'belleza',
    label: 'Belleza y estética',
    rubros: [
      { id: 'estilista', label: 'Estilista / peluquero/a' },
      { id: 'manicurista', label: 'Manicurista' },
      { id: 'cosmetologa', label: 'Cosmetólogo/a' },
      { id: 'masajista', label: 'Masajista' },
    ],
  },
  {
    id: 'educacion',
    label: 'Educación',
    rubros: [
      { id: 'profesor', label: 'Profesor/a / clases particulares' },
      { id: 'profesor-idiomas', label: 'Profesor/a de idiomas' },
      { id: 'profesor-musica', label: 'Profesor/a de música' },
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
