// Validación básica de números de WhatsApp bolivianos. Esto NO es una
// verificación real (no manda un SMS ni confirma que el número exista
// de verdad — eso requeriría un servicio pago tipo Twilio, que no
// entra en el presupuesto "gratis" de este proyecto). Lo que sí hace es
// filtrar los casos obvios de números inventados (todos los dígitos
// iguales, secuencias como 12345678) y el formato correcto de un
// celular boliviano (8 dígitos, empieza con 6 o 7).

export function validarWhatsappBoliviano(numero: string): { valido: boolean; motivo?: string } {
  const limpio = (numero || '').replace(/\D/g, '')
  // Si lo mandaron con el 591 adelante, lo sacamos para validar el número local de 8 dígitos.
  const local = limpio.startsWith('591') && limpio.length > 8 ? limpio.slice(3) : limpio

  if (local.length !== 8) {
    return { valido: false, motivo: 'El número tiene que tener 8 dígitos (sin el +591, ese lo agregamos solos).' }
  }
  if (!/^[67]/.test(local)) {
    return { valido: false, motivo: 'Los celulares en Bolivia empiezan con 6 o 7.' }
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
