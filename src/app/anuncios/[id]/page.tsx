'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { labelTipoAnuncio } from '@/data/anuncios'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export default function AnuncioDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [anuncio, setAnuncio] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/anuncios/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setNoEncontrado(true); return }
        setAnuncio(data)
      })
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) {
    return <div className="max-w-[560px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  if (noEncontrado || !anuncio) {
    return (
      <div className="max-w-[560px] mx-auto px-5 py-16 text-center">
        <div className="font-body text-sm text-inksoft mb-4">Este anuncio no existe o ya no está disponible.</div>
        <Link href="/anuncios" className="font-body text-sm text-maroon underline">Volver a anuncios</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] mx-auto px-5 py-8">
      <Link href="/anuncios" className="font-body text-[13px] text-inksoft mb-5 inline-block">← Volver a anuncios</Link>

      {anuncio.imagenUrl && (
        <img src={anuncio.imagenUrl} alt={anuncio.titulo} className="w-full aspect-square object-cover rounded-xl border border-line mb-4" />
      )}

      <div className="font-body text-[11px] font-semibold text-maroon uppercase tracking-wide mb-1">
        {labelTipoAnuncio(anuncio.tipo)}
      </div>
      <div className="font-display text-xl font-bold text-ink mb-2">{anuncio.titulo}</div>
      {anuncio.precio && <div className="font-body text-lg font-bold text-ink mb-3">{bs(anuncio.precio)}</div>}
      <p className="font-body text-sm text-ink mb-5 whitespace-pre-wrap">{anuncio.descripcion}</p>

      <a
        href={`https://wa.me/${(anuncio.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola! Te escribo por tu anuncio "${anuncio.titulo}" en Clasi Click.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center w-full py-3 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold"
      >
        💬 Contactar
      </a>
    </div>
  )
}
