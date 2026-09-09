'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { esPremiumVigente, PRECIO_PREMIUM_BS, MAX_FOTOS_ADICIONALES_PREMIUM } from '@/lib/planPremium'

const QR_PLATAFORMA = process.env.NEXT_PUBLIC_QR_IMAGE_URL || ''
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME || ''
const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || ''
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || ''

type Profesional = {
  id: string
  nombre: string
  rubro: string
  estado?: string
  notaAdmin?: string
  plan?: string
  planVigenciaHasta?: string | null
  planEstadoPago?: string
  vistas?: number
  clicsWhatsapp?: number
  fotosAdicionales?: string[]
  imagenUrl?: string
}

const ESTADO_INFO: Record<string, { label: string; color: string; detalle: string }> = {
  pendiente_revision: {
    label: 'En revisión',
    color: 'text-ochre',
    detalle: 'Estamos revisando tu solicitud. En cuanto la aprobemos, tu servicio aparece en el directorio.',
  },
  info_solicitada: {
    label: 'Necesitamos algo más de vos',
    color: 'text-indigo-600',
    detalle: 'Te vamos a contactar por WhatsApp por algo puntual de tu solicitud.',
  },
  rechazado: {
    label: 'No aprobada',
    color: 'text-maroon',
    detalle: 'Esta solicitud no fue aprobada. Si creés que fue un error, escribinos.',
  },
}

