import { NextRequest, NextResponse } from 'next/server'
import { estaVerificada } from '@/lib/verificacion'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'
import { esClaveAdmin } from '@/lib/adminAuth'
import { crearUsuarioAdmin, ErrorAlta } from '@/lib/crearUsuarioAdmin'

export const dynamic = 'force-dynamic'

// GET: solo admin — lista los usuarios de Firebase Auth, cruzados con
// cuántos productos y perfiles profesionales tiene publicados cada uno
// (así el panel puede mostrar "de qué vive" cada usuario sin que el
// admin tenga que ir a buscarlo a mano en las otras pestañas).
// listUsers pagina de a 1000 — mismo límite que contarUsuarios(); si la
// base crece más que eso, hay que encadenar con el nextPageToken.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!(await esClaveAdmin(password))) {
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
      db.collection('usuarios').select('whatsapp', 'celular', 'creadoPorAdmin', 'emailVerificado', 'ciudadAsignada').get(),
    ])
    // WhatsApp (para mandar el link de acceso / editar sus datos) y si la
    // cuenta la creó el admin.
    const datosUsuario = new Map<string, { whatsapp: string; celular: string; creadoPorAdmin: boolean; emailVerificado: boolean; ciudadAsignada: string | null }>()
    creadosSnap.docs.forEach((doc) => datosUsuario.set(doc.id, { whatsapp: doc.data().whatsapp || '', celular: doc.data().celular || '', creadoPorAdmin: doc.data().creadoPorAdmin === true, emailVerificado: doc.data().emailVerificado === true, ciudadAsignada: doc.data().ciudadAsignada || null }))

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
      creadoPorAdmin: datosUsuario.get(u.uid)?.creadoPorAdmin === true,
      whatsapp: datosUsuario.get(u.uid)?.whatsapp || null,
      // Celular que dejó al registrarse (para escribirle si no le llega el código).
      celular: datosUsuario.get(u.uid)?.celular || null,
      verificado: estaVerificada(u, datosUsuario.get(u.uid)),
      conGoogle: u.providerData.some((p) => p.providerId === 'google.com'),
      ciudadAsignada: datosUsuario.get(u.uid)?.ciudadAsignada || null,
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
  if (!(await esClaveAdmin(password))) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }
  try {
    const { uid, email, whatsapp, link } = await crearUsuarioAdmin(await req.json())
    return NextResponse.json({ uid, email, whatsapp, link })
  } catch (err) {
    if (err instanceof ErrorAlta) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('POST /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 })
  }
}
