import { getAuthAdmin } from '@/lib/firebaseAdmin'
import { SITE_URL } from '@/lib/anuncioPublico'

// Link de Firebase para que alguien a quien el admin le creó la cuenta
// elija su contraseña. Vence en ~1 hora: si ya venció, la persona puede
// entrar a /login → "¿Olvidaste tu contraseña?" y pedir uno nuevo.
export async function linkParaElegirContrasena(email: string): Promise<string | null> {
  try {
    return await getAuthAdmin().generatePasswordResetLink(email, { url: `${SITE_URL}/login` })
  } catch (err) {
    // Si el dominio no está autorizado en Firebase, probamos sin la
    // redirección (el link igual sirve para elegir la contraseña).
    try {
      return await getAuthAdmin().generatePasswordResetLink(email)
    } catch (err2) {
      console.error('linkParaElegirContrasena', err2)
      return null
    }
  }
}