export default function MiPerfilPage() {
  const { usuario, cargando: authCargando, obtenerToken } = useAuth()
  const router = useRouter()

  const [profesional, setProfesional] = useState<Profesional | null | undefined>(undefined) // undefined = todavía cargando
  const [error, setError] = useState('')
  const [pagando, setPagando] = useState(false)
  const [declarando, setDeclarando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  useEffect(() => {
    if (!authCargando && !usuario) router.push('/login')
  }, [authCargando, usuario, router])

  useEffect(() => {
    if (!usuario) return
    cargarPerfil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function cargarPerfil() {
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/profesionales/mio', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfesional(data.profesional)
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar tu perfil.')
      setProfesional(null)
    }
  }

  async function declararPago() {
    if (!profesional) return
    setDeclarando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}/declarar-pago-premium`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await cargarPerfil()
      setPagando(false)
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar el aviso de pago.')
    } finally {
      setDeclarando(false)
    }
  }

  async function subirFoto(file: File | null) {
    if (!file || !profesional) return
    setSubiendoFoto(true)
    setError('')
    try {
      const token = await obtenerToken()
      const formData = new FormData()
      formData.append('image', file)
      const resUpload = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const dataUpload = await resUpload.json()
      if (dataUpload.error) throw new Error(dataUpload.error)

      const resGaleria = await fetch(`/api/profesionales/${profesional.id}/galeria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: dataUpload.url }),
      })
      const dataGaleria = await resGaleria.json()
      if (dataGaleria.error) throw new Error(dataGaleria.error)
      setProfesional((p) => (p ? { ...p, fotosAdicionales: dataGaleria.fotosAdicionales } : p))
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir la foto.')
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function borrarFoto(url: string) {
    if (!profesional) return
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}/galeria`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfesional((p) => (p ? { ...p, fotosAdicionales: data.fotosAdicionales } : p))
    } catch (e: any) {
      setError(e?.message || 'No se pudo borrar la foto.')
    }
  }

  if (authCargando || profesional === undefined) {
    return <div className="max-w-[560px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  if (!profesional) {
    return (
      <div className="max-w-[560px] mx-auto px-5 py-16 text-center">
        <div className="font-display text-lg font-bold text-ink mb-2">Todavía no publicaste ningún servicio</div>
        <p className="font-body text-sm text-inksoft mb-5">
          Publicá tu servicio profesional y desde acá vas a poder gestionar tu membresía y tus fotos.
        </p>
        <Link href="/publicar-servicio" className="inline-block px-5 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold">
          Publicar mi servicio
        </Link>
      </div>
    )
  }

  const premiumVigente = esPremiumVigente(profesional)
  const estadoInfo = profesional.estado && profesional.estado !== 'aprobado' ? ESTADO_INFO[profesional.estado] : null

  return (
    <div className="max-w-[560px] mx-auto px-5 py-8">
      <div className="font-display text-xl font-bold text-ink mb-1">Mi perfil de servicio</div>
      <div className="font-body text-sm text-inksoft mb-6">{profesional.nombre}</div>

      {error && (
        <div className="bg-maroon/10 border border-maroon rounded-lg p-3 mb-5 font-body text-xs text-maroon">{error}</div>
      )}

      {estadoInfo && (
        <div className="bg-panel border border-line rounded-xl p-4 mb-5">
          <div className={`font-body text-sm font-semibold ${estadoInfo.color} mb-1`}>{estadoInfo.label}</div>
          <div className="font-body text-xs text-inksoft">{estadoInfo.detalle}</div>
          {profesional.estado === 'info_solicitada' && profesional.notaAdmin && (
            <div className="mt-2 font-body text-xs text-ink bg-panelalt rounded-md px-2.5 py-2">📝 {profesional.notaAdmin}</div>
          )}
        </div>
      )}

      {/* --- Membresía --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        {premiumVigente ? (
          <>
            <div className="font-body text-sm font-semibold text-ochre mb-1">✨ Premium activo</div>
            <div className="font-body text-xs text-inksoft mb-3">
              Vigente hasta el {new Date(profesional.planVigenciaHasta!).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </>
        ) : (
          <>
            <div className="font-body text-sm font-semibold text-ink mb-1">Plan Básico</div>
            <ul className="font-body text-xs text-inksoft mb-3 list-disc pl-4 space-y-0.5">
              <li>Aparecés primero en el listado de /servicios</li>
              <li>Badge &quot;Destacado&quot; en tu tarjeta</li>
              <li>Hasta {MAX_FOTOS_ADICIONALES_PREMIUM} fotos adicionales en tu perfil</li>
              <li>Tus propias estadísticas de vistas y contactos</li>
            </ul>
          </>
        )}

        {profesional.planEstadoPago === 'informado_pago' ? (
          <div className="font-body text-xs text-ochre bg-ochresoft rounded-md px-3 py-2">
            Avisaste que ya pagaste — estamos confirmando tu pago, te queda activo en cuanto lo revisemos.
          </div>
        ) : pagando ? (
          <div className="text-center pt-2">
            {QR_PLATAFORMA ? (
              <img src={QR_PLATAFORMA} alt="Código QR de pago" className="mx-auto w-44 rounded-lg border border-line mb-3" />
            ) : (
              <div className="text-left bg-panelalt border border-line rounded-lg p-3 font-body text-xs text-ink mb-3">
                {BANK_ACCOUNT_NUMBER ? <div><strong>Cuenta / CBU:</strong> {BANK_ACCOUNT_NUMBER}</div> : null}
                {BANK_NAME && <div><strong>Banco:</strong> {BANK_NAME}</div>}
                {BANK_ACCOUNT_NAME && <div><strong>Titular:</strong> {BANK_ACCOUNT_NAME}</div>}
              </div>
            )}
            <div className="font-display text-xl font-bold text-ink mb-3">Bs {PRECIO_PREMIUM_BS}</div>
            <button
              onClick={declararPago}
              disabled={declarando}
              className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
            >
              {declarando ? 'Guardando...' : 'Ya pagué'}
            </button>
            <button
              onClick={() => setPagando(false)}
              className="w-full mt-2 py-2 rounded-lg border border-line font-body text-xs text-inksoft"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPagando(true)}
            className="w-full py-2.5 rounded-lg border-none bg-ochre text-white font-body text-sm font-semibold"
          >
            {premiumVigente ? `Renovar ahora — Bs ${PRECIO_PREMIUM_BS}/mes` : `Hacerme Premium — Bs ${PRECIO_PREMIUM_BS}/mes`}
          </button>
        )}
      </div>

      {/* --- Estadísticas (beneficio Premium) --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="font-body text-sm font-semibold text-ink mb-3">Estadísticas</div>
        {premiumVigente ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-panelalt rounded-lg p-3">
              <div className="font-body text-[11px] text-inksoft mb-0.5">Vistas de tu perfil</div>
              <div className="font-display text-xl font-bold text-ink">{profesional.vistas || 0}</div>
            </div>
            <div className="bg-panelalt rounded-lg p-3">
              <div className="font-body text-[11px] text-inksoft mb-0.5">Contactos por WhatsApp</div>
              <div className="font-display text-xl font-bold text-ink">{profesional.clicsWhatsapp || 0}</div>
            </div>
          </div>
        ) : (
          <div className="font-body text-xs text-inksoft">
            Ver cuánta gente te vio y te contactó es un beneficio Premium.
          </div>
        )}
      </div>

      {/* --- Galería de fotos (beneficio Premium) --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="font-body text-sm font-semibold text-ink mb-3">Fotos de tu perfil</div>
        {premiumVigente ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(profesional.fotosAdicionales || []).map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-line">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => borrarFoto(url)}
                    className="absolute top-1 right-1 bg-black/60 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center border-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {(profesional.fotosAdicionales || []).length < MAX_FOTOS_ADICIONALES_PREMIUM ? (
              <label className="block text-center py-2.5 rounded-lg border border-dashed border-line font-body text-xs text-inksoft cursor-pointer">
                {subiendoFoto ? 'Subiendo...' : `+ Agregar foto (${(profesional.fotosAdicionales || []).length}/${MAX_FOTOS_ADICIONALES_PREMIUM})`}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={subiendoFoto}
                  onChange={(e) => subirFoto(e.target.files?.[0] || null)}
                />
              </label>
            ) : (
              <div className="font-body text-[11px] text-inksoft text-center">Llegaste al máximo de fotos adicionales.</div>
            )}
          </>
        ) : (
          <div className="font-body text-xs text-inksoft">
            Con Premium podés agregar hasta {MAX_FOTOS_ADICIONALES_PREMIUM} fotos más a tu perfil, además de la principal.
          </div>
        )}
      </div>

      <Link href={`/servicios/${profesional.id}`} className="block text-center font-body text-xs text-inksoft underline">
        Ver mi perfil público
      </Link>
    </div>
  )
}
