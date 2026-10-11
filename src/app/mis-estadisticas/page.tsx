'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import EstadisticasUsuario, { type PestanaEstadisticas } from '@/components/EstadisticasUsuario'

// /mis-estadisticas — las estadísticas de todo lo que publicó el usuario
// (productos, servicios y anuncios). ?ver=servicios abre esa pestaña.
export default function MisEstadisticasPage() {
  return (
    <Suspense fallback={null}>
      <MisEstadisticas />
    </Suspense>
  )
}

function MisEstadisticas() {
  const { usuario, cargando } = useAuth()
  const router = useRouter()
  const ver = useSearchParams().get('ver')
  const inicial = (['productos', 'servicios', 'anuncios'] as const).find((p) => p === ver) as PestanaEstadisticas | undefined

  useEffect(() => {
    if (!cargando && !usuario) router.push('/login')
  }, [cargando, usuario, router])

  if (cargando || !usuario) {
    return <div className="max-w-[760px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  return (
    <div className="max-w-[760px] mx-auto px-4 py-6">
      <div className="font-display text-xl font-bold text-ink mb-1">📊 Mis estadísticas</div>
      <p className="font-body text-xs text-inksoft mb-4">Cuánta gente mira lo que publicaste, te escribe y te compra.</p>
      <EstadisticasUsuario inicial={inicial} />
    </div>
  )
}
