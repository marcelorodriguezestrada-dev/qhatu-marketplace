import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { validarWhatsappPorPais, numeroConCodigoPais } from '@/lib/validarWhatsapp'
import { buscarPais } from '@/data/paises'
import { linkParaElegirContrasena } from '@/lib/linkContrasena'
import { buscarCiudad, sanearCiudad } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { sanearUbicacionPrueba } from '@/lib/cuentasPrueba'

// Alta de un usuario (y su tienda) por el admin: lo usan Admin → Usuarios
// (/api/admin/usuarios POST) y el bot de WhatsApp ("nueva tienda …").

export class ErrorAlta extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

export type DatosAlta = {
  email: string
  nombre?: string
  nombreNegocio?: string
  whatsapp?: string
  whatsappPais?: string
  ciudad?: string
  password?: string
  esPrueba?: boolean
  ubicacionPrueba?: unknown
}

export async function crearUsuarioAdmin(body: DatosAlta): Promise<{ uid: string; email: string; whatsapp: string; link: string | null; ciudad: string }> {
  const email = String(body.email || '').trim().toLowerCase()
  const nombre = String(body.nombre || '').trim().slice(0, 80)
  const nombreNegocio = String(body.nombreNegocio || '').trim().slice(0, 80)
  const whatsappLocal = String(body.whatsapp || '').trim()
  await cargarCiudadesServidor()
  const ciudad = sanearCiudad(body.ciudad)
  // Cuenta de prueba de una ciudad (con su casa de prueba para el checkout).
  const esPrueba = body.esPrueba === true
  const ubicacionPrueba = esPrueba ? sanearUbicacionPrueba(body.ubicacionPrueba, ciudad) : null
  if (esPrueba && !ubicacionPrueba) throw new ErrorAlta('Falta la dirección de prueba (ubicala en el mapa).')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorAlta('Poné un email válido.')
  const passwordInicial = String(body.password || '')
  if (passwordInicial && passwordInicial.length < 6) throw new ErrorAlta('La contraseña tiene que tener al menos 6 caracteres.')
  // País del WhatsApp: el que eligió el admin, o el de la ciudad de la tienda.
  const whatsappPais = body.whatsappPais === 'AR' || body.whatsappPais === 'BO' ? body.whatsappPais : buscarCiudad(ciudad).pais === 'AR' ? 'AR' : 'BO'
  let whatsapp = ''
  if (whatsappLocal) {
    const v = validarWhatsappPorPais(whatsappLocal, whatsappPais)
    if (!v.valido) throw new ErrorAlta(v.motivo || 'WhatsApp inválido.')
    whatsapp = numeroConCodigoPais(whatsappLocal, buscarPais(whatsappPais).codigo)
  }

  const authAdmin = getAuthAdmin()
  let uid: string
  try {
    // emailVerified: lo da de alta el admin, que ya habló con la
    // persona — no le pedimos el código de verificación.
    const creado = await authAdmin.createUser({ email, emailVerified: true, ...(nombre ? { displayName: nombre } : {}), ...(passwordInicial ? { password: passwordInicial.slice(0, 100) } : {}) })
    uid = creado.uid
    if (esPrueba) await authAdmin.setCustomUserClaims(uid, { esPrueba: true })
  } catch (err: any) {
    if (err?.code === 'auth/email-already-exists') throw new ErrorAlta('Ya existe una cuenta con ese email. Buscala en la lista de usuarios.', 409)
    throw err
  }

  const db = getDb()
  const ahora = new Date().toISOString()
  await db.collection('usuarios').doc(uid).set(
    { email, nombre, whatsapp, ...(whatsapp ? { whatsappPais } : {}), ciudad, emailVerificado: true, creadoPorAdmin: true, createdAt: ahora, ...(ubicacionPrueba ? { ubicacionPrueba } : {}) },
    { merge: true }
  )
  if (nombreNegocio || whatsapp || (ciudad !== 'potosi' && !esPrueba)) {
    await db.collection('vendedores').doc(uid).set(
      { nombreNegocio, whatsapp, whatsappPais: whatsapp ? whatsappPais : '', ciudad, email, creadoPorAdmin: true, updatedAt: ahora },
      { merge: true }
    )
  }

  // Si el admin ya le puso contraseña, no hace falta el link.
  const link = passwordInicial ? null : await linkParaElegirContrasena(email)
  return { uid, email, whatsapp, link, ciudad }
}
