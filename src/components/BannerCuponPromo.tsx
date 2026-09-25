'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { guardarCuponPendiente } from '@/lib/cupones'

type CuponDestacado = { codigo: string; campana: string; tipo: string; descripcion: string; hasta: string }

// Banner del cupón destacado (Admin → Cupones → "Mostrar como banner").
// Lo ve todo el mundo, con o sin sesión:
//  - sin sesión → "Iniciá sesión para usarlo": guarda el código y lo
//    manda al login, que después lo devuelve a esta misma página.
//  - con sesión → "Usar cupón": guarda el código y el checkout lo
//    aplica solo al pagar.
export default function BannerCuponPromo() {
  const { usuario, cargando } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [cupon, setCupon] = useState<CuponDestacado | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    fetch('/api/cupones/destacado')
      .then((r) => r.json())
      .then((d) => setCupon(d.cupon || null))
      .catch(() => {})
  }, [])

  if (!cupon || cargando) return null

  function usar() {
    if (!cupon) return
    guardarCuponPendiente(cupon.codigo)
    if (!usuario) {
      router.push(`/login?volver=${encodeURIComponent(pathname || '/')}`)
      return
    }
    setGuardado(true)
  }

  const emoji = cupon.tipo === 'envio_gratis' ? '🚚' : '🎁'
  const hasta = cupon.hasta ? ` · hasta el ${cupon.hasta.split('-').reverse().join('/')}` : ''

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-tealsoft border border-teal rounded-xl px-4 py-3 mb-5">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
        <div className="min-w-0">
          <div className="font-body text-sm font-semibold text-ink">
            {cupon.campana ? `${cupon.campana}: ` : ''}{cupon.descripcion}
          </div>
          <div className="font-body text-xs text-inksoft">
            Con el cupón <span className="font-semibold text-teal tracking-wide">{cupon.codigo}</span>{hasta}
          </div>
        </div>
      </div>
      {guardado ? (
        <div className="font-body text-xs font-semibold text-teal sm:text-right">✓ Listo, se aplica solo al pagar</div>
      ) : (
        <button
          type="button"
          onClick={usar}
          className="shrink-0 px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold"
        >
          {usuario ? 'Usar cupón' : 'Iniciá sesión para usarlo'}
        </button>
      )}
    </div>
  )
}
