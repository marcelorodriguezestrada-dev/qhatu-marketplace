'use client'

// Achica una foto en el navegador (más rápido de subir y más liviana) y
// la sube a ImgBB por /api/upload-image con la contraseña de admin.

export async function achicarFoto(file: File, max = 1000): Promise<File> {
  try {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(file)
    await new Promise((r, rej) => { img.onload = r; img.onerror = rej })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(img.src)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8))
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file
  } catch {
    return file // ej: HEIC en un navegador que no lo abre: se sube tal cual
  }
}

export async function subirFotoAdmin(password: string, file: File, conMiniatura = true): Promise<{ url: string; thumbUrl: string; urlViewer?: string }> {
  const fd = new FormData()
  fd.append('image', await achicarFoto(file))
  if (conMiniatura) fd.append('thumb', await achicarFoto(file, 300))
  const d = await fetch('/api/upload-image', { method: 'POST', headers: { 'x-admin-password': password }, body: fd }).then((r) => r.json())
  if (!d.url) throw new Error(d.error || 'No se pudo subir la foto.')
  return { url: d.url, thumbUrl: d.thumbUrl || d.url, urlViewer: d.urlViewer || undefined }
}
