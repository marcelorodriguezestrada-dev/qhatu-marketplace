// Validación básica de números de WhatsApp bolivianos. Esto NO es una
// verificación real (no manda un SMS ni confirma que el número exista
// de verdad — eso requeriría un servicio pago tipo Twilio, que no
// entra en el presupuesto "gratis" de este proyecto). Lo que sí hace es
// filtrar los casos obvios de números inventados (todos los dígitos
// iguales, secuencias como 12345678) y el formato correcto de un
// celular boliviano (8 dígitos, empieza con 6 o 7).

import { PAIS_FALLBACK_ID } from '@/data/paises'

export function validarWhatsappBoliviano(numero: string): { valido: boolean; motivo?: string } {
  const limpio = (numero || '').replace(/\D/g, '')
  // Si lo mandaron con el 591 adelante, lo sacamos para validar el número local de 8 dígitos.
  const local = limpio.startsWith('591') && limpio.length > 8 ? limpio.slice(3) : limpio

  if (local.length !== 8) {
    return { valido: false, motivo: 'El número de telefono tiene que tener 8 dígitos.' }
  }
  if (!/^[67]/.test(local)) {
    return { valido: false, motivo: 'Teléfono inválido.' }
  }
  if (/^(\d)\1{7}$/.test(local)) {
    return { valido: false, motivo: 'Ese número no parece real — revisalo.' }
  }
  const digitos = local.split('').map(Number)
  const ascendente = digitos.every((d, i) => i === 0 || d === digitos[i - 1] + 1)
  const descendente = digitos.every((d, i) => i === 0 || d === digitos[i - 1] - 1)
  if (ascendente || descendente) {
    return { valido: false, motivo: 'Ese número no parece real — revisalo.' }
  }
  return { valido: true }
}

// Arma el número completo con 591 adelante, para el link de WhatsApp —
// así el usuario solo tiene que escribir su número local, sin pensar en
// el código de país.
export function numeroLocalABolivia(numero: string): string {
  const limpio = (numero || '').replace(/\D/g, '')
  if (limpio.startsWith('591') && limpio.length > 8) return limpio
  return '591' + limpio
}

// Versiones "por país" de las dos funciones de arriba, para cuando el
// formulario tiene un selector de país al lado del número (ver
// src/data/paises.ts). Por ahora solo hay reglas de validación para
// Bolivia ('BO'); cuando se sume otro país, su validación específica
// se agrega acá.
export function validarWhatsappPorPais(numero: string, paisId: string = PAIS_FALLBACK_ID): { valido: boolean; motivo?: string } {
  if (paisId === 'BO') return validarWhatsappBoliviano(numero)
  if (paisId === 'AR') return validarWhatsappArgentino(numero)
  return { valido: false, motivo: 'Ese país todavía no está soportado.' }
}

// Argentina: código de área + número = 10 dígitos (ej. 11 2345 6789),
// sin el 0 del área ni el 15. Acepta que lo peguen con 54 / 549 adelante.
export function localArgentino(numero: string): string {
  let l = (numero || '').replace(/\D/g, '')
  if (l.startsWith('54') && l.length >= 12) l = l.slice(2)
  if (l.startsWith('9') && l.length === 11) l = l.slice(1)
  if (l.startsWith('0')) l = l.slice(1)
  return l
}
export function validarWhatsappArgentino(numero: string): { valido: boolean; motivo?: string } {
  const l = localArgentino(numero)
  if (l.length !== 10) return { valido: false, motivo: 'Teléfono inválido: código de área + número, 10 dígitos (ej. 1123456789).' }
  if (/^(\d)\1+$/.test(l)) return { valido: false, motivo: 'Ese número no parece real — revisalo.' }
  return { valido: true }
}

export function numeroConCodigoPais(numero: string, codigoPais: string): string {
  const limpio = (numero || '').replace(/\D/g, '')
  if (codigoPais === '54') return `549${localArgentino(limpio)}`
  if (limpio.startsWith(codigoPais) && limpio.length > 8) return limpio
  return codigoPais + limpio
}
