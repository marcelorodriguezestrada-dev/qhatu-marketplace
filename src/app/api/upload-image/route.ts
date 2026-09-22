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
    const thumb = formData.get('thumb') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 })
    }

    async function uploadToImgbb(f: File) {
      const arrayBuffer = await f.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const uploadBody = new URLSearchParams()
      const key = process.env.IMGBB_API_KEY as string
      uploadBody.append('key', key)
      uploadBody.append('image', base64)
      const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: uploadBody,
      })
      const data = await imgbbRes.json()
      if (!data.success) throw new Error(data.error?.message || 'ImgBB rechazó la imagen.')
      // `url` es el link directo al archivo (lo que usa <img src>).
      // `url_viewer` es la página de ImgBB con metadatos Open Graph —
      // WhatsApp (y redes en general) arman la vista previa leyendo esa
      // página, no el archivo directo, así que la guardamos aparte para
      // los mensajes de WhatsApp (ver /checkout).
      return { url: data.data.url as string, urlViewer: (data.data.url_viewer as string) || null }
    }

    // Subir la imagen principal
    const principal = await uploadToImgbb(file)
    // Si recibimos thumb, subirlo también (no es obligatorio)
    let thumbUrl: string | null = null
    if (thumb) {
      try {
        thumbUrl = (await uploadToImgbb(thumb)).url
      } catch (err) {
        console.warn('Thumb upload failed', err)
        thumbUrl = null
      }
    }

    return NextResponse.json({ url: principal.url, urlViewer: principal.urlViewer, thumbUrl })
  } catch (err: any) {
    console.error('POST /api/upload-image', err)
    return NextResponse.json({ error: err.message || 'Error desconocido subiendo la imagen.' }, { status: 500 })
  }
}
