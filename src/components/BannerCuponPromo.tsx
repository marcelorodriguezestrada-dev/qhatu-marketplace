'use client'

import { useEffect, useState } from 'react'

type CuponDestacado = { codigo: string; campana: string; tipo: string; descripcion: string; hasta: string; vence?: string }

// Banner del cupón destacado (Admin → Cupones → "Mostrar como banner").
// Solo informa el código y hasta cuándo vale — sin botón: el cupón se
// usa en el checkout, escribiéndolo o tocándolo en "Cupones disponibles".
export default function BannerCuponPromo() {
  const [cupon, setCupon] = useState<CuponDestacado | null>(null)

  useEffect(() => {
    fetch('/api/cupones/destacado')
      .then((r) => r.json())
      .then((d) => setCupon(d.cupon || null))
      .catch(() => {})
  }, [])

  if (!cupon) return null

  const emoji = cupon.tipo === 'envio_gratis' ? '🚚' : '🎁'
  const vence = cupon.vence || (cupon.hasta ? cupon.hasta.split('-').reverse().join('/') : '')

  return (
    <div className="flex items-start gap-3 bg-tealsoft border border-teal rounded-xl px-4 py-3 mb-5">
      <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
      <div className="min-w-0">
        <div className="font-body text-sm font-semibold text-ink">
          {cupon.campana ? `${cupon.campana}: ` : ''}{cupon.descripcion}
        </div>
        <div className="font-body text-xs text-inksoft">
          Para {cupon.tipo === 'envio_gratis' ? 'el envío gratis' : 'el descuento'} use el código:{' '}
          <span className="font-semibold text-teal tracking-wide">{cupon.codigo}</span>
          {vence && <>, válido hasta el {vence}</>}
        </div>
      </div>
    </div>
  )
}
