'use client'

import { useState } from 'react'

// Panel de "marketing" reutilizable: un link a una página propia
// (producto, tienda, o perfil de servicio) más botones para
// promocionarla en Facebook, WhatsApp e Instagram.
//
// Instagram a propósito NO tiene un botón de "compartir" como Facebook
// o WhatsApp: a diferencia de esos dos, Instagram no ofrece ninguna URL
// pública para prellenar una publicación o historia desde la web (es
// una limitación de Instagram, no algo que se pueda resolver del lado
// del sitio) — por eso ahí se le da el link ya copiado y la imagen para
// descargar, para que lo suba a mano desde el celular.
export function Compartir({ url, titulo, imagenUrl }: { url: string; titulo: string; imagenUrl?: string }) {
  const [copiado, setCopiado] = useState(false)

  function copiarLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const textoCompartir = `Mirá esto en Clasi Click: ${titulo}`
  const linkFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(`${textoCompartir} ${url}`)}`

  return (
    <div className="bg-panelalt border border-line rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <input
          readOnly
          value={url}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-line bg-panel font-body text-[11px] text-inksoft"
        />
        <button
          type="button"
          onClick={copiarLink}
          className="shrink-0 px-2.5 py-1.5 rounded-md border border-line font-body text-[11px] font-semibold text-ink"
        >
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={linkFacebook}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-md border-none bg-[#1877F2] text-white font-body text-[11px] font-semibold"
        >
          Facebook
        </a>
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-[11px] font-semibold"
        >
          WhatsApp
        </a>
        {imagenUrl && (
          <a
            href={imagenUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md border border-line font-body text-[11px] font-semibold text-ink"
          >
            ⬇ Descargar foto
          </a>
        )}
      </div>
      <div className="font-body text-[10px] text-inksoft mt-2">
        Instagram no deja prellenar una publicación desde acá — copiá el link {imagenUrl && 'y descargá la foto '}para subirlo a una historia o post a mano.
      </div>
    </div>
  )
}
