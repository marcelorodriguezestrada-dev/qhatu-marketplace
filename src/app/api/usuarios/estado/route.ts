import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest, getAuthAdmin } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Cuentas creadas ANTES de esta fecha (cuando no existía el sistema de
// verificación) quedan verificadas automáticamente sin importar nada
// más — así no le pedimos código de la nada a alguien que ya venía
// usando su cuenta con normalidad.
const VERIFICACION_DESDE = new Date('2026-09-12T00:00:00Z')

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
    // Cuenta de prueba (Admin → Usuarios): sin restricciones de horario.
    const esPrueba = registro.customClaims?.esPrueba === true
    const creadaAntesDelSistema = new Date(registro.metadata.creationTime) < VERIFICACION_DESDE
    // El admin "entrando como" el vendedor (ver src/lib/modoAdmin.ts)
    // no tiene el código de verificación — no lo frenamos.
    if (creadaAntesDelSistema || usuario.cargaAdmin) {
      return NextResponse.json({ emailVerificado: true, esPrueba })
    }

    const db = getDb()
    const doc = await db.collection('usuarios').doc(usuario.uid).get()
    const emailVerificado = doc.exists && doc.data()?.emailVerificado === true
    return NextResponse.json({ emailVerificado, esPrueba })
  } catch (err) {
    console.error('GET /api/usuarios/estado', err)
    // Si falla la consulta, dejamos pasar — mejor no bloquear a nadie
    // por un error nuestro de lectura.
    return NextResponse.json({ emailVerificado: true })
  }
}
