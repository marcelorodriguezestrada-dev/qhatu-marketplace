'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ZONAS_POTOSI } from '@/data/zonasPotosi'
import { useAuth } from '@/lib/auth'
import { useCategorias, agruparRubros } from '@/lib/useCategorias'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'
import { PAISES, PAIS_FALLBACK_ID } from '@/data/paises'
import { extraerTextoDeArchivo } from '@/lib/leerArchivoTexto'

// Valor especial del select de rubro: "esta categoría no tiene mi
// profesión, quiero escribirla yo". Es distinto del "otro" que ya
// existe como rubro fijo dentro de la categoría "Otros" — este
// aparece en TODAS las categorías, para poder agregar una profesión
// nueva sin tener que mandarla justo a "Otros".
const RUBRO_ESCRIBIR_PROPIO = '__custom__'

export default function PublicarServicioPage() {
  const { usuario, cargando, obtenerToken } = useAuth()
  const router = useRouter()
  const { categorias, rubrosFlat } = useCategorias()

  const [nombre, setNombre] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')
  const [rubro, setRubro] = useState('')
  const [rubroPersonalizado, setRubroPersonalizado] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [dondeTrabaja, setDondeTrabaja] = useState('')
  const [educacion, setEducacion] = useState('')
  const [servicios, setServicios] = useState<string[]>([])
  const [nuevoServicio, setNuevoServicio] = useState('')
  const [zona, setZona] = useState(ZONAS_POTOSI[0])
  const [zonaPersonalizada, setZonaPersonalizada] = useState('')
  const [zonasExtra, setZonasExtra] = useState<string[]>([])
  const [direccion, setDireccion] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappPais, setWhatsappPais] = useState(PAIS_FALLBACK_ID)
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const [leyendoCV, setLeyendoCV] = useState(false)
  const [errorCV, setErrorCV] = useState('')
  const [cvAplicado, setCvAplicado] = useState(false)

  // Zonas que otros usuarios ya agregaron a mano — se suman a la lista
  // base para que no haga falta reescribirlas.
  useEffect(() => {
    fetch('/api/zonas-personalizadas')
      .then((r) => r.json())
      .then((d) => setZonasExtra(d.zonas || []))
      .catch(() => {})
  }, [])

  // En cuanto llega el árbol de categorías, arrancamos con la primera
  // categoría y su primer rubro seleccionados (el select no puede
  // quedar vacío).
  useEffect(() => {
    if (categorias.length === 0 || categoriaSel) return
    setCategoriaSel(categorias[0].id)
    setRubro(categorias[0].rubros[0]?.id || RUBRO_ESCRIBIR_PROPIO)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias])

  // Dar de alta un servicio requiere estar logueado — así se evita que
  // cualquiera publique perfiles falsos sin ninguna cuenta detrás.
  useEffect(() => {
    if (!cargando && !usuario) router.push('/login')
  }, [cargando, usuario, router])

  // Lista de servicios concretos que ofrece (ej: "Instalación de
  // grifería", "Destape de cañerías") — hasta 6, igual que del lado del
  // servidor (ver /api/profesionales/solicitud).
  function agregarServicio() {
    const texto = nuevoServicio.trim()
    if (!texto || servicios.length >= 6) return
    if (servicios.some((s) => s.toLowerCase() === texto.toLowerCase())) {
      setNuevoServicio('')
      return
    }
    setServicios((s) => [...s, texto.slice(0, 80)])
    setNuevoServicio('')
  }

  function quitarServicio(i: number) {
    setServicios((s) => s.filter((_, idx) => idx !== i))
  }

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

  // Lee el CV (PDF o foto/escaneo) que la persona sube ANTES de llenar el
  // resto del formulario, y le pide a la IA que arme una propuesta para
  // precargar todo lo que se pueda: es solo una propuesta editable, así
  // que la persona revisa y corrige cada campo (o los borra) antes de
  // mandar la solicitud, igual que si los hubiera escrito a mano.
  async function subirCV(file: File | null) {
    if (!file) return
    setErrorCV('')
    setCvAplicado(false)
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
      const datos = data.datos

      if (datos.nombre) setNombre(datos.nombre)
      if (datos.especialidad) setEspecialidad(datos.especialidad)
      if (datos.descripcion) setDescripcion(datos.descripcion)
      if (datos.experiencia) setExperiencia(datos.experiencia)
      if (datos.dondeTrabaja) setDondeTrabaja(datos.dondeTrabaja)
      if (datos.educacion) setEducacion(datos.educacion)
      if (datos.direccion) setDireccion(datos.direccion)
      if (datos.email) setEmail(datos.email)
      if (datos.servicios && datos.servicios.length > 0) setServicios(datos.servicios)

      // El teléfono del CV puede venir con código de país, espacios o
      // guiones — lo dejamos solo en dígitos y, si trae el 591 boliviano
      // adelante, se lo sacamos porque el campo espera el número local.
      if (datos.telefono) {
        let digitos = String(datos.telefono).replace(/\D/g, '')
        if (digitos.startsWith('591') && digitos.length > 8) digitos = digitos.slice(3)
        if (digitos) setWhatsapp(digitos)
      }

      // Rubro sugerido por la IA, buscado en el árbol REAL de
      // categorías de la plataforma — si lo encontramos, seleccionamos
      // de una vez tanto la categoría como el rubro en los selects de
      // arriba (la persona igual los puede cambiar si no es correcto).
      if (datos.rubroSugerido) {
        const encontrado = rubrosFlat.find((r) => r.id === datos.rubroSugerido)
        if (encontrado) {
          setCategoriaSel(encontrado.categoriaId)
          setRubro(encontrado.id)
        }
      }

      setCvAplicado(true)
    } catch (e: any) {
      setErrorCV(e?.message || 'No se pudo leer el CV.')
    } finally {
      setLeyendoCV(false)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('Completá tu nombre o el de tu negocio.')
      return
    }
    if (rubro === RUBRO_ESCRIBIR_PROPIO && !rubroPersonalizado.trim()) {
      setError('Escribí el nombre de tu profesión u oficio.')
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
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Revisá tu email, no parece válido (o dejalo vacío).')
      return
    }
    setEnviando(true)
    try {
      const token = await obtenerToken()
      const esPersonalizado = rubro === RUBRO_ESCRIBIR_PROPIO
      const res = await fetch('/api/profesionales/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre,
          rubro: esPersonalizado ? 'otro' : rubro,
          rubroPersonalizado: esPersonalizado ? rubroPersonalizado : '',
          categoriaId: categoriaSel,
          especialidad, descripcion, dondeTrabaja, educacion, servicios, zona, zonaPersonalizada, direccion, whatsapp, whatsappPais, instagram, email, precio, experiencia,
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
        <label className="block text-center py-2.5 rounded-lg border border-dashed border-line font-body text-xs text-inksoft cursor-pointer mb-1">
          {leyendoCV ? 'Leyendo tu CV...' : '📄 Subir mi CV para completar el formulario (opcional)'}
          <input
            type="file"
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/*"
            className="hidden"
            disabled={leyendoCV}
            onChange={(e) => subirCV(e.target.files?.[0] || null)}
          />
        </label>
        <div className="font-body text-[11px] text-inksoft mb-3">
          Aceptamos PDF, Word (.docx), foto o escaneo. La IA completa los campos que pueda a partir de tu CV — revisalos igual antes de enviar, porque siguen siendo editables.
        </div>
        {errorCV && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-3">{errorCV}</div>}
        {cvAplicado && !errorCV && (
          <div className="font-body text-xs text-teal bg-teal/10 border border-teal rounded-md px-3 py-2 mb-3">
            Completamos lo que pudimos con tu CV ✓ — revisá los campos de abajo antes de enviar.
          </div>
        )}

        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre o el de tu negocio"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <select
          value={categoriaSel}
          onChange={(e) => {
            const nuevaCategoria = e.target.value
            setCategoriaSel(nuevaCategoria)
            const cat = categorias.find((c) => c.id === nuevaCategoria)
            setRubro(cat?.rubros[0]?.id || RUBRO_ESCRIBIR_PROPIO)
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3 bg-panel"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3 bg-panel"
        >
          {agruparRubros(categorias.find((c) => c.id === categoriaSel)?.rubros || []).map((bloque) =>
            bloque.grupoLabel ? (
              <optgroup key={bloque.grupoId} label={bloque.grupoLabel}>
                {bloque.rubros.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </optgroup>
            ) : (
              bloque.rubros.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))
            )
          )}
          <option value={RUBRO_ESCRIBIR_PROPIO}>Mi profesión no está en la lista (especificar)</option>
        </select>
        {rubro === RUBRO_ESCRIBIR_PROPIO && (
          <input
            value={rubroPersonalizado}
            onChange={(e) => setRubroPersonalizado(e.target.value)}
            placeholder="¿Cuál es tu profesión u oficio? (ej: Jardinero)"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
        )}
        <input
          value={especialidad}
          onChange={(e) => setEspecialidad(e.target.value)}
          placeholder="Especialidad (opcional, ej: Médico general - Ecografista)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <div className="font-body text-[11px] text-inksoft mb-3 -mt-2">
          Si lo dejás vacío, se muestra el rubro que elegiste arriba.
        </div>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Contanos de qué se trata tu servicio"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />

        <div className="mb-3">
          <div className="font-body text-xs font-semibold text-ink mb-1">¿Qué hacés concretamente? (opcional)</div>
          <div className="font-body text-[11px] text-inksoft mb-2">
            Agregá hasta 6 servicios puntuales, ej: "Instalación de grifería", "Reparación de fugas".
          </div>
          {servicios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {servicios.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panelalt border border-line font-body text-xs text-ink">
                  {s}
                  <button type="button" onClick={() => quitarServicio(i)} className="text-inksoft hover:text-maroon leading-none">✕</button>
                </span>
              ))}
            </div>
          )}
          {servicios.length < 6 && (
            <div className="flex gap-2">
              <input
                value={nuevoServicio}
                onChange={(e) => setNuevoServicio(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); agregarServicio() }
                }}
                placeholder="Ej: Instalación de grifería"
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
              <button
                type="button"
                onClick={agregarServicio}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm text-ink bg-panelalt"
              >
                Agregar
              </button>
            </div>
          )}
        </div>

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
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Dirección (opcional, ej: Fortunato Gumiel)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <textarea
          value={dondeTrabaja}
          onChange={(e) => setDondeTrabaja(e.target.value)}
          placeholder="Resumen de dónde trabajás (opcional, ej: Consultorio propio en Sopocachi, atiendo también en Clínica del Sur los martes)"
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-1"
        />
        <div className="font-body text-[11px] text-inksoft mb-3">
          Un resumen del lugar donde atendés o trabajás (distinto de la dirección, por si es un nombre conocido).
        </div>

        <input
          value={educacion}
          onChange={(e) => setEducacion(e.target.value)}
          placeholder="Estudios (opcional, ej: Maestría en Data Mining (UBA) · Ingeniería en Sistemas (UCB))"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-1"
        />
        <div className="font-body text-[11px] text-inksoft mb-3">
          Títulos, maestrías o certificaciones relevantes — ayuda a generar confianza en quien te contrata.
        </div>

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

        <div className="flex gap-2 items-center mb-3">
          <select
            value={whatsappPais}
            onChange={(e) => setWhatsappPais(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-line font-body text-sm bg-panel shrink-0"
            title="País del número"
          >
            {PAISES.map((p) => (
              <option key={p.id} value={p.id}>{p.bandera} {p.nombre} (+{p.codigo})</option>
            ))}
          </select>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Tu WhatsApp (ej: 71234567, sin +591)"
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Tu email (opcional)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-1"
        />
        <div className="font-body text-[11px] text-inksoft mb-3">
          El WhatsApp sigue siendo el contacto principal — el email es solo por si preferimos escribirte por ahí para algo puntual.
        </div>
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
