// Cuándo una cuenta cuenta como "email verificado" (lo usan /api/usuarios/estado
// y la lista de Admin → Usuarios, para que digan lo mismo).

// Cuentas creadas ANTES de esta fecha (cuando no existía el sistema de
// verificación) quedan verificadas automáticamente sin importar nada
// más — así no le pedimos código de la nada a alguien que ya venía
// usando su cuenta con normalidad.
export const VERIFICACION_DESDE = new Date('2026-09-12T00:00:00Z')

type CuentaAuth = { emailVerified: boolean; providerData: { providerId: string }[]; metadata: { creationTime: string } }

// Entró con "Continuar con Google": Google ya confirmó que el correo es suyo.
export const entroConGoogle = (u: CuentaAuth) => u.emailVerified && u.providerData.some((p) => p.providerId === 'google.com')

export function estaVerificada(u: CuentaAuth, datos: { emailVerificado?: boolean; creadoPorAdmin?: boolean } | undefined) {
  return new Date(u.metadata.creationTime) < VERIFICACION_DESDE || entroConGoogle(u) || datos?.emailVerificado === true || datos?.creadoPorAdmin === true
}
