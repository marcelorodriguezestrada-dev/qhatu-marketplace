import { NextRequest, NextResponse } from 'next/server'
import { getDb, listarUsuarios, pausarUsuario, borrarUsuarioAuth } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

function esAdmin(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  return !!password && password === process.env.ADMIN_PASSWORD
}

// GET — lista de usuarios de Firebase Auth, con sus productos y
// servicios publicados al lado de cada uno (mismo tipo de vista que ya
// tenés para moderar productos/servicios, pero agrupado por persona).
export async function GET(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  try {
    const db = getDb()
    const [usuarios, productosSnap, profesionalesSnap, vendedoresSnap] = await Promise.all([
      listarUsuarios(),
      db.collection('productos').get(),
      db.collection('profesionales').get(),
      db.collection('vendedores').get(),
    ])

    const productos = productosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const profesionales = profesionalesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const vendedoresPorUid = new Map(vendedoresSnap.docs.map((d) => [d.id, d.data() as any]))

    const resultado = usuarios.map((u) => ({
      ...u,
      productos: productos
        .filter((p) => p.vendedorId === u.uid)
        .map((p) => ({ id: p.id, nombre: p.nombre, estado: p.estado || 'activo' })),
      servicios: profesionales
        .filter((p) => p.solicitanteUid === u.uid)
        .map((p) => ({ id: p.id, nombre: p.nombre, estado: p.estado || 'aprobado' })),
      tienda: vendedoresPorUid.get(u.uid)
        ? { nombreNegocio: vendedoresPorUid.get(u.uid).nombreNegocio || '', plan: vendedoresPorUid.get(u.uid).plan || 'basico' }
        : null,
    }))

    return NextResponse.json({ usuarios: resultado })
  } catch (err) {
    console.error('GET /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo cargar la lista de usuarios.' }, { status: 500 })
  }
}

// PATCH { uid, pausado: boolean } — pausar/reactivar sin borrar nada.
export async function PATCH(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  try {
    const { uid, pausado } = await req.json()
    if (!uid || typeof pausado !== 'boolean') {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
    }
    await pausarUsuario(uid, pausado)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo actualizar el usuario.' }, { status: 500 })
  }
}

// DELETE ?uid=X — borra la cuenta de Firebase Auth (no puede volver a
// entrar nunca más) y oculta lo que había publicado: sus productos
// pasan a "oculto" y sus servicios a "rechazado". A propósito NO se
// borran esos documentos de Firestore — así, si fue un error, el admin
// puede reactivarlos a mano después; y si había pedidos con ese
// vendedorId, no quedan rotos apuntando a un producto que no existe.
export async function DELETE(req: NextRequest) {
  if (!esAdmin(req)) return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'Falta uid.' }, { status: 400 })

  try {
    const db = getDb()

    const [productosSnap, profesionalesSnap] = await Promise.all([
      db.collection('productos').where('vendedorId', '==', uid).get(),
      db.collection('profesionales').where('solicitanteUid', '==', uid).get(),
    ])

    const batch = db.batch()
    for (const doc of productosSnap.docs) batch.update(doc.ref, { estado: 'oculto' })
    for (const doc of profesionalesSnap.docs) batch.update(doc.ref, { estado: 'rechazado' })
    await batch.commit()

    await borrarUsuarioAuth(uid)

    return NextResponse.json({ ok: true, productosOcultados: productosSnap.size, serviciosOcultados: profesionalesSnap.size })
  } catch (err) {
    console.error('DELETE /api/admin/usuarios', err)
    return NextResponse.json({ error: 'No se pudo eliminar el usuario.' }, { status: 500 })
  }
}
