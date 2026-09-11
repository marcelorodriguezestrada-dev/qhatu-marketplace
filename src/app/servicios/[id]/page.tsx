'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useCategorias } from '@/lib/useCategorias'
import { esPremiumVigente } from '@/lib/planPremium'
import { getProximosDiasSegunHorario } from '@/data/turnos'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function Estrellas({ valor, size = 'text-sm' }: { valor: number; size?: string }) {
  return (
    <span className={`text-ochre font-body ${size}`}>
      {'★'.repeat(Math.round(valor))}
      {'☆'.repeat(5 - Math.round(valor))}
    </span>
  )
}

export default function PerfilProfesionalPage() {
  const params = useParams()
  const id = params?.id as string
  const { usuario, obtenerToken } = useAuth()
  const { buscarRubro } = useCategorias()
  const [perfil, setPerfil] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [calificacion, setCalificacion] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // --- Reservar turno (perfiles Premium con horario cargado) ---
  const [ocupados, setOcupados] = useState<string[]>([])
  const [diaSel, setDiaSel] = useState<{ iso: string; label: string } | null>(null)
  const [horaSel, setHoraSel] = useState('')
  const [nombreReserva, setNombreReserva] = useState('')
  const [contactoReserva, setContactoReserva] = useState('')
  const [contactoTipoReserva, setContactoTipoReserva] = useState<'whatsapp' | 'mail'>('whatsapp')
  const [reservando, setReservando] = useState(false)
  const [reservado, setReservado] = useState(false)
  const [errorReserva, setErrorReserva] = useState('')

  function cargar() {
    fetch(`/api/profesionales/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPerfil(data)
        setCargando(false)
      })
  }

  useEffect(() => {
    if (id) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/turnos/disponibilidad?profesionalId=${id}`)
      .then((r) => r.json())
      .then((data) => setOcupados(data.ocupados || []))
      .catch(() => {})
  }, [id])

  async function reservarTurno(e: React.FormEvent) {
    e.preventDefault()
    setErrorReserva('')
    if (!diaSel || !horaSel) {
      setErrorReserva('Elegí un día y una hora.')
      return
    }
    if (!nombreReserva.trim() || !contactoReserva.trim()) {
      setErrorReserva('Completá tu nombre y tu contacto.')
      return
    }
    setReservando(true)
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesionalId: id,
          nombre: nombreReserva.trim(),
          fecha: diaSel.iso,
          diaLabel: diaSel.label,
          hora: horaSel,
          contacto: contactoReserva.trim(),
          contactoTipo: contactoTipoReserva,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorReserva(data.error)
        return
      }
      setReservado(true)
      setOcupados((o) => [...o, `${diaSel.iso}|${horaSel}`])
    } catch {
      setErrorReserva('No se pudo reservar el turno. Probá de nuevo.')
    } finally {
      setReservando(false)
    }
  }

  async function enviarResena(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch(`/api/profesionales/${id}/resenas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ calificacion, comentario }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setComentario('')
      cargar()
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  if (!perfil || perfil.error) return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">No encontramos este perfil.</div>

  const linkWhatsapp = `https://wa.me/${perfil.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${perfil.nombre}, te vi en Clasi Click y quería consultarte por tus servicios.`
  )}`

  const rubroInfo = buscarRubro(perfil.rubro)

  const premiumVigente = esPremiumVigente(perfil)
  const horarioTurnos = perfil.horarioTurnos || { dias: [], horas: [] }
  const agendaActiva = premiumVigente && horarioTurnos.dias.length > 0 && horarioTurnos.horas.length > 0
  const diasDisponibles = agendaActiva ? getProximosDiasSegunHorario(horarioTurnos.dias, 10) : []
  const horasDelDiaSel = diaSel
    ? horarioTurnos.horas.filter((h: string) => !ocupados.includes(`${diaSel.iso}|${h}`))
    : []

  return (
    <div className="max-w-[880px] mx-auto px-5 py-8">
      <div className="flex items-center gap-1.5 flex-wrap font-body text-[13px] text-inksoft mb-5">
        <Link href="/servicios" className="hover:underline">Servicios</Link>
        {rubroInfo && (
          <>
            <span className="text-line">›</span>
            <Link href={`/servicios?categoria=${rubroInfo.categoriaId}`} className="hover:underline">
              {rubroInfo.categoriaLabel}
            </Link>
            <span className="text-line">›</span>
            <Link href={`/servicios?categoria=${rubroInfo.categoriaId}&rubro=${rubroInfo.id}`} className="hover:underline">
              {rubroInfo.label}
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        <div className="order-2 md:order-1 min-w-0">
          {perfil.descripcion && (
            <>
              <div className="font-display text-lg font-bold text-ink mb-2">Descripción</div>
              <p className="font-body text-sm text-ink mb-8 whitespace-pre-line">{perfil.descripcion}</p>
            </>
          )}

          {perfil.fotosAdicionales && perfil.fotosAdicionales.length > 0 && (
            <>
              <div className="font-display text-lg font-bold text-ink mb-2">Fotos</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-8">
                {perfil.fotosAdicionales.map((url: string) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-line">
                    <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="font-body text-sm font-semibold text-ink mb-3">Reseñas</div>

          {usuario ? (
            <form onSubmit={enviarResena} className="bg-panel border border-line rounded-lg p-4 mb-5">
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCalificacion(n)}
                    className={`text-lg ${n <= calificacion ? 'text-ochre' : 'text-line'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Contá tu experiencia (opcional)"
                className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm mb-2"
                rows={2}
              />
              {error && <div className="font-body text-xs text-maroon mb-2">{error}</div>}
              <button
                type="submit"
                disabled={enviando}
                className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-xs font-semibold"
              >
                {enviando ? 'Enviando...' : 'Dejar reseña'}
              </button>
            </form>
          ) : (
            <div className="font-body text-xs text-inksoft mb-5">
              <Link href="/login" className="text-maroon underline">Iniciá sesión</Link> para dejar una reseña.
            </div>
          )}

          {(perfil.resenas || []).map((r: any) => (
            <div key={r.id} className="border-b border-line py-3">
              <div className="flex items-center gap-2 mb-1">
                <Estrellas valor={r.calificacion} size="text-xs" />
                <span className="font-body text-[11px] text-inksoft">{r.autorEmail?.split('@')[0]}</span>
              </div>
              {r.comentario && <div className="font-body text-sm text-ink">{r.comentario}</div>}
            </div>
          ))}
          {(!perfil.resenas || perfil.resenas.length === 0) && (
            <div className="font-body text-sm text-inksoft">Sé el primero en dejar una reseña.</div>
          )}
        </div>

        <div className="order-1 md:order-2">
          <div className="bg-panel border border-line rounded-xl p-5 mb-4">
            <div className="font-display text-lg font-bold text-ink mb-1 leading-snug">{perfil.nombre}</div>
            {(perfil.especialidad || rubroInfo?.label || perfil.rubro) && (
              <div className="font-body text-sm text-ink mb-2">
                {perfil.especialidad || rubroInfo?.label || perfil.rubro}
              </div>
            )}
            {(perfil.direccion || perfil.zona || perfil.experiencia) && (
              <div className="font-body text-xs text-inksoft mb-3 space-y-0.5">
                {perfil.direccion && <div>Dirección: {perfil.direccion}</div>}
                {perfil.zona && <div>Zona: {perfil.zona}</div>}
                {perfil.experiencia && <div>Experiencia: {perfil.experiencia}</div>}
              </div>
            )}
            {perfil.precio ? (
              <div className="font-display text-xl font-bold text-ink mb-3">{bs(perfil.precio)}</div>
            ) : null}

            {perfil.cantidadResenas > 0 ? (
              <div className="flex items-center gap-2 mb-3">
                <Estrellas valor={perfil.ratingPromedio} />
                <span className="font-body text-xs text-inksoft">
                  {perfil.ratingPromedio} ({perfil.cantidadResenas})
                </span>
              </div>
            ) : (
              <div className="font-body text-xs text-inksoft mb-3">Todavía sin reseñas</div>
            )}

            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => fetch(`/api/profesionales/${id}/click-whatsapp`, { method: 'POST' }).catch(() => {})}
              className="block text-center w-full py-3 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold"
            >
              Contactar por WhatsApp
            </a>

            {agendaActiva && (
              <div className="mt-4 pt-4 border-t border-line">
                <div className="font-body text-sm font-semibold text-ink mb-3">Reservar turno</div>
                {reservado ? (
                  <div className="font-body text-sm text-teal bg-teal/10 rounded-lg p-3">
                    ¡Listo! Tu turno con {perfil.nombre} quedó para el {diaSel?.label} a las {horaSel}.
                    {contactoTipoReserva === 'mail' && ' Te mandamos la confirmación por mail.'}
                  </div>
                ) : (
                  <form onSubmit={reservarTurno}>
                    <div className="font-body text-xs text-inksoft mb-1.5">Elegí el día</div>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {diasDisponibles.map((d) => (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => { setDiaSel(d); setHoraSel('') }}
                          className={`px-2.5 py-1.5 rounded-md border font-body text-xs font-medium ${
                            diaSel?.iso === d.iso ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panelalt text-inksoft'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {diaSel && (
                      <>
                        <div className="font-body text-xs text-inksoft mb-1.5">Elegí la hora</div>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {horasDelDiaSel.length === 0 && (
                            <span className="font-body text-xs text-inksoft">No quedan horarios libres ese día.</span>
                          )}
                          {horasDelDiaSel.map((h: string) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setHoraSel(h)}
                              className={`px-2.5 py-1.5 rounded-md border font-body text-xs font-medium ${
                                horaSel === h ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panelalt text-inksoft'
                              }`}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {diaSel && horaSel && (
                      <>
                        <input
                          value={nombreReserva}
                          onChange={(e) => setNombreReserva(e.target.value)}
                          placeholder="Tu nombre"
                          className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm mb-2"
                        />
                        <div className="flex gap-2 mb-2">
                          <select
                            value={contactoTipoReserva}
                            onChange={(e) => setContactoTipoReserva(e.target.value as 'whatsapp' | 'mail')}
                            className="px-2 py-2 rounded-lg border border-line font-body text-xs bg-panel shrink-0"
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="mail">Mail</option>
                          </select>
                          <input
                            value={contactoReserva}
                            onChange={(e) => setContactoReserva(e.target.value)}
                            placeholder={contactoTipoReserva === 'mail' ? 'tu@mail.com' : 'Tu WhatsApp'}
                            className="flex-1 px-3 py-2 rounded-lg border border-line font-body text-sm"
                          />
                        </div>
                        {errorReserva && <div className="font-body text-xs text-maroon mb-2">{errorReserva}</div>}
                        <button
                          type="submit"
                          disabled={reservando}
                          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
                        >
                          {reservando ? 'Reservando...' : 'Confirmar turno'}
                        </button>
                      </>
                    )}
                  </form>
                )}
              </div>
            )}

            {perfil.instagram && (
              <a
                href={perfil.instagram.startsWith('http') ? perfil.instagram : `https://instagram.com/${perfil.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full py-2.5 mt-2 rounded-lg border border-line font-body text-sm text-ink break-words"
              >
                📷 {perfil.instagram.replace('https://instagram.com/', '').replace('@', '')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}