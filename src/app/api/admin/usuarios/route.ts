import { NextRequest, NextResponse } from 'next/server'
import { getDb, getAuthAdmin } from '@/lib/firebaseAdmin'

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
    const [productosSnap, profesionalesSnap] = await Promise.all([
      db.collection('productos').select('vendedorId').get(),
      db.collection('profesionales').select('solicitanteUid').get(),
    ])

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
      creadoEl: u.metadata.creationTime,
      ultimoLogin: u.metadata.lastSignInTime || null,
      productosCount: conteoProductos.get(u.uid) || 0,
      profesionalesCount: conteoProfesionales.get(u.uid) || 0,
    }))

    // Los más recientes primero.
    usuarios.sort((a, b) => (b.creadoEl || '').localeCompare(a.creadoEl || ''))

    return NextResponse.json({ usuarios })
  } catch (err) {
    console.error('GET /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo cargar la lista de usuarios.' }, { status: 500 })
  }
}
