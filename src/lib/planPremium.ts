// Reglas de la membresía Premium — un solo lugar para el precio y la
// duración, así nunca queda un número pisado en un componente y otro
// distinto en otro.
export const PRECIO_PREMIUM_BS = 30
export const DURACION_PREMIUM_DIAS = 30
export const MAX_FOTOS_ADICIONALES_PREMIUM = 4

export interface DatosPlanProfesional {
  plan?: string
  planVigenciaHasta?: string | null // ISO date
}

/**
 * Un profesional puede tener plan:'premium' guardado en Firestore pero
 * la fecha ya vencida (nadie renovó) — en vez de correr un cron job que
 * lo "degrade" activamente, en cualquier lugar donde importe si alguien
 * ES premium AHORA (orden del listado, badge, beneficios) se pregunta
 * por el plan EFECTIVO con esta función, no por el campo crudo `plan`.
 */
export function esPremiumVigente(p: DatosPlanProfesional): boolean {
  if (p.plan !== 'premium') return false
  if (!p.planVigenciaHasta) return false
  return new Date(p.planVigenciaHasta).getTime() > Date.now()
}

/**
 * Calcula la nueva fecha de vencimiento al confirmar un pago. Si todavía
 * le quedaban días vigentes (pagó antes de que venza), se los respeta y
 * suma los días nuevos a partir de ahí — no pierde lo que ya pagó por
 * renovar temprano. Si ya estaba vencido (o nunca tuvo plan), arranca
 * de hoy.
 */
export function calcularNuevaVigencia(vigenciaActual?: string | null): string {
  const base = vigenciaActual && new Date(vigenciaActual).getTime() > Date.now()
    ? new Date(vigenciaActual)
    : new Date()
  base.setDate(base.getDate() + DURACION_PREMIUM_DIAS)
  return base.toISOString()
}
