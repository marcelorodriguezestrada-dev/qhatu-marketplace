import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'

// Sube una imagen a ImgBB (servicio gratuito de hosting de imágenes) y
// devuelve la URL pública resultante. Acepta dos formas de autenticarse:
// - Un usuario logueado (Firebase Auth) — así lo usan los vendedores
//   desde /vender.
// - La contraseña de administrador — así lo usa el panel /admin al
//   subir la foto de un profesional (ese panel no tiene login de
//   Firebase, usa su propio sistema de contraseña).
// Sin uno de los dos, cualquiera podría usar tu cuenta de ImgBB como
// hosting gratuito para lo que sea.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  const passwordAdmin = req.headers.get('x-admin-password')
  const esAdmin = passwordAdmin && passwordAdmin === process.env.ADMIN_PASSWORD

  if (!usuario && !esAdmin) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para subir una imagen.' }, { status: 401 })
  }

  try {
    if (!process.env.IMGBB_API_KEY) {
      return NextResponse.json({ error: 'Falta configurar IMGBB_API_KEY en el servidor.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const uploadBody = new URLSearchParams()
    uploadBody.append('key', process.env.IMGBB_API_KEY)
    uploadBody.append('image', base64)

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: uploadBody,
    })
    const data = await imgbbRes.json()

    if (!data.success) {
      return NextResponse.json({ error: data.error?.message || 'ImgBB rechazó la imagen.' }, { status: 500 })
    }

    return NextResponse.json({ url: data.data.url })
  } catch (err: any) {
    console.error('POST /api/upload-image', err)
    return NextResponse.json({ error: err.message || 'Error desconocido subiendo la imagen.' }, { status: 500 })
  }
}
