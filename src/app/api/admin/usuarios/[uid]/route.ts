import { NextRequest, NextResponse } from 'next/server'
import { getAuthAdmin } from '@/lib/firebaseAdmin'
import { linkParaElegirContrasena } from '@/lib/linkContrasena'
import { getDb } from '@/lib/firebaseAdmin'
import { sincronizarDatosCuenta } from '@/lib/datosCuentaServer'
import { validarWhatsappBoliviano, numeroLocalABolivia } from '@/lib/validarWhatsapp'

export const dynamic = 'force-dynamic'

// PATCH { pausado: boolean }, { esPrueba: boolean } o { accion } — solo admin.
// accion 'verificar': da por verificado el email (no le llegó el código).
// esPrueba marca/desmarca la cuenta de prueba (custom claim en Firebase
// Auth; ver src/lib/cuentasPrueba.ts). Pausar bloquea el login del
// usuario en Firebase Auth (no puede volver a entrar hasta que se lo
// reactive); NO borra ni oculta sus productos o perfiles profesionales,
// que siguen visibles en el catálogo tal cual estaban.
export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const authAdmin = getAuthAdmin()
    // Link nuevo para que elija/cambie su contraseña (vence a la hora,
    // por eso se genera recién al momento de mandarlo).
    // Editar los datos de la cuenta: email (queda verificado, lo cambia
    // el admin), nombre, WhatsApp y nombre de la tienda.
    // Poner / cambiar la contraseña de cualquier usuario (por ejemplo, a
    // alguien que no recibe el mail de recuperación). La anterior deja
    // de servir en el momento.
    if (body.accion === 'password') {
      const nueva = String(body.password || '')
      if (nueva.length < 6) return NextResponse.json({ error: 'La contraseña tiene que tener al menos 6 caracteres.' }, { status: 400 })
      if (nueva.length > 100) return NextResponse.json({ error: 'La contraseña es demasiado larga.' }, { status: 400 })
      await authAdmin.updateUser(params.uid, { password: nueva })
      return NextResponse.json({ ok: true })
    }
    if (body.accion === 'editar') {
      const u = await authAdmin.getUser(params.uid)
      const db = getDb()
      const email = String(body.email ?? u.email ?? '').trim().toLowerCase()
      const nombre = String(body.nombre ?? '').trim().slice(0, 80)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Poné un email válido.' }, { status: 400 })
      }
      let whatsapp: string | undefined
      if (typeof body.whatsapp === 'string') {
        const w = body.whatsapp.trim()
        if (w) {
          const v = validarWhatsappBoliviano(w)
          if (!v.valido) return NextResponse.json({ error: v.motivo }, { status: 400 })
          whatsapp = numeroLocalABolivia(w)
        } else whatsapp = ''
      }
      const emailCambio = email !== (u.email || '').toLowerCase()
      try {
        await authAdmin.updateUser(params.uid, {
          ...(emailCambio ? { email, emailVerified: true } : {}),
          displayName: nombre || null,
        })
      } catch (err: any) {
        if (err?.code === 'auth/email-already-exists') {
          return NextResponse.json({ error: 'Ese email ya lo usa otra cuenta.' }, { status: 409 })
        }
        throw err
      }
      await db.collection('usuarios').doc(params.uid).set(
        { nombre, ...(whatsapp !== undefined ? { whatsapp } : {}), updatedAt: new Date().toISOString() },
        { merge: true }
      )
      const vRef = db.collection('vendedores').doc(params.uid)
      const vDoc = await vRef.get()
      const tiendaNombre = typeof body.nombreNegocio === 'string' ? body.nombreNegocio.trim().slice(0, 80) : undefined
      const cambiosTienda: Record<string, any> = {}
      if (tiendaNombre !== undefined && tiendaNombre !== (vDoc.data()?.nombreNegocio || '')) cambiosTienda.nombreNegocio = tiendaNombre
      if (whatsapp !== undefined && whatsapp !== (vDoc.data()?.whatsapp || '')) {
        cambiosTienda.whatsapp = whatsapp
        cambiosTienda.whatsappPais = whatsapp ? 'BO' : ''
      }
      if (Object.keys(cambiosTienda).length && (vDoc.exists || cambiosTienda.nombreNegocio)) {
        await vRef.set({ ...cambiosTienda, email, updatedAt: new Date().toISOString() }, { merge: true })
      }
      await sincronizarDatosCuenta(params.uid, {
        email: emailCambio ? email : null,
        ...(cambiosTienda.nombreNegocio !== undefined ? { tiendaNombre: cambiosTienda.nombreNegocio } : {}),
      })
      return NextResponse.json({ ok: true, email })
    }
    // Verificar a mano a alguien al que no le llegó el código de 6 dígitos.
    if (body.accion === 'verificar') {
      await getDb().collection('usuarios').doc(params.uid).set({ emailVerificado: true, codigoVerificacion: null, codigoExpiraEn: null, verificadoPorAdmin: true }, { merge: true })
      await authAdmin.updateUser(params.uid, { emailVerified: true }).catch(() => {})
      return NextResponse.json({ ok: true })
    }
    if (body.accion === 'link') {
      const u = await authAdmin.getUser(params.uid)
      if (!u.email) return NextResponse.json({ error: 'Ese usuario no tiene email.' }, { status: 400 })
      return NextResponse.json({ link: await linkParaElegirContrasena(u.email) })
    }
    // "Entrar como" este usuario para cargarle productos: token de un
    // solo uso con la marca cargaAdmin (queda en cada producto que se
    // publique en esa sesión como cargadoPorAdmin).
    if (body.accion === 'ingresar') {
      const u = await authAdmin.getUser(params.uid)
      if (u.disabled) return NextResponse.json({ error: 'El usuario está pausado. Reactivalo primero.' }, { status: 400 })
      const token = await authAdmin.createCustomToken(params.uid, { cargaAdmin: true })
      return NextResponse.json({ token, email: u.email || null })
    }
    if (typeof body.esPrueba === 'boolean') {
      const actual = (await authAdmin.getUser(params.uid)).customClaims || {}
      await authAdmin.setCustomUserClaims(params.uid, { ...actual, esPrueba: body.esPrueba })
      return NextResponse.json({ ok: true })
    }
    await authAdmin.updateUser(params.uid, { disabled: !!body.pausado })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/admin/usuarios/[uid]', err)
    if (err?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Ese usuario ya no existe.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo actualizar el usuario.' }, { status: 500 })
  }
}

// DELETE: solo admin — borra la cuenta de Firebase Auth. Ojo: esto NO
// borra en cascada sus productos ni perfiles profesionales (quedan
// huérfanos, con un vendedorId/solicitanteUid que ya no existe); si
// también querés sacarlos del catálogo, hacelo aparte desde las
// pestañas de Productos/Servicios antes o después de borrar la cuenta.
export async function DELETE(req: NextRequest, { params }: { params: { uid: string } }) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    await getAuthAdmin().deleteUser(params.uid)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/admin/usuarios/[uid]', err)
    if (err?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Ese usuario ya no existe.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo eliminar el usuario.' }, { status: 500 })
  }
}
