import { buscarCiudad } from '@/data/ciudades'
import { PAISES_MERCADO, type PaisMercado } from '@/data/paisesMercado'
import { localArgentino, validarWhatsappArgentino, validarWhatsappBoliviano } from '@/lib/validarWhatsapp'

// El "mercado" (país) de una ciudad: su moneda, su teléfono, su hora y
// sus formas de pago. Bolivia sigue igual que siempre (Bs, +591, hora
// de Bolivia, QR con lectura automática del comprobante); el resto de
// los países usa lo cargado en Admin → Inicio → Países y ciudades.
// Sirve en el navegador y en el servidor: los datos guardados por el
// admin se registran con registrarPaises() (ver cargarCiudades y
// cargarCiudadesServidor).

let PAISES: PaisMercado[] = PAISES_MERCADO
export function registrarPaises(lista: PaisMercado[]) {
  if (!Array.isArray(lista) || !lista.length) return
  const porId = new Map(PAISES_MERCADO.map((p) => [p.id, p]))
  for (const p of lista) if (p?.id) porId.set(p.id, { ...(porId.get(p.id) || {}), ...p, pagos: { ...(porId.get(p.id)?.pagos || {}), ...(p.pagos || {}) } } as PaisMercado)
  PAISES = Array.from(porId.values())
}

export function buscarPaisMercado(id: string | null | undefined): PaisMercado {
  return PAISES.find((p) => p.id === id) || PAISES.find((p) => p.id === 'BO')!
}

export function paisDeCiudad(ciudadId: string | null | undefined): PaisMercado {
  return buscarPaisMercado(buscarCiudad(ciudadId).pais)
}

export const esBolivia = (p: PaisMercado) => p.id === 'BO'

// "Bs 150" en Bolivia; "$ 15.000" en Argentina.
export function formatoMoneda(n: number, pais: PaisMercado = buscarPaisMercado('BO')): string {
  const valor = Number(n || 0).toLocaleString(`es-${pais.id}`, { maximumFractionDigits: 2 })
  return `${pais.simboloMoneda} ${valor}`
}

// Un Date cuyos getHours()/getDay() son la hora de pared del país (para
// tiendaAbierta, envioExpressDisponible, etc. de src/lib/entregaDias.ts).
export function ahoraEnPais(pais: PaisMercado, ahora: Date = new Date()): Date {
  try {
    return new Date(ahora.toLocaleString('en-US', { timeZone: pais.zonaHoraria }))
  } catch {
    return ahora
  }
}

// Celular del país, sin el prefijo. Bolivia: las reglas de siempre
// (8 dígitos, empieza con 6 o 7). Argentina: código de área + número
// (10 dígitos, sin 0 ni 15). Otros: la cantidad de dígitos cargada.
export function validarTelefono(numero: string, pais: PaisMercado): { valido: boolean; motivo?: string } {
  if (esBolivia(pais)) return validarWhatsappBoliviano(numero)
  if (pais.id === 'AR') return validarWhatsappArgentino(numero).valido ? { valido: true } : { valido: false, motivo: 'Teléfono inválido.' }
  let local = String(numero || '').replace(/\D/g, '')
  if (pais.prefijoTel && local.startsWith(pais.prefijoTel) && local.length > pais.digitosTel) local = local.slice(pais.prefijoTel.length)
  if (local.length !== pais.digitosTel) return { valido: false, motivo: 'Teléfono inválido.' }
  if (/^(\d)\1+$/.test(local)) return { valido: false, motivo: 'Teléfono inválido.' }
  return { valido: true }
}

// Número completo para WhatsApp (wa.me): 591 + 8 dígitos en Bolivia;
// 54 9 + 10 dígitos en Argentina (así lo pide WhatsApp para celulares).
export function telefonoInternacional(numero: string, pais: PaisMercado): string {
  let local = String(numero || '').replace(/\D/g, '')
  if (!local) return ''
  const pre = pais.prefijoTel || '591'
  if (local.startsWith(pre) && local.length > pais.digitosTel) local = local.slice(pre.length)
  if (pais.id === 'AR') return `549${localArgentino(local)}`
  return `${pre}${local}`
}

// Ejemplo para el placeholder del campo de WhatsApp.
export function ejemploTelefono(pais: PaisMercado): string {
  if (esBolivia(pais)) return 'Ej: 71234567'
  if (pais.id === 'AR') return 'Ej: 1123456789'
  return `Ej: ${'1234567890123'.slice(0, pais.digitosTel)}`
}
