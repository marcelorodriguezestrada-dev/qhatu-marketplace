'use client'

import { useEffect, useState } from 'react'

type Banner = {
  id: string
  imagenUrl: string
  link?: string | null
}

// Se muestra en la home cuando estás en "🏠" (sin filtro de
// Mujer/Hombre/Niños) — se administra desde /admin → pestaña Banners.
// Si no hay ninguno cargado todavía, no renderiza nada (no deja un
// hueco vacío raro en la página).
export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])

  useEffect(() => {
    fetch('/api/banners')
      .then((r) => r.json())
      .then((data) => setBanners(data.banners || []))
      .catch(() => {})
  }, [])

  if (banners.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-5 pb-1">
      {banners.map((b) =>
        b.link ? (
          <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer" className="shrink-0 w-[85%] sm:w-[48%] rounded-xl overflow-hidden">
            <img src={b.imagenUrl} alt="Promoción" loading="lazy" className="w-full h-36 sm:h-44 object-cover" />
          </a>
        ) : (
          <div key={b.id} className="shrink-0 w-[85%] sm:w-[48%] rounded-xl overflow-hidden">
            <img src={b.imagenUrl} alt="Promoción" loading="lazy" className="w-full h-36 sm:h-44 object-cover" />
          </div>
        )
      )}
    </div>
  )
}
