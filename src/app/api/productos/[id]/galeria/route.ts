import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { esPremiumVigente, MAX_FOTOS_ADICIONALES_PREMIUM } from '@/lib/planPremium'

export const dynamic = 'force-dynamic'

// A diferencia de la galería de profesionales (donde el Premium vive en
// el mismo documento que se está editando), acá el Premium vive en
// `vendedores/{uid}` — un vendedor con varios productos paga UNA sola
// membresía y desbloquea la galería extra en TODOS sus productos.
//
// Ojo: esto reemplaza a una versión anterior de este archivo que
// chequeaba `producto.plan === 'premium'` — ese campo es el que el
// propio vendedor tilda gratis al publicar (solo afecta el orden en el
// catálogo), no tiene ningún pago real detrás. Dejar que ESO desbloqueé
// las fotos extra hubiera sido un beneficio "Premium" que cualquiera
// activa gratis con un click. Ahora se chequea la membresía paga real.
async function verificarDueñoPremium(productoRef: FirebaseFirestore.DocumentReference, uid: string) {
  const doc = await productoRef.get()
  if (!doc.exists) return { error: 'Producto no encontrado.', status: 404 as const }
  const data = doc.data()!
  if (data.vendedorId !== uid) return { error: 'Este producto no te pertenece.', status: 403 as const }

  const vendedorDoc = await getDb().collection('vendedores').doc(uid).get()
  if (!esPremiumVigente(vendedorDoc.data() || {})) {
    return { error: 'La galería de fotos extra es un beneficio Premium de tu membresía de vendedor. Activala primero.', status: 403 as const }
  }
  return { data }
}

// POST { url: string } — agrega una foto a la galería del producto.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const ref = getDb().collection('productos').doc(params.id)
    const chequeo = await verificarDueñoPremium(ref, usuario.uid)
    if ('error' in chequeo) return NextResponse.json({ error: chequeo.error }, { status: chequeo.status })

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Falta la URL de la imagen.' }, { status: 400 })

    const actuales: string[] = chequeo.data.fotosAdicionales || []
    if (actuales.length >= MAX_FOTOS_ADICIONALES_PREMIUM) {
      return NextResponse.json({ error: `Máximo ${MAX_FOTOS_ADICIONALES_PREMIUM} fotos adicionales por producto.` }, { status: 400 })
    }

    const nuevas = [...actuales, url]
    await ref.update({ fotosAdicionales: nuevas })
    return NextResponse.json({ fotosAdicionales: nuevas })
  } catch (err: any) {
    console.error('POST /api/productos/[id]/galeria', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}

// DELETE { url: string } — saca una foto puntual.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const ref = getDb().collection('productos').doc(params.id)
    const chequeo = await verificarDueñoPremium(ref, usuario.uid)
    if ('error' in chequeo) return NextResponse.json({ error: chequeo.error }, { status: chequeo.status })

    const { url } = await req.json()
    const actuales: string[] = chequeo.data.fotosAdicionales || []
    const nuevas = actuales.filter((f) => f !== url)
    await ref.update({ fotosAdicionales: nuevas })
    return NextResponse.json({ fotosAdicionales: nuevas })
  } catch (err: any) {
    console.error('DELETE /api/productos/[id]/galeria', err)
    return NextResponse.json({ error: err.message || 'Error desconocido.' }, { status: 500 })
  }
}
