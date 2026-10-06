// Búsqueda de /servicios (profesionales). Como la de productos: cada
// palabra escrita tiene que aparecer en el profesional (nombre, rubro,
// grupo, categoría, especialidad, servicios, zona), sin acentos, con
// plural/femenino ("abogadas" → abogado) y sinónimos comunes
// ("doctor" → médico, "dentista" → odontólogo). La última palabra puede
// estar a medio escribir ("aboga" → abogado).
import { normalizar } from '@/lib/busqueda'

export type RubroInfoServicio = { label: string; categoriaLabel?: string; grupoLabel?: string | null }
export type ProfesionalBuscable = { nombre?: string; rubro?: string; especialidad?: string; zona?: string; servicios?: string[] }

// Palabra escrita → otras formas que también valen.
const SINONIMOS: Record<string, string[]> = {
  doctor: ['medico', 'medica', 'doctora'], doctora: ['medico', 'medica', 'doctor'], dr: ['medico', 'doctor'], dra: ['medico', 'doctora'],
  medico: ['doctor', 'doctora'], dentista: ['odontologo', 'odontologa', 'dental'], odontologo: ['dentista'], muela: ['odontologo', 'dentista'],
  psicologo: ['psicologia', 'terapeuta'], terapeuta: ['psicologo', 'terapia'], nutricionista: ['nutricion', 'dietista'],
  abogado: ['legal', 'juridico', 'jurista'], juicio: ['abogado'], contador: ['contable', 'contabilidad', 'auditor'], impuestos: ['contador', 'tributario'],
  profe: ['profesor', 'docente', 'clases'], profesor: ['docente', 'clases', 'tutor'], clases: ['profesor', 'docente', 'tutor'], tutor: ['profesor', 'clases'],
  ingeniero: ['ingenieria'], arquitecto: ['arquitectura', 'planos'], planos: ['arquitecto'], albanil: ['construccion', 'obra'], obra: ['construccion'],
  electricista: ['electrico', 'electricidad'], plomero: ['gasfitero', 'plomeria', 'gasfiteria'], gasfitero: ['plomero'],
  programador: ['desarrollador', 'software', 'sistemas'], sistemas: ['informatica', 'programador'], datos: ['data'], pc: ['computadora', 'tecnico'],
  peluquero: ['peluqueria', 'estilista', 'barbero'], estilista: ['peluqueria', 'peluquero'], barbero: ['barberia', 'peluquero'], unas: ['manicure', 'manicurista'],
  maquillaje: ['maquilladora', 'maquillador'], veterinario: ['veterinaria', 'mascotas'], mascota: ['veterinario'], fotografo: ['fotografia', 'fotos'],
  ecografia: ['ecografista', 'ecografo'], ecografista: ['ecografia'], ginecologo: ['ginecologia'], pediatra: ['pediatria', 'ninos'],
}

const raiz = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
// abogada ↔ abogado, psicóloga ↔ psicólogo
const sinGenero = (w: string) => (w.length > 4 && /[ao]$/.test(w) ? w.slice(0, -1) : w)

export function textoServicio(p: ProfesionalBuscable, r?: RubroInfoServicio) {
  return normalizar([p.nombre, r?.label, r?.grupoLabel, r?.categoriaLabel, p.especialidad, p.zona, ...(p.servicios || [])].filter(Boolean).join(' '))
}

function palabraEn(palabrasTexto: string[], w: string, parcial: boolean) {
  // A medio escribir ("doct"): también los sinónimos de las palabras que empiezan así.
  const claves = parcial && w.length >= 3 ? Object.keys(SINONIMOS).filter((k) => k.startsWith(w)) : []
  const formas = [w, raiz(w), sinGenero(raiz(w)), ...(SINONIMOS[w] || []), ...(SINONIMOS[raiz(w)] || []), ...claves.flatMap((k) => [k, ...SINONIMOS[k]])]
  return palabrasTexto.some((t) =>
    formas.some((f) => {
      if (f.length < 2) return false
      if (t === f || raiz(t) === f || sinGenero(raiz(t)) === sinGenero(f)) return true
      // Prefijo: la palabra que se está escribiendo, o raíces largas ("psicolog" → psicología).
      return (parcial || f.length >= 5) && t.startsWith(sinGenero(f))
    }),
  )
}

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'para', 'un', 'una', 'que'])

export function coincideServicio(p: ProfesionalBuscable, r: RubroInfoServicio | undefined, consulta: string, opciones: { parcial?: boolean } = {}) {
  const palabras = normalizar(consulta).split(' ').filter((w) => w && !VACIAS.has(w))
  if (!palabras.length) return true
  const texto = textoServicio(p, r).split(' ')
  return palabras.every((w, i) => palabraEn(texto, w, !!opciones.parcial && i === palabras.length - 1))
}
