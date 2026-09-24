'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { esPremiumVigente, PRECIO_PREMIUM_BS, MAX_FOTOS_ADICIONALES_PREMIUM } from '@/lib/planPremium'
import { NotificacionesBell } from '@/components/NotificacionesBell'
import { DIAS_SEMANA, HorarioProfesional, HORARIO_VACIO, INTERVALOS_TURNO, BloqueHorario } from '@/data/turnos'
import { extraerTextoDeArchivo } from '@/lib/leerArchivoTexto'
import EditorCV, { PuestoBorrador, aBorradores, deBorradores } from '@/components/EditorCV'
import type { PuestoLaboral, Idioma } from '@/lib/cvEstandar'

const QR_PLATAFORMA = process.env.NEXT_PUBLIC_QR_IMAGE_URL || ''
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME || ''
const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || ''
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || ''

type Profesional = {
  id: string
  nombre: string
  rubro: string
  especialidad?: string
  descripcion?: string
  dondeTrabaja?: string
  educacion?: string
  experiencia?: string
  servicios?: string[]
  historialLaboral?: PuestoLaboral[]
  idiomas?: Idioma[]
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

  // --- Mis turnos (beneficio Premium) ---
  const [horario, setHorario] = useState<HorarioProfesional>(HORARIO_VACIO)
  const [nuevoBloqueDias, setNuevoBloqueDias] = useState<number[]>([])
  const [nuevoBloqueDesde, setNuevoBloqueDesde] = useState('09:00')
  const [nuevoBloqueHasta, setNuevoBloqueHasta] = useState('18:00')
  const [nuevoBloqueIntervalo, setNuevoBloqueIntervalo] = useState(60)
  const [nuevoBloqueTodoElDia, setNuevoBloqueTodoElDia] = useState(false)
  const [guardandoHorario, setGuardandoHorario] = useState(false)
  const [horarioGuardado, setHorarioGuardado] = useState(false)
  const [turnos, setTurnos] = useState<any[]>([])
  const [cargandoTurnos, setCargandoTurnos] = useState(false)
  const [mandandoRecordatorioId, setMandandoRecordatorioId] = useState<string | null>(null)

  // --- Oportunidades: anuncios "Busco X" que coinciden con mi rubro ---
  // Mismo criterio que ya usa el macheo automático por mail/notificación
  // (mismo id de rubro) — esto es la versión "lista siempre visible en
  // mi perfil" de lo mismo, con un botón directo para contactar.
  const [oportunidades, setOportunidades] = useState<any[]>([])
  const [cargandoOportunidades, setCargandoOportunidades] = useState(false)

  // --- Armar mi presentación a partir del CV ---
  // Flujo: subís el archivo → lo leemos en el navegador (PDF o
  // foto/escaneo) → la IA propone nombre/especialidad/experiencia/
  // descripción → vos revisás y editás la propuesta acá mismo → recién
  // al tocar "Guardar" se escribe en tu perfil. Nunca se guarda solo.
  const [leyendoCV, setLeyendoCV] = useState(false)
  const [errorCV, setErrorCV] = useState('')
  const [propuestaCV, setPropuestaCV] = useState<{ nombre: string; especialidad: string; experiencia: string; descripcion: string; servicios: string[]; dondeTrabaja?: string; rubroSugerido?: string | null; historialLaboral?: PuestoLaboral[] } | null>(null)
  const [guardandoCV, setGuardandoCV] = useState(false)
  const [cvGuardado, setCvGuardado] = useState(false)

  // --- Mis servicios (qué hago concretamente) ---
  // Editable directo, sin pasar por el flujo de CV — así cualquier
  // profesional lo puede completar aunque no suba ningún CV.
  const [misServicios, setMisServicios] = useState<string[]>([])
  const [nuevoServicio, setNuevoServicio] = useState('')
  const [miDondeTrabaja, setMiDondeTrabaja] = useState('')
  const [miEducacion, setMiEducacion] = useState('')
  const [guardandoServicios, setGuardandoServicios] = useState(false)
  const [serviciosGuardados, setServiciosGuardados] = useState(false)
  const [errorServicios, setErrorServicios] = useState('')

  // --- Mi CV (historial laboral + idiomas) ---
  // Con esto y el resto del perfil se arma el CV estandarizado en
  // /servicios/[id]/cv — pensado sobre todo para quien no tiene un CV
  // propio: carga sus puestos acá (con ayuda de la IA para redactar) y
  // ese pasa a ser su CV oficial, descargable en PDF.
  const [miHistorial, setMiHistorial] = useState<PuestoBorrador[]>([])
  const [misIdiomas, setMisIdiomas] = useState<Idioma[]>([])
  const [guardandoMiCV, setGuardandoMiCV] = useState(false)
  const [miCVGuardado, setMiCVGuardado] = useState(false)
  const [errorMiCV, setErrorMiCV] = useState('')

  useEffect(() => {
    if (!authCargando && !usuario) router.push('/login')
  }, [authCargando, usuario, router])

  useEffect(() => {
    if (!usuario) return
    cargarPerfil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  useEffect(() => {
    if (profesional) {
      setMisServicios(profesional.servicios || [])
      setMiDondeTrabaja(profesional.dondeTrabaja || '')
      setMiEducacion(profesional.educacion || '')
      setMiHistorial(aBorradores(profesional.historialLaboral))
      setMisIdiomas(profesional.idiomas || [])
    }
  }, [profesional?.id])

  useEffect(() => {
    if (!profesional || !esPremiumVigente(profesional)) return
    fetch(`/api/profesionales/${profesional.id}/horarios`)
      .then((r) => r.json())
      .then((data) => setHorario({ bloques: data.bloques || [] }))
    cargarTurnos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesional?.id, profesional?.plan, profesional?.planVigenciaHasta])

  useEffect(() => {
    if (!profesional?.rubro) return
    setCargandoOportunidades(true)
    fetch('/api/anuncios')
      .then((r) => r.json())
      .then((data) => {
        const anuncios = (data.anuncios || []) as any[]
        setOportunidades(
          anuncios.filter((a) => a.tipo === 'busqueda' && a.rubro === profesional.rubro)
        )
      })
      .finally(() => setCargandoOportunidades(false))
  }, [profesional?.rubro])

  function linkWhatsappOportunidad(a: any) {
    const texto = `Hola! Vi que buscabas "${a.titulo}" en Clasi Click — te puedo ayudar con eso.`
    return `https://wa.me/${(a.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
  }

  async function cargarTurnos() {
    if (!profesional) return
    setCargandoTurnos(true)
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/turnos?profesionalId=${profesional.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setTurnos(data.turnos || [])
    } finally {
      setCargandoTurnos(false)
    }
  }

  function linkWhatsappRecordatorio(t: any) {
    const texto = `Hola ${t.nombre}! Te escribo para recordarte tu turno de mañana ${t.diaLabel} a las ${t.hora}. ¿Seguís confirmado?`
    return `https://wa.me/${(t.contacto || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
  }

  async function mandarRecordatorioMail(t: any) {
    setMandandoRecordatorioId(t.id)
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/turnos/${t.id}/recordatorio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setTurnos((prev) => prev.map((x) => (x.id === t.id ? { ...x, recordatorioEnviado: true, recordatorioEnviadoEn: data.recordatorioEnviadoEn } : x)))
    } finally {
      setMandandoRecordatorioId(null)
    }
  }

  function toggleDiaNuevoBloque(diaId: number) {
    setNuevoBloqueDias((dias) => (dias.includes(diaId) ? dias.filter((d) => d !== diaId) : [...dias, diaId].sort()))
  }

  function agregarBloque() {
    if (nuevoBloqueDias.length === 0) return
    const desde = nuevoBloqueTodoElDia ? '00:00' : nuevoBloqueDesde
    const hasta = nuevoBloqueTodoElDia ? '23:30' : nuevoBloqueHasta
    if (hasta <= desde) return
    const nuevo: BloqueHorario = {
      id: `b${Date.now()}`,
      dias: nuevoBloqueDias,
      desde,
      hasta,
      intervaloMin: nuevoBloqueIntervalo,
    }
    setHorario((h) => ({ bloques: [...h.bloques, nuevo] }))
    setNuevoBloqueDias([])
    setNuevoBloqueTodoElDia(false)
  }

  function quitarBloque(id: string) {
    setHorario((h) => ({ bloques: h.bloques.filter((b) => b.id !== id) }))
  }

  async function guardarHorario() {
    if (!profesional) return
    setGuardandoHorario(true)
    setHorarioGuardado(false)
    setError('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}/horarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(horario),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHorarioGuardado(true)
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar tu horario.')
    } finally {
      setGuardandoHorario(false)
    }
  }

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

  async function subirCV(file: File | null) {
    if (!file || !profesional) return
    setErrorCV('')
    setCvGuardado(false)
    setPropuestaCV(null)
    setLeyendoCV(true)
    try {
      const { texto } = await extraerTextoDeArchivo(file)
      if (!texto || texto.trim().length < 30) {
        throw new Error('No pudimos leer suficiente texto de ese archivo. Probá con un PDF con texto real o una foto más clara y derecha.')
      }
      const token = await obtenerToken()
      const res = await fetch('/api/profesionales/extraer-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texto }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPropuestaCV(data.datos)
      // "Dónde trabajo" se edita y guarda en su propia caja (más abajo,
      // junto con los servicios) — la precargamos ahí directo si el CV
      // trajo algo, así la persona no tiene que escribirla de nuevo,
      // pero la revisa y la guarda desde esa misma caja como siempre.
      if (data.datos?.dondeTrabaja) setMiDondeTrabaja(data.datos.dondeTrabaja)
      if (data.datos?.educacion) setMiEducacion(data.datos.educacion)
      // Lo mismo con el historial laboral e idiomas: se precargan en
      // "Mi CV" y se guardan desde esa caja, después de revisarlos.
      if (data.datos?.historialLaboral?.length > 0) {
        setMiHistorial(aBorradores(data.datos.historialLaboral))
        setMiCVGuardado(false)
      }
      if (data.datos?.idiomas?.length > 0) setMisIdiomas(data.datos.idiomas)
    } catch (e: any) {
      setErrorCV(e?.message || 'No se pudo leer el CV.')
    } finally {
      setLeyendoCV(false)
    }
  }

  async function guardarPropuestaCV() {
    if (!profesional || !propuestaCV) return
    setGuardandoCV(true)
    setErrorCV('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: propuestaCV.nombre,
          especialidad: propuestaCV.especialidad,
          experiencia: propuestaCV.experiencia,
          descripcion: propuestaCV.descripcion,
          servicios: propuestaCV.servicios,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfesional((p) =>
        p
          ? { ...p, nombre: propuestaCV.nombre || p.nombre, especialidad: propuestaCV.especialidad, experiencia: propuestaCV.experiencia, descripcion: propuestaCV.descripcion, servicios: propuestaCV.servicios }
          : p
      )
      setMisServicios(propuestaCV.servicios || [])
      setPropuestaCV(null)
      setCvGuardado(true)
    } catch (e: any) {
      setErrorCV(e?.message || 'No se pudo guardar los cambios.')
    } finally {
      setGuardandoCV(false)
    }
  }

  // Lista de servicios concretos que ofrece (ej: "Instalación de
  // grifería", "Reparación de fugas") — hasta 6, saneado otra vez del
  // lado del servidor igual que cualquier campo de texto libre.
  function agregarMiServicio() {
    const texto = nuevoServicio.trim()
    if (!texto || misServicios.length >= 6) return
    if (misServicios.some((s) => s.toLowerCase() === texto.toLowerCase())) {
      setNuevoServicio('')
      return
    }
    setMisServicios((s) => [...s, texto.slice(0, 80)])
    setNuevoServicio('')
  }

  function quitarMiServicio(i: number) {
    setMisServicios((s) => s.filter((_, idx) => idx !== i))
  }

  async function guardarMisServicios() {
    if (!profesional) return
    setGuardandoServicios(true)
    setServiciosGuardados(false)
    setErrorServicios('')
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ servicios: misServicios, dondeTrabaja: miDondeTrabaja, educacion: miEducacion }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfesional((p) => (p ? { ...p, servicios: misServicios, dondeTrabaja: miDondeTrabaja, educacion: miEducacion } : p))
      setServiciosGuardados(true)
    } catch (e: any) {
      setErrorServicios(e?.message || 'No se pudo guardar tus servicios.')
    } finally {
      setGuardandoServicios(false)
    }
  }

  async function guardarMiCV() {
    if (!profesional) return
    setGuardandoMiCV(true)
    setMiCVGuardado(false)
    setErrorMiCV('')
    try {
      const historialLaboral = deBorradores(miHistorial)
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${profesional.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ historialLaboral, idiomas: misIdiomas }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProfesional((p) => (p ? { ...p, historialLaboral, idiomas: misIdiomas } : p))
      setMiCVGuardado(true)
    } catch (e: any) {
      setErrorMiCV(e?.message || 'No se pudo guardar tu CV.')
    } finally {
      setGuardandoMiCV(false)
    }
  }

  async function mejorarPuestoConIA(p: PuestoBorrador) {
    const token = await obtenerToken()
    const res = await fetch('/api/profesionales/mejorar-puesto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cargo: p.cargo, empresa: p.empresa, texto: p.logrosTexto, especialidad: profesional?.especialidad }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data as { logros: string[]; stack: string[] }
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
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="font-display text-xl font-bold text-ink">Mi perfil de servicio</div>
          <div className="font-body text-sm text-inksoft">{profesional.nombre}</div>
        </div>
        <NotificacionesBell />
      </div>
      <div className="mb-5" />

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

      {/* --- Armar mi presentación a partir del CV --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="font-body text-sm font-semibold text-ink mb-1">Armá tu presentación con tu CV</div>
        <div className="font-body text-xs text-inksoft mb-3">
          Subí tu CV (PDF, Word .docx o una foto/escaneo) y una IA arma una propuesta de nombre, especialidad, experiencia y descripción para tu perfil. Vos la revisás, la editás si querés, y recién ahí se guarda — no se publica nada sola.
        </div>

        {errorCV && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-3">{errorCV}</div>}
        {cvGuardado && <div className="font-body text-xs text-teal bg-teal/10 border border-teal rounded-md px-3 py-2 mb-3">Guardado ✓ — tu perfil ya se actualizó.</div>}

        {!propuestaCV && (
          <label className="block text-center py-2.5 rounded-lg border border-dashed border-line font-body text-xs text-inksoft cursor-pointer">
            {leyendoCV ? 'Leyendo tu CV...' : '📄 Subir mi CV (PDF, Word o foto)'}
            <input
              type="file"
              accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/*"
              className="hidden"
              disabled={leyendoCV}
              onChange={(e) => subirCV(e.target.files?.[0] || null)}
            />
          </label>
        )}

        {propuestaCV && (
          <div className="bg-panelalt rounded-lg p-3">
            <div className="font-body text-xs font-semibold text-ink mb-2">Revisá la propuesta antes de guardar</div>

            <div className="font-body text-[11px] text-inksoft mb-1">Nombre</div>
            <input
              value={propuestaCV.nombre}
              onChange={(e) => setPropuestaCV((p) => (p ? { ...p, nombre: e.target.value } : p))}
              className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2.5"
            />

            <div className="font-body text-[11px] text-inksoft mb-1">Especialidad</div>
            <input
              value={propuestaCV.especialidad}
              onChange={(e) => setPropuestaCV((p) => (p ? { ...p, especialidad: e.target.value } : p))}
              className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2.5"
            />

            <div className="font-body text-[11px] text-inksoft mb-1">Experiencia</div>
            <input
              value={propuestaCV.experiencia}
              onChange={(e) => setPropuestaCV((p) => (p ? { ...p, experiencia: e.target.value } : p))}
              className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2.5"
            />

            <div className="font-body text-[11px] text-inksoft mb-1">Descripción</div>
            <textarea
              value={propuestaCV.descripcion}
              onChange={(e) => setPropuestaCV((p) => (p ? { ...p, descripcion: e.target.value } : p))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2.5"
            />

            <div className="font-body text-[11px] text-inksoft mb-1">Servicios (qué hacés concretamente)</div>
            {propuestaCV.servicios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {propuestaCV.servicios.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panel border border-line font-body text-xs text-ink">
                    {s}
                    <button
                      type="button"
                      onClick={() => setPropuestaCV((p) => (p ? { ...p, servicios: p.servicios.filter((_, idx) => idx !== i) } : p))}
                      className="text-inksoft hover:text-maroon leading-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="font-body text-[11px] text-inksoft mb-2.5">
              Los propuso la IA a partir de tu CV — sacá los que no correspondan.
            </div>

            {propuestaCV.dondeTrabaja && (
              <div className="font-body text-[11px] text-inksoft mb-2.5">
                💡 También precargamos "Dónde trabajo" con lo que encontramos en tu CV, más abajo en "Mis servicios y dónde trabajo" — revisalo ahí antes de guardarlo.
              </div>
            )}

            {(propuestaCV.historialLaboral?.length || 0) > 0 && (
              <div className="font-body text-[11px] text-inksoft mb-2.5">
                💡 También precargamos tu historial laboral e idiomas más abajo en "Mi CV" — revisalos y guardalos desde ahí.
              </div>
            )}

            {propuestaCV.rubroSugerido && propuestaCV.rubroSugerido !== profesional.rubro && (
              <div className="font-body text-[11px] text-inksoft mb-3">
                💡 Por lo que dice tu CV, tu rubro podría ser distinto al que tenés cargado. Si querés cambiarlo, escribinos por WhatsApp — el rubro lo maneja el admin para mantener ordenado el directorio.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={guardarPropuestaCV}
                disabled={guardandoCV}
                className="flex-1 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
              >
                {guardandoCV ? 'Guardando...' : 'Guardar en mi perfil'}
              </button>
              <button
                onClick={() => { setPropuestaCV(null); setErrorCV('') }}
                disabled={guardandoCV}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-xs text-inksoft"
              >
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Mis servicios y dónde trabajo --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="font-body text-sm font-semibold text-ink mb-1">Mis servicios, dónde trabajo y estudios</div>
        <div className="font-body text-xs text-inksoft mb-3">
          Contá, en puntos concretos, qué es lo que hacés (ej: "Instalación de grifería", "Reparación de fugas"), un resumen corto de dónde atendés y tus estudios. Se muestran en tu perfil público, además de la descripción.
        </div>

        {errorServicios && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-3">{errorServicios}</div>}
        {serviciosGuardados && <div className="font-body text-xs text-teal bg-teal/10 border border-teal rounded-md px-3 py-2 mb-3">Guardado ✓</div>}

        <div className="font-body text-[11px] text-inksoft mb-1">Resumen de dónde trabajo</div>
        <textarea
          value={miDondeTrabaja}
          onChange={(e) => { setMiDondeTrabaja(e.target.value); setServiciosGuardados(false) }}
          placeholder="Ej: Consultorio propio en Sopocachi, atiendo también en Clínica del Sur los martes"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panelalt mb-3"
        />

        <div className="font-body text-[11px] text-inksoft mb-1">Estudios</div>
        <input
          value={miEducacion}
          onChange={(e) => { setMiEducacion(e.target.value); setServiciosGuardados(false) }}
          placeholder="Ej: Maestría en Data Mining (UBA) · Ingeniería en Sistemas (UCB)"
          className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panelalt mb-3"
        />

        <div className="font-body text-[11px] text-inksoft mb-1">Servicios</div>
        {misServicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {misServicios.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panelalt border border-line font-body text-xs text-ink">
                {s}
                <button type="button" onClick={() => { quitarMiServicio(i); setServiciosGuardados(false) }} className="text-inksoft hover:text-maroon leading-none">✕</button>
              </span>
            ))}
          </div>
        )}

        {misServicios.length < 6 && (
          <div className="flex gap-2 mb-3">
            <input
              value={nuevoServicio}
              onChange={(e) => { setNuevoServicio(e.target.value); setServiciosGuardados(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); agregarMiServicio(); setServiciosGuardados(false) }
              }}
              placeholder="Ej: Instalación de grifería"
              className="flex-1 px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
            />
            <button
              type="button"
              onClick={() => { agregarMiServicio(); setServiciosGuardados(false) }}
              className="px-3 py-2 rounded-lg border border-line font-body text-xs text-inksoft"
            >
              Agregar
            </button>
          </div>
        )}

        <button
          onClick={guardarMisServicios}
          disabled={guardandoServicios}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
        >
          {guardandoServicios ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* --- Mi CV: historial laboral + idiomas → CV estandarizado --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="font-body text-sm font-semibold text-ink">Mi CV</div>
          <Link href={`/servicios/${profesional.id}/cv`} target="_blank" className="font-body text-xs text-teal font-semibold underline shrink-0">
            📄 Ver y descargar PDF
          </Link>
        </div>
        <div className="font-body text-xs text-inksoft mb-3">
          Cargá tus trabajos y la plataforma arma tu CV con un formato profesional, igual para todos — no hace falta que tengas uno propio. Usa también tu nombre, especialidad, descripción, estudios y servicios de más arriba.
        </div>

        {errorMiCV && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-3">{errorMiCV}</div>}
        {miCVGuardado && (
          <div className="font-body text-xs text-teal bg-teal/10 border border-teal rounded-md px-3 py-2 mb-3">
            Guardado ✓ — <Link href={`/servicios/${profesional.id}/cv`} target="_blank" className="underline">ver cómo quedó tu CV</Link>
          </div>
        )}

        <EditorCV
          historial={miHistorial}
          onHistorialChange={(h) => { setMiHistorial(h); setMiCVGuardado(false) }}
          idiomas={misIdiomas}
          onIdiomasChange={(i) => { setMisIdiomas(i); setMiCVGuardado(false) }}
          mejorarConIA={mejorarPuestoConIA}
        />

        <button
          onClick={guardarMiCV}
          disabled={guardandoMiCV}
          className="w-full mt-4 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
        >
          {guardandoMiCV ? 'Guardando...' : 'Guardar mi CV'}
        </button>
      </div>

      {/* Oportunidades: gente que publicó "Busco X" con el mismo rubro
          que este profesional — mismo criterio que el macheo automático
          por mail, mostrado acá como lista con botón de contacto directo. */}
      {(cargandoOportunidades || oportunidades.length > 0) && (
        <div className="bg-panel border border-line rounded-xl p-4 mb-5">
          <div className="font-body text-sm font-semibold text-ink mb-1">Oportunidades para vos</div>
          <div className="font-body text-xs text-inksoft mb-3">
            Gente que publicó un anuncio buscando justo tu rubro. Contactalos antes de que lo haga otro.
          </div>
          {cargandoOportunidades ? (
            <div className="font-body text-xs text-inksoft">Buscando...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {oportunidades.map((a) => (
                <div key={a.id} className="bg-panelalt rounded-lg p-3">
                  <div className="font-body text-sm font-semibold text-ink mb-0.5">{a.titulo}</div>
                  <div className="font-body text-xs text-inksoft mb-2 line-clamp-2">{a.descripcion}</div>
                  <a
                    href={linkWhatsappOportunidad(a)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1.5 rounded-md bg-teal text-white font-body text-[11px] font-semibold"
                  >
                    💬 Contactar
                  </a>
                </div>
              ))}
            </div>
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

      {/* --- Mis turnos (beneficio Premium) --- */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-5">
        <div className="font-body text-sm font-semibold text-ink mb-3">Mis turnos</div>
        {premiumVigente ? (
          <>
            <div className="font-body text-xs text-inksoft mb-3">
              Armá tu agenda por bloques: por ejemplo "Lunes a viernes, 19:00 a 21:00" y "Sábados, 9:00 a 14:00" pueden ser dos bloques distintos, cada uno con su propio rango.
            </div>
            <div className="font-body text-[11px] text-inksoft mb-3">
              Los turnos reservados por mail reciben un recordatorio automático un día antes. Los reservados por WhatsApp no se pueden mandar solos — usá el botón "Recordar" de cada turno para abrirle el WhatsApp vos mismo.
            </div>

            {horario.bloques.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {horario.bloques.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 bg-panelalt rounded-md px-2.5 py-2">
                    <div className="font-body text-xs text-ink">
                      <strong>{b.dias.map((d) => DIAS_SEMANA[d].corto).join(', ')}</strong> · {b.desde}–{b.hasta} · {INTERVALOS_TURNO.find((i) => i.min === b.intervaloMin)?.label || `cada ${b.intervaloMin} min`}
                    </div>
                    <button onClick={() => quitarBloque(b.id)} className="text-inksoft border-none bg-transparent leading-none shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-panelalt rounded-lg p-3 mb-3">
              <div className="font-body text-[11px] text-inksoft mb-1.5">Agregar bloque — días</div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {DIAS_SEMANA.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDiaNuevoBloque(d.id)}
                    className={`px-2.5 py-1.5 rounded-md border font-body text-xs font-medium ${
                      nuevoBloqueDias.includes(d.id) ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
                    }`}
                  >
                    {d.corto}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 mb-2">
                <input type="checkbox" checked={nuevoBloqueTodoElDia} onChange={(e) => setNuevoBloqueTodoElDia(e.target.checked)} />
                <span className="font-body text-xs text-ink">Todo el día</span>
              </label>

              {!nuevoBloqueTodoElDia && (
                <div className="flex gap-2 mb-2 items-center">
                  <input
                    type="time"
                    value={nuevoBloqueDesde}
                    onChange={(e) => setNuevoBloqueDesde(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line font-body text-sm"
                  />
                  <span className="font-body text-xs text-inksoft">a</span>
                  <input
                    type="time"
                    value={nuevoBloqueHasta}
                    onChange={(e) => setNuevoBloqueHasta(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line font-body text-sm"
                  />
                </div>
              )}

              <select
                value={nuevoBloqueIntervalo}
                onChange={(e) => setNuevoBloqueIntervalo(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2"
              >
                {INTERVALOS_TURNO.map((i) => (
                  <option key={i.min} value={i.min}>{i.label}</option>
                ))}
              </select>

              <button
                onClick={agregarBloque}
                disabled={nuevoBloqueDias.length === 0}
                className="w-full py-2 rounded-lg border border-line font-body text-xs text-ink disabled:opacity-50"
              >
                + Agregar bloque
              </button>
            </div>

            <button
              onClick={guardarHorario}
              disabled={guardandoHorario}
              className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60 mb-1"
            >
              {guardandoHorario ? 'Guardando...' : 'Guardar horario'}
            </button>
            {horarioGuardado && <div className="font-body text-[11px] text-teal mb-3">Guardado ✓ — ya aparece disponible en tu perfil público.</div>}

            <div className="font-body text-xs text-inksoft mt-4 mb-2">Próximos turnos reservados</div>
            {cargandoTurnos ? (
              <div className="font-body text-xs text-inksoft">Cargando...</div>
            ) : turnos.length === 0 ? (
              <div className="font-body text-xs text-inksoft">Todavía nadie te reservó un turno.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {turnos.map((t) => (
                  <div key={t.id} className="bg-panelalt rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-body text-sm font-semibold text-ink">{t.diaLabel} · {t.hora}</div>
                      {t.contactoTipo === 'mail' ? (
                        <button
                          onClick={() => mandarRecordatorioMail(t)}
                          disabled={mandandoRecordatorioId === t.id}
                          className="px-2.5 py-1 rounded-md border border-line font-body text-[11px] text-ink shrink-0 disabled:opacity-50"
                        >
                          {mandandoRecordatorioId === t.id ? 'Enviando...' : t.recordatorioEnviado ? '✓ Recordado' : 'Recordar'}
                        </button>
                      ) : (
                        <a
                          href={linkWhatsappRecordatorio(t)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-md border border-line font-body text-[11px] text-teal shrink-0"
                        >
                          💬 Recordar
                        </a>
                      )}
                    </div>
                    <div className="font-body text-xs text-inksoft">
                      {t.nombre} · {t.contacto} ({t.contactoTipo === 'mail' ? 'mail' : 'WhatsApp'})
                    </div>
                    {t.recordatorioEnviadoEn && (
                      <div className="font-body text-[11px] text-inksoft mt-0.5">
                        Recordatorio enviado {t.recordatorioAutomatico ? 'automáticamente' : ''} el {new Date(t.recordatorioEnviadoEn).toLocaleDateString('es-BO')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="font-body text-xs text-inksoft">
            Con Premium activás una agenda propia: cargás tus días y horarios, y la gente reserva turno directo desde tu perfil.
          </div>
        )}
      </div>

      <Link href={`/servicios/${profesional.id}`} className="block text-center font-body text-xs text-inksoft underline">
        Ver mi perfil público
      </Link>
    </div>
  )
}
