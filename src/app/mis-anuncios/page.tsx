'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { labelTipoAnuncio } from '@/data/anuncios'

const ESTADO_INFO: Record<string, { label: string; color: string; detalle: string }> = {
  pendiente_revision: {
    label: 'En revisión',
    color: 'text-ochre',
    detalle: 'Lo estamos revisando. En cuanto lo aprobemos, se publica y avisamos a los profesionales del rubro.',
  },
  info_solicitada: {
    label: 'Necesitamos algo más',
    color: 'text-indigo-600',
    detalle: 'Te vamos a contactar por WhatsApp por algo puntual.',
  },
  rechazado: {
    label: 'No aprobado',
    color: 'text-maroon',
    detalle: 'Este anuncio no fue aprobado. Si creés que fue un error, escribinos.',
  },
  aprobado: {
    label: 'Publicado',
    color: 'text-teal',
    detalle: 'Ya está visible en /anuncios.',
  },
}

export default function MisAnunciosPage() {
  const { usuario, cargando: authCargando, obtenerToken } = useAuth()
  const router = useRouter()

  const [anuncios, setAnuncios] = useState<any[] | undefined>(undefined) // undefined = cargando
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authCargando && !usuario) router.push('/login')
  }, [authCargando, usuario, router])

  useEffect(() => {
    if (!usuario) return
    cargarAnuncios()
    // Lista pública de profesionales aprobados — se usa para armar,
    // por cada anuncio de tipo "Busco X", quiénes podrían resolverlo
    // (mismo rubro). Se trae una sola vez para todos los anuncios.
    fetch('/api/profesionales')
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function cargarAnuncios() {
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/anuncios/mios', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnuncios(data.anuncios || [])
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar tus anuncios.')
      setAnuncios([])
    }
  }

  function linkWhatsappProfesional(p: any) {
    const texto = `Hola! Vi tu perfil en Clasi Click, necesito ayuda con algo de tu rubro.`
    return `https://wa.me/${(p.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
  }

  if (authCargando || anuncios === undefined) {
    return <div className="max-w-[560px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  if (anuncios.length === 0) {
    return (
      <div className="max-w-[560px] mx-auto px-5 py-16 text-center">
        <div className="font-display text-lg font-bold text-ink mb-2">Todavía no publicaste ningún anuncio</div>
        <p className="font-body text-sm text-inksoft mb-5">
          Publicá un "Busco X" y te mostramos acá mismo qué profesionales del rubro podrían ayudarte.
        </p>
        <Link href="/publicar-anuncio" className="inline-block px-5 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold">
          Publicar un anuncio
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] mx-auto px-5 py-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-display text-xl font-bold text-ink">Mis anuncios</div>
        <Link href="/publicar-anuncio" className="font-body text-xs text-maroon underline shrink-0 mt-1">+ Nuevo</Link>
      </div>
      <div className="mb-5" />

      {error && (
        <div className="bg-maroon/10 border border-maroon rounded-lg p-3 mb-5 font-body text-xs text-maroon">{error}</div>
      )}

      <div className="flex flex-col gap-4">
        {anuncios.map((a) => {
          const estadoInfo = ESTADO_INFO[a.estado] || ESTADO_INFO.pendiente_revision
          // Solo tiene sentido sugerir "posibles solucionadores" para un
          // "Busco X" que ya está publicado — antes de aprobarse, todavía
          // no le avisamos a nadie, así que mostrar la lista sería
          // prometer un contacto que no pasó.
          const sugeridos =
            a.tipo === 'busqueda' && a.estado === 'aprobado' && a.rubro
              ? profesionales.filter((p) => p.rubro === a.rubro)
              : []

          return (
            <div key={a.id} className="bg-panel border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-body text-[10px] font-semibold text-maroon uppercase tracking-wide">
                  {labelTipoAnuncio(a.tipo)}
                </div>
                <div className={`font-body text-[11px] font-semibold ${estadoInfo.color}`}>{estadoInfo.label}</div>
              </div>
              <div className="font-display text-base font-bold text-ink mb-1">{a.titulo}</div>
              <div className="font-body text-xs text-inksoft mb-2">{estadoInfo.detalle}</div>
              {a.estado === 'info_solicitada' && a.notaAdmin && (
                <div className="font-body text-xs text-ink bg-panelalt rounded-md px-2.5 py-2 mb-2">📝 {a.notaAdmin}</div>
              )}

              {a.tipo === 'busqueda' && a.estado === 'aprobado' && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="font-body text-xs font-semibold text-ink mb-2">
                    {sugeridos.length > 0 ? 'Profesionales que podrían ayudarte' : 'Todavía no hay ningún profesional de ese rubro'}
                  </div>
                  {sugeridos.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {sugeridos.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 bg-panelalt rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <Link href={`/servicios/${p.id}`} className="font-body text-sm text-ink font-medium truncate hover:underline">
                              {p.nombre}
                            </Link>
                          </div>
                          <a
                            href={linkWhatsappProfesional(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 px-3 py-1.5 rounded-md bg-teal text-white font-body text-[11px] font-semibold"
                          >
                            💬 Contactar
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
