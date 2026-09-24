// CV estandarizado de cada profesional: historial laboral estructurado
// (empresa/cargo/fechas/logros/stack) e idiomas. Con esto + los datos
// que el perfil ya tiene (nombre, especialidad, descripción, estudios,
// servicios, contacto) se arma el CV "oficial" en /servicios/[id]/cv,
// con el mismo formato para todos — tenga o no la persona un CV propio.
//
// Este archivo no importa nada de servidor ni de navegador: lo usan los
// endpoints (para sanear lo que llega) y las pantallas (para editar y
// mostrar), así el formato y los límites son los mismos en todos lados.

export type PuestoLaboral = {
  id: string
  cargo: string
  empresa: string
  // Aclaración opcional al lado de la empresa, ej: "Cliente: KAVAK" o
  // "Proyecto Mercado Libre vía Accenture".
  cliente: string
  // "AAAA-MM" o solo "AAAA" (mucha gente no recuerda el mes exacto).
  desde: string
  hasta: string
  actual: boolean
  // Cada logro idealmente como "Título corto: descripción" — el título
  // se muestra en negrita en el CV, igual que el ejemplo de referencia.
  logros: string[]
  // Herramientas, tecnologías o materiales con los que trabajó ahí.
  stack: string[]
}

export type Idioma = { idioma: string; nivel: string }

export const MAX_PUESTOS = 12
export const MAX_LOGROS_POR_PUESTO = 6
export const MAX_STACK_POR_PUESTO = 15
export const MAX_IDIOMAS = 6

export const NIVELES_IDIOMA = ['Nativo', 'Bilingüe', 'Avanzado', 'Profesional', 'Intermedio', 'Básico']

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

// Acepta "AAAA-MM" o "AAAA" (y también "MM/AAAA", que es como lo suele
// escribir la IA o la gente); cualquier otra cosa queda vacía.
export function normalizarFecha(v: unknown): string {
  const s = texto(v, 20)
  let m = s.match(/^(\d{4})-(\d{1,2})$/)
  if (m) {
    const mes = Number(m[2])
    return mes >= 1 && mes <= 12 ? `${m[1]}-${String(mes).padStart(2, '0')}` : m[1]
  }
  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) {
    const mes = Number(m[1])
    return mes >= 1 && mes <= 12 ? `${m[2]}-${String(mes).padStart(2, '0')}` : m[2]
  }
  m = s.match(/^(\d{4})$/)
  return m ? m[1] : ''
}

function listaDeTextos(v: unknown, maxItems: number, maxLargo: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((s) => texto(s, maxLargo))
    .filter((s) => s.length > 0)
    .slice(0, maxItems)
}

// Nunca confiamos en que el body venga limpio — ni del dueño ni del
// admin ni de la IA. Descarta puestos sin cargo ni empresa.
export function sanearHistorialLaboral(v: unknown): PuestoLaboral[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((p) => p && typeof p === 'object')
    .map((p: any, i: number) => {
      const actual = !!p.actual
      return {
        id: texto(p.id, 40) || `p${Date.now()}${i}`,
        cargo: texto(p.cargo, 100),
        empresa: texto(p.empresa, 100),
        cliente: texto(p.cliente, 120),
        desde: normalizarFecha(p.desde),
        hasta: actual ? '' : normalizarFecha(p.hasta),
        actual,
        logros: listaDeTextos(p.logros, MAX_LOGROS_POR_PUESTO, 320),
        stack: listaDeTextos(p.stack, MAX_STACK_POR_PUESTO, 40),
      }
    })
    .filter((p) => p.cargo || p.empresa)
    .slice(0, MAX_PUESTOS)
}

export function sanearIdiomas(v: unknown): Idioma[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x) => x && typeof x === 'object')
    .map((x: any) => ({ idioma: texto(x.idioma, 40), nivel: texto(x.nivel, 80) }))
    .filter((x) => x.idioma)
    .slice(0, MAX_IDIOMAS)
}

export function formatearFecha(f: string): string {
  const m = f.match(/^(\d{4})-(\d{2})$/)
  if (m) return `${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`
  return f
}

export function rangoFechas(p: Pick<PuestoLaboral, 'desde' | 'hasta' | 'actual'>): string {
  const desde = formatearFecha(p.desde)
  const hasta = p.actual ? 'Actualidad' : formatearFecha(p.hasta)
  if (desde && hasta && desde !== hasta) return `${desde} – ${hasta}`
  return desde || hasta
}

// El puesto actual primero; después del más reciente al más viejo.
export function ordenarHistorial(historial: PuestoLaboral[]): PuestoLaboral[] {
  const clave = (p: PuestoLaboral) => (p.actual ? '9999-99' : p.hasta || p.desde || '0000')
  return [...historial].sort((a, b) => clave(b).localeCompare(clave(a)) || (b.desde || '').localeCompare(a.desde || ''))
}

// "Optimización de pipelines: Reingeniería de..." → título en negrita +
// descripción. Solo cortamos si el título es corto, para no poner en
// negrita media oración cuando el ":" está en otro lado.
export function separarLogro(logro: string): { titulo: string; detalle: string } {
  const i = logro.indexOf(':')
  if (i > 0 && i <= 60) return { titulo: logro.slice(0, i).trim(), detalle: logro.slice(i + 1).trim() }
  return { titulo: '', detalle: logro }
}

// El campo "educacion" es texto libre tipo "Maestría en Finanzas (UTDT)
// · Ingeniería en Sistemas (UCB)" — lo partimos en filas título /
// institución para la tabla del CV.
export function filasEducacion(educacion: string | undefined): { titulo: string; institucion: string }[] {
  if (!educacion) return []
  return educacion
    .split(/\s*[·•\n]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
      return m ? { titulo: m[1].trim(), institucion: m[2].trim() } : { titulo: s, institucion: '' }
    })
}

// Todas las herramientas del historial juntas, sin repetir, en el orden
// en que aparecen (primero las del puesto más reciente).
export function habilidadesDelHistorial(historial: PuestoLaboral[], max = 24): string[] {
  const vistas = new Set<string>()
  const resultado: string[] = []
  for (const p of ordenarHistorial(historial)) {
    for (const s of p.stack) {
      const k = s.toLowerCase()
      if (!vistas.has(k)) {
        vistas.add(k)
        resultado.push(s)
      }
    }
  }
  return resultado.slice(0, max)
}
