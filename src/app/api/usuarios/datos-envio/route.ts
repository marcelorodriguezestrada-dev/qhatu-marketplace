import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// Guarda los datos que el comprador ya tipeó una vez en /checkout
// (nombre, WhatsApp, barrio, dirección, entre calles), para no
// hacérselos escribir de nuevo en la próxima compra. Van dentro de
// `usuarios/{uid}.datosEnvio` — un campo aparte del resto del
// documento (celular, emailVerificado, etc.), porque es información
// que el comprador puede querer cambiar de compra en compra (por
// ejemplo si manda un pedido a otra dirección) sin que eso afecte nada
// más de la cuenta.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    const doc = await db.collection('usuarios').doc(usuario.uid).get()
    const datosEnvio = doc.data()?.datosEnvio || null
    return NextResponse.json({ datosEnvio })
  } catch (err) {
    console.error('GET /api/usuarios/datos-envio', err)
    return NextResponse.json({ datosEnvio: null })
  }
}

// Se llama sola desde /checkout apenas se crea el pedido — no es una
// acción que el comprador dispare a mano, así que no hace falta
// devolverle un error bloqueante si falla: la compra ya se hizo, esto
// es solo para la próxima vez.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const { nombreComprador, whatsappComprador, zonaEntrega, direccion, entreCalles } = await req.json()
    // Solo pisamos los campos que vinieron con algo cargado — con
    // retiro en tienda, por ejemplo, no hay barrio/dirección/entre
    // calles, y no tiene sentido borrar esos datos guardados de una
    // compra anterior con envío solo porque esta vez no se usaron.
    const campos: Record<string, string> = { nombreComprador, whatsappComprador, zonaEntrega, direccion, entreCalles }
    const datosEnvio: Record<string, string> = {}
    for (const [clave, valor] of Object.entries(campos)) {
      if (typeof valor === 'string' && valor.trim()) datosEnvio[clave] = valor
    }
    if (Object.keys(datosEnvio).length === 0) return NextResponse.json({ ok: true })

    // merge:true en el SDK de admin mezcla los mapas anidados campo por
    // campo (no reemplaza `datosEnvio` entero) — así que esto solo pisa
    // las claves que vinieron con algo cargado.
    const db = getDb()
    await db.collection('usuarios').doc(usuario.uid).set({ datosEnvio }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/usuarios/datos-envio', err)
    return NextResponse.json({ error: 'No se pudieron guardar los datos.' }, { status: 500 })
  }
}
