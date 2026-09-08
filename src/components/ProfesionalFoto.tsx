'use client'

import { useState } from 'react'
import { ServiceIcon } from './ServiceIcon'

// Mismo patrón que ProductCard: si la imagen no existe o falla al cargar
// (link roto, borrada, etc.), cae al ícono en vez de mostrar un hueco roto.
// loading="lazy" + decoding="async" para que no frene la carga de la página
// esperando fotos que todavía no están a la vista.
export function ProfesionalFoto({
  imagenUrl,
  nombre,
  icono,
  size = 40,
  className = '',
}: {
  imagenUrl?: string
  nombre: string
  icono: string
  size?: number
  className?: string
}) {
  const [imagenRota, setImagenRota] = useState(false)
  const mostrarFoto = imagenUrl && !imagenRota

  return mostrarFoto ? (
    <img
      src={imagenUrl}
      alt={nombre}
      loading="lazy"
      decoding="async"
      className={`w-full h-full object-cover ${className}`}
      onError={() => setImagenRota(true)}
    />
  ) : (
    <ServiceIcon kind={icono} size={size} />
  )
}
