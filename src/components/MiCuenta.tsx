'use client'

import { useEffect, useState } from 'react'
import { verifyBeforeUpdateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { useAuth } from '@/lib/auth'
import { leerModoAdmin } from '@/lib/modoAdmin'

// "👤 Mi cuenta": cada usuario (comprador, vendedor, profesional) puede
// cambiar su nombre, WhatsApp, email y contraseña. El email nuevo se
// confirma con un link que Firebase manda a ese correo; recién ahí se
// cambia (y lo copiamos a su tienda/productos al volver a entrar — ver
// /api/usuarios/estado).
export default function MiCuenta({ className = '' }: { className?: string }) {
  const { usuario, obtenerToken, recuperarPassword } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [pidePassword, setPidePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [cambiandoEmail, setCambiandoEmail] = useState(false)
  const [modoAdmin, setModoAdmin] = useState(false)

  useEffect(() => {
    setModoAdmin(!!leerModoAdmin())
  }, [])

  useEffect(() => {
    if (!abierto || cargado || !usuario) return
    ;(async () => {
      const token = await obtenerToken()
      const d = await fetch('/api/usuarios/datos', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({}))
      setNombre(d.nombre || usuario.displayName || '')
      setWhatsapp(d.whatsapp || '')
      setCargado(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, usuario])

  if (!usuario) return null

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/usuarios/datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, whatsapp }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar.')
      setMensaje('✓ Datos guardados')
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario) return
    const email = nuevoEmail.trim().toLowerCase()
    setError('')
    setMensaje('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Poné un email válido.'); return }
    if (email === (usuario.email || '').toLowerCase()) { setError('Es el mismo email que ya tenés.'); return }
    setCambiandoEmail(true)
    try {
      if (pidePassword) {
        if (!usuario.email) throw new Error('No se pudo confirmar tu identidad.')
        await reauthenticateWithCredential(usuario, EmailAuthProvider.credential(usuario.email, password))
      }
      await verifyBeforeUpdateEmail(usuario, email)
      setMensaje(`📩 Te mandamos un link a ${email}. Abrilo para confirmar el cambio; después entrá con tu email nuevo.`)
      setNuevoEmail('')
      setPidePassword(false)
      setPassword('')
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/requires-recent-login') {
        setPidePassword(true)
        setError('Por seguridad, escribí tu contraseña actual y tocá de nuevo “Cambiar email”.')
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('La contraseña no es correcta.')
      } else if (code === 'auth/email-already-in-use') {
        setError('Ese email ya lo usa otra cuenta.')
      } else if (code === 'auth/invalid-email') {
        setError('Ese email no es válido.')
      } else {
        setError('No se pudo cambiar el email. Probá de nuevo en un rato.')
      }
    } finally {
      setCambiandoEmail(false)
    }
  }

  async function cambiarPassword() {
    if (!usuario?.email) return
    setError('')
    try {
      await recuperarPassword(usuario.email)
      setMensaje(`📩 Te mandamos a ${usuario.email} un link para elegir tu contraseña nueva.`)
    } catch {
      setError('No se pudo mandar el link. Probá de nuevo en un rato.')
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'

  return (
    <div className={`bg-panel border border-line rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-body text-sm text-ink min-w-0">
          <span className="font-semibold">👤 Mi cuenta</span>
          <span className="text-inksoft"> · {usuario.email}</span>
        </div>
        <button type="button" onClick={() => setAbierto((v) => !v)} className="px-3 py-1.5 rounded-lg border border-line font-body text-xs text-ink">
          {abierto ? 'Cerrar' : '✏️ Editar mis datos'}
        </button>
      </div>

      {abierto && (
        <div className="mt-4 grid gap-5">
          <form onSubmit={guardarDatos} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="font-body text-xs text-ink">
              <span className="block font-semibold mb-1">Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" disabled={!cargado} className={input} />
            </label>
            <label className="font-body text-xs text-ink">
              <span className="block font-semibold mb-1">WhatsApp</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="71234567" inputMode="tel" disabled={!cargado} className={input} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={guardando || !cargado} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </form>

          {modoAdmin ? (
            <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg px-3 py-2">
              🛠️ Estás en modo admin: el email de esta cuenta se cambia desde Admin → Usuarios → ✏️ Editar.
            </div>
          ) : (
            <form onSubmit={cambiarEmail} className="border-t border-line pt-4 grid gap-2">
              <div className="font-body text-xs font-semibold text-ink">Cambiar email</div>
              <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="tu-email-nuevo@gmail.com" className={input} />
              {pidePassword && (
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña actual" autoComplete="current-password" className={input} />
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <button type="submit" disabled={cambiandoEmail || !nuevoEmail} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60">
                  {cambiandoEmail ? 'Enviando...' : 'Cambiar email'}
                </button>
                <button type="button" onClick={cambiarPassword} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink">
                  🔑 Cambiar contraseña
                </button>
              </div>
              <div className="font-body text-[11px] text-inksoft">Te llega un link al email nuevo para confirmarlo. Hasta que lo abras, seguís entrando con el actual.</div>
            </form>
          )}

          {mensaje && <div className="font-body text-xs text-teal">{mensaje}</div>}
          {error && <div className="font-body text-xs text-maroon">{error}</div>}
          <div className="font-body text-[11px] text-inksoft">Los datos de tu tienda (nombre, WhatsApp de ventas, QR, dirección) se editan en <a href="/vender" className="text-teal underline">Vender → Mi tienda</a>.</div>
        </div>
      )}
    </div>
  )
}
