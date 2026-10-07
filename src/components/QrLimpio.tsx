'use client'

import { useEffect, useState } from 'react'

// QR de cobro "limpio": el QR que sube el vendedor o el admin suele ser la
// captura de la app del banco (logo de Yape/banco, "Válido hasta…"). Acá
// se lee el código de la imagen (jsQR) y se vuelve a dibujar solo el QR,
// grande y en blanco y negro (sirve igual para pagar: es el mismo dato).
// Si no se puede leer, se muestra la imagen original.
async function leerQr(url: string): Promise<string | null> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const { default: jsQR } = await import('jsqr')
  // Probamos con varios tamaños (los QR chicos en fotos grandes se leen mejor achicados).
  for (const max of [1200, 800, 500]) {
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * escala)
    const h = Math.round(img.naturalHeight * escala)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const datos = ctx.getImageData(0, 0, w, h)
    const r = jsQR(datos.data, w, h, { inversionAttempts: 'attemptBoth' })
    if (r?.data) return r.data
  }
  return null
}

export default function QrLimpio({ url, nombreArchivo = 'qr-pago.png' }: { url: string; nombreArchivo?: string }) {
  const [limpio, setLimpio] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let vivo = true
    setLimpio(null)
    setListo(false)
    ;(async () => {
      try {
        const dato = await leerQr(url)
        if (dato) {
          const QRCode = (await import('qrcode')).default
          const png = await QRCode.toDataURL(dato, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
          if (vivo) setLimpio(png)
        }
      } catch {
        // CORS o imagen ilegible: queda la original.
      } finally {
        if (vivo) setListo(true)
      }
    })()
    return () => { vivo = false }
  }, [url])

  const src = limpio || url
  return (
    <>
      {listo ? (
        <img src={src} alt="Código QR de pago" className={`mx-auto rounded-lg border border-line mt-2 ${limpio ? 'w-56 bg-white' : 'w-48'}`} />
      ) : (
        <div className="mx-auto w-56 h-56 rounded-lg border border-line bg-panelalt mt-2 flex items-center justify-center font-body text-xs text-inksoft">Cargando QR…</div>
      )}
      <a
        href={src}
        download={limpio ? nombreArchivo : 'qr-pago.jpg'}
        target={limpio ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 mt-3 w-full py-3 rounded-lg border-2 border-teal text-teal bg-tealsoft font-body text-sm font-bold no-underline"
      >
        ⬇ Descargar QR
      </a>
    </>
  )
}
