import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest, getAuthAdmin } from '@/lib/firebaseAdmin'
import { sincronizarDatosCuenta } from '@/lib/datosCuentaServer'
import { entroConGoogle, estaVerificada } from '@/lib/verificacion'

export const dynamic = 'force-dynamic'

// Lo consulta /login justo después de iniciar sesión (no solo al
// registrarse) — cubre el caso de alguien que se registró y cerró la
// app antes de terminar de verificar el código.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    // Ojo con esto: antes decidíamos "verificado" solo mirando si
    // existía el documento en `usuarios/` — pero ese documento lo crea
    // /api/usuarios/registrar en un pedido APARTE, justo después de
    // registrarse. Como esta consulta se dispara sola (la escucha
    // /lib/auth.tsx apenas cambia la sesión), podía llegar más rápido
    // que esa creación y encontrar "no hay documento todavía" — y
    // tratar a una cuenta recién creada como si fuera una cuenta vieja
    // ya verificada. Usar la fecha de creación de la cuenta en Firebase
    // (que no depende de ninguna otra escritura nuestra) saca esa
    // carrera de en medio.
    const registro = await getAuthAdmin().getUser(usuario.uid)
    // Si cambió su email desde "Mi cuenta" (se confirma con un link al
    // correo nuevo), lo copiamos a su tienda y productos la primera vez
    // que entra con el email nuevo.
    if (usuario.email) {
      try {
        const v = await getDb().collection('vendedores').doc(usuario.uid).get()
        const anterior = v.data()?.email
        if (v.exists && anterior && anterior !== usuario.email) await sincronizarDatosCuenta(usuario.uid, { email: usuario.email })
      } catch (err) {
        console.error('sincronizar email', err)
      }
    }
    // Cuenta de prueba (Admin → Usuarios): sin restricciones de horario.
    const esPrueba = registro.customClaims?.esPrueba === true
    const doc = await getDb().collection('usuarios').doc(usuario.uid).get()
    const datos = doc.data()
    // Cuenta de prueba de una ciudad: su ciudad y su casa de prueba (ver
    // Admin → Usuarios → "Crear usuario de prueba").
    const prueba = esPrueba ? { ciudadPrueba: datos?.ubicacionPrueba?.ciudad || null, ubicacionPrueba: datos?.ubicacionPrueba || null } : {}
    // El admin "entrando como" el vendedor (ver src/lib/modoAdmin.ts)
    // no tiene el código de verificación — no lo frenamos.
    if (usuario.cargaAdmin) return NextResponse.json({ emailVerificado: true, esPrueba, ...prueba })

    const emailVerificado = estaVerificada(registro, datos)
    // Con Google no pasó por el formulario de registro: le falta el
    // celular (obligatorio), que se le pide una sola vez en /login.
    const faltaCelular = entroConGoogle(registro) && !datos?.celular && !datos?.whatsapp
    return NextResponse.json({ emailVerificado, esPrueba, faltaCelular, ...prueba })
  } catch (err) {
    console.error('GET /api/usuarios/estado', err)
    // Si falla la consulta, dejamos pasar — mejor no bloquear a nadie
    // por un error nuestro de lectura.
    return NextResponse.json({ emailVerificado: true })
  }
}
