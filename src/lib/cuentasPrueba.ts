// Cuentas de prueba: pueden comprar a cualquier hora (sin el horario de
// atención 8–20 ni el corte de las 17:00 / domingos del envío express),
// para probar el circuito completo. Se pueden cambiar sin tocar código
// con la variable NEXT_PUBLIC_CUENTAS_PRUEBA en Vercel (emails separados
// por coma). El servidor lo verifica con el login, no con lo que diga el
// navegador. Sus pedidos quedan marcados como "prueba" en el admin.
const DEFECTO = ['pipicucu@yahoo.com', 'test@test.com']

export const CUENTAS_PRUEBA: string[] = (process.env.NEXT_PUBLIC_CUENTAS_PRUEBA || DEFECTO.join(','))
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function esCuentaPrueba(email: string | null | undefined): boolean {
  return !!email && CUENTAS_PRUEBA.includes(email.trim().toLowerCase())
}
