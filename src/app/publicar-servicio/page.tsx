'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RUBROS } from '@/components/ServiceIcon'
import { ZONAS_POTOSI } from '@/data/zonasPotosi'
import { useAuth } from '@/lib/auth'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'

export default function PublicarServicioPage() {
  const { usuario, cargando, obtenerToken } = useAuth()
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState(RUBROS[0].id)
  const [rubroPersonalizado, setRubroPersonalizado] = useState('')
  const [rubrosExtra, setRubrosExtra] = useState<{ id: string; label: string }[]>([])
  const [descripcion, setDescripcion] = useState('')
  const [zona, setZona] = useState(ZONAS_POTOSI[0])
  const [zonaPersonalizada, setZonaPersonalizada] = useState('')
  const [zonasExtra, setZonasExtra] = useState<string[]>([])
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  // Categorías y zonas que otros usuarios ya agregaron a mano —
  // se suman a la lista base para que no haga falta reescribirlas.
  useEffect(() => {
    fetch('/api/rubros-personalizados')
      .then((r) => r.json())
      .then((d) => setRubrosExtra(d.rubros || []))
      .catch(() => {})
    fetch('/api/zonas-personalizadas')
      .then((r) => r.json())
      .then((d) => setZonasExtra(d.zonas || []))
      .catch(() => {})
  }, [])

  // Dar de alta un servicio requiere estar logueado — así se evita que
  // cualquiera publique perfiles falsos sin ninguna cuenta detrás.
  useEffect(() => {
    if (!cargando && !usuario) router.push('/login')
  }, [cargando, usuario, router])

  function usarMiUbicacion() {
    setBuscandoUbicacion(true)
    setError('')
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.')
      setBuscandoUbicacion(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setBuscandoUbicacion(false)
      },
      () => {
        setError('No pudimos acceder a tu ubicación. Revisá los permisos del navegador.')
        setBuscandoUbicacion(false)
      }
    )
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('Completá tu nombre o el de tu negocio.')
      return
    }
    if (rubro === 'otro' && !rubroPersonalizado.trim()) {
      setError('Escribí el nombre de tu categoría.')
      return
    }
    if (zona === 'otra' && !zonaPersonalizada.trim()) {
      setError('Escribí el nombre de tu zona.')
      return
    }
    const validacion = validarWhatsappBoliviano(whatsapp)
    if (!validacion.valido) {
      setError(validacion.motivo || 'Revisá tu número de WhatsApp.')
      return
    }
    setEnviando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/profesionales/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre, rubro, rubroPersonalizado, descripcion, zona, zonaPersonalizada, whatsapp, instagram, precio, experiencia,
          lat: ubicacion?.lat ?? null,
          lng: ubicacion?.lng ?? null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setEnviado(true)
    } finally {
      setEnviando(false)
    }
  }

  if (cargando || !usuario) {
    return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  if (enviado) {
    return (
      <div className="max-w-[480px] mx-auto px-5 py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-tealsoft text-teal flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        <div className="font-display text-xl font-bold text-ink mb-2">Solicitud recibida</div>
        <p className="font-body text-sm text-inksoft mb-6">
          La vamos a revisar y, si todo está en orden, tu perfil va a aparecer publicado en el directorio de servicios en los próximos días. Te contactamos por WhatsApp si necesitamos algo más.
        </p>
        <Link href="/servicios" className="font-body text-sm text-maroon underline">Ver el directorio de servicios</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[480px] mx-auto px-5 py-10">
      <div className="font-display text-xl font-bold text-ink mb-1">Publicá tu servicio en Clasi Click</div>
      <p className="font-body text-sm text-inksoft mb-6">
        Completá tus datos. Un administrador va a revisar la solicitud antes de que tu perfil quede visible en el directorio.
      </p>

      <form onSubmit={enviar} className="bg-panel border border-line rounded-xl p-5">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre o el de tu negocio"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3 bg-panel"
        >
          {RUBROS.filter((r) => r.id !== 'otro').map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
          {rubrosExtra.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
          <option value="otro">Otra categoría (especificar)</option>
        </select>
        {rubro === 'otro' && (
          <input
            value={rubroPersonalizado}
            onChange={(e) => setRubroPersonalizado(e.target.value)}
            placeholder="¿Cuál es tu categoría? (ej: Jardinero)"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
        )}
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Contanos de qué se trata tu servicio"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <select
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3 bg-panel"
        >
          {ZONAS_POTOSI.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
          {zonasExtra.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
          <option value="otra">Otra zona (especificar)</option>
        </select>
        {zona === 'otra' && (
          <input
            value={zonaPersonalizada}
            onChange={(e) => setZonaPersonalizada(e.target.value)}
            placeholder="¿Cuál es tu zona/barrio?"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
        )}

        <div className="mb-3">
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={buscandoUbicacion}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm text-ink bg-panelalt"
          >
            📍 {buscandoUbicacion ? 'Buscando tu ubicación...' : ubicacion ? 'Ubicación capturada ✓' : 'Usar mi ubicación actual'}
          </button>
          <div className="font-body text-[11px] text-inksoft mt-1.5">
            Opcional, pero así aparecés en el mapa de "más cercanos" del directorio.
          </div>
        </div>

        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Tu WhatsApp (ej: 71234567, sin +591)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="Instagram u otra red social (opcional)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            type="number"
            placeholder="Precio en Bs (opcional)"
            className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
          <input
            value={experiencia}
            onChange={(e) => setExperiencia(e.target.value)}
            placeholder="Experiencia (ej: 10 años)"
            className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
        </div>
        <div className="font-body text-[11px] text-inksoft mb-4">
          La foto de tu perfil se agrega después de la revisión — nos contactamos por WhatsApp para coordinarla.
        </div>
        {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
        >
          {enviando ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  )
}
