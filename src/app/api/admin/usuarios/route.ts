import { NextRequest, NextResponse } from 'next/server'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { validarWhatsappBoliviano, numeroLocalABolivia } from '@/lib/validarWhatsapp'
import { linkParaElegirContrasena } from '@/lib/linkContrasena'

export const dynamic = 'force-dynamic'

// GET: solo admin — lista los usuarios de Firebase Auth, cruzados con
// cuántos productos y perfiles profesionales tiene publicados cada uno
// (así el panel puede mostrar "de qué vive" cada usuario sin que el
// admin tenga que ir a buscarlo a mano en las otras pestañas).
// listUsers pagina de a 1000 — mismo límite que contarUsuarios(); si la
// base crece más que eso, hay que encadenar con el nextPageToken.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const [listaAuth, db] = [await getAuthAdmin().listUsers(1000), getDb()]

    // Traemos solo los campos que necesitamos para contar (no el
    // documento entero) — vendedorId/solicitanteUid identifican al
    // dueño de cada producto/perfil profesional.
    const [productosSnap, profesionalesSnap, creadosSnap] = await Promise.all([
      db.collection('productos').select('vendedorId').get(),
      db.collection('profesionales').select('solicitanteUid').get(),
      db.collection('usuarios').where('creadoPorAdmin', '==', true).select('whatsapp').get(),
    ])
    // Cuentas creadas desde el admin: guardamos su WhatsApp para poder
    // mandarle el link de acceso.
    const creadosPorAdmin = new Map<string, string>()
    creadosSnap.docs.forEach((doc) => creadosPorAdmin.set(doc.id, doc.data().whatsapp || ''))

    const conteoProductos = new Map<string, number>()
    productosSnap.docs.forEach((doc) => {
      const uid = doc.data().vendedorId
      if (uid) conteoProductos.set(uid, (conteoProductos.get(uid) || 0) + 1)
    })
    const conteoProfesionales = new Map<string, number>()
    profesionalesSnap.docs.forEach((doc) => {
      const uid = doc.data().solicitanteUid
      if (uid) conteoProfesionales.set(uid, (conteoProfesionales.get(uid) || 0) + 1)
    })

    const usuarios = listaAuth.users.map((u) => ({
      uid: u.uid,
      email: u.email || null,
      nombre: u.displayName || null,
      pausado: u.disabled,
      esPrueba: u.customClaims?.esPrueba === true,
      creadoEl: u.metadata.creationTime,
      ultimoLogin: u.metadata.lastSignInTime || null,
      productosCount: conteoProductos.get(u.uid) || 0,
      profesionalesCount: conteoProfesionales.get(u.uid) || 0,
      creadoPorAdmin: creadosPorAdmin.has(u.uid),
      whatsapp: creadosPorAdmin.get(u.uid) || null,
    }))

    // Los más recientes primero.
    usuarios.sort((a, b) => (b.creadoEl || '').localeCompare(a.creadoEl || ''))

    return NextResponse.json({ usuarios })
  } catch (err) {
    console.error('GET /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo cargar la lista de usuarios.' }, { status: 500 })
  }
}

// POST: solo admin — crea una cuenta nueva (sin contraseña: la persona
// la elige con el link que devolvemos, que el admin le manda por
// WhatsApp). Opcionalmente le arma la tienda (nombre + WhatsApp) para
// que el admin pueda cargarle productos enseguida.
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const nombre = String(body.nombre || '').trim().slice(0, 80)
    const nombreNegocio = String(body.nombreNegocio || '').trim().slice(0, 80)
    const whatsappLocal = String(body.whatsapp || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Poné un email válido.' }, { status: 400 })
    }
    let whatsapp = ''
    if (whatsappLocal) {
      const v = validarWhatsappBoliviano(whatsappLocal)
      if (!v.valido) return NextResponse.json({ error: v.motivo }, { status: 400 })
      whatsapp = numeroLocalABolivia(whatsappLocal)
    }

    const authAdmin = getAuthAdmin()
    let uid: string
    try {
      // emailVerified: lo da de alta el admin, que ya habló con la
      // persona — no le pedimos el código de verificación.
      const creado = await authAdmin.createUser({ email, emailVerified: true, ...(nombre ? { displayName: nombre } : {}) })
      uid = creado.uid
    } catch (err: any) {
      if (err?.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Ya existe una cuenta con ese email. Buscala en la lista de usuarios.' }, { status: 409 })
      }
      throw err
    }

    const db = getDb()
    const ahora = new Date().toISOString()
    await db.collection('usuarios').doc(uid).set(
      { email, nombre, whatsapp, emailVerificado: true, creadoPorAdmin: true, createdAt: ahora },
      { merge: true }
    )
    if (nombreNegocio || whatsapp) {
      await db.collection('vendedores').doc(uid).set(
        { nombreNegocio, whatsapp, whatsappPais: whatsapp ? 'BO' : '', email, creadoPorAdmin: true, updatedAt: ahora },
        { merge: true }
      )
    }

    const link = await linkParaElegirContrasena(email)
    return NextResponse.json({ uid, email, whatsapp, link })
  } catch (err) {
    console.error('POST /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 })
  }
}
