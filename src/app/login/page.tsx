'use client'

import { leerCampana } from '@/lib/campana'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'

const MENSAJES_FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/invalid-email': 'Ese email no es válido.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
  'auth/operation-not-allowed': 'El ingreso con Google todavía no está habilitado. Usá tu email y contraseña.',
  'auth/unauthorized-domain': 'El ingreso con Google todavía no está habilitado en este sitio. Usá tu email y contraseña.',
  'auth/account-exists-with-different-credential': 'Ese email ya tiene una cuenta con contraseña: entrá con tu email y contraseña.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet y probá de nuevo.',
}

// Logo de Google (los 4 colores), para el botón "Continuar con Google".
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

const esGmail = (e: string) => /@(gmail|googlemail)\.com$/i.test(e.trim())

// ?volver=/producto/123 → después de entrar vuelve ahí (ej. desde el
// banner de un cupón). Solo rutas internas, nunca a otro sitio.
function destinoTrasLogin() {
  if (typeof window === 'undefined') return '/'
  const v = new URLSearchParams(window.location.search).get('volver') || ''
  return v.startsWith('/') && !v.startsWith('//') ? v : '/'
}

export default function LoginPage() {
  const { usuario, emailVerificado, faltaCelular, login, registrarse, loginConGoogle, recuperarPassword, obtenerToken, logout, marcarEmailVerificado, marcarCelularListo } = useAuth()
  const router = useRouter()

  // 'login' / 'registro' → formulario normal. 'verificar' → paso extra
  // obligatorio después de registrarse, antes de poder usar la cuenta.
  // 'recuperar' → pantalla de "te mandamos un link para resetear".
  // 'celular' → entró con Google y falta su celular (obligatorio).
  const [modo, setModo] = useState<'login' | 'registro' | 'verificar' | 'recuperar' | 'celular'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [celular, setCelular] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const yaMandoCodigoAlLlegar = useRef(false)

  // Cubre el caso de alguien que ya tiene sesión abierta (no vino de
  // enviar el formulario de acá) y entra a /login por su cuenta — por
  // ejemplo, tocando el link "Verificar ahora" desde /mis-pedidos. Si
  // ya está todo verificado, no tiene sentido mostrarle el formulario
  // de login de nuevo.
  useEffect(() => {
    if (!usuario || emailVerificado === null) return
    // Durante el flujo de registro, el propio código de más abajo ya se
    // encarga de mandar el código y pasar a 'verificar' en el momento
    // justo — si este efecto interviniera también, podría redirigir a
    // home de pura casualidad de timing, antes de que termine de
    // guardarse el documento en Firestore (emailVerificado por default
    // da "true" cuando ese documento todavía no existe, para no trabar
    // a las cuentas viejas de antes de este sistema).
    if (modo !== 'login') return
    if (emailVerificado === true) {
      if (faltaCelular) { setModo('celular'); return }
      router.push(destinoTrasLogin())
      return
    }
    setEmail(usuario.email || '')
    setModo('verificar')
    if (!yaMandoCodigoAlLlegar.current) {
      yaMandoCodigoAlLlegar.current = true
      enviarCodigoAlMail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, emailVerificado, faltaCelular, modo])

  async function enviarCodigoAlMail() {
    const token = await obtenerToken()
    if (!token) return
    const res = await fetch('/api/usuarios/enviar-codigo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.enviado === false) {
      setAviso(
        data.motivo
          ? `Tu cuenta se creó bien, pero el mail no se pudo enviar: ${data.motivo}`
          : 'Tu cuenta se creó bien, pero no pudimos mandarte el mail con el código (el servicio de mails no está configurado). Escribinos para verificarte manualmente.'
      )
    } else {
      setAviso(`Te mandamos un código a ${email}. Puede tardar un minuto en llegar — revisá también spam.`)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAviso('')

    if (modo === 'recuperar') {
      setCargando(true)
      try {
        await recuperarPassword(email)
        setAviso(`Si ${email} tiene una cuenta, te mandamos un link para resetear la contraseña.`)
      } catch (err: any) {
        setError(MENSAJES_FIREBASE[err?.code] || 'No pudimos enviar el mail. Revisá el email e intentá de nuevo.')
      } finally {
        setCargando(false)
      }
      return
    }

    if (modo === 'registro') {
      const chequeoCelular = validarWhatsappBoliviano(celular)
      if (!chequeoCelular.valido) {
        setError(chequeoCelular.motivo || 'Celular inválido.')
        return
      }
    }

    setCargando(true)
    try {
      if (modo === 'login') {
        await login(email, password)
        // El useEffect de arriba se encarga de a dónde ir después
        // (según emailVerificado, que se actualiza solo apenas cambia
        // el usuario de sesión) — acá no hace falta duplicar esa lógica.
        return
      }

      // Registro: creamos la cuenta, guardamos el celular, y pasamos a
      // pedir el código de verificación antes de dejar entrar.
      await registrarse(email, password)
      const token = await obtenerToken()
      if (token) {
        const resRegistrar = await fetch('/api/usuarios/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ celular, campana: leerCampana() }),
        })
        if (!resRegistrar.ok) {
          const dataRegistrar = await resRegistrar.json().catch(() => ({}))
          console.error('No se pudo guardar el celular al registrarse:', dataRegistrar.error)
        }
      }
      await enviarCodigoAlMail()
      setModo('verificar')
    } catch (err: any) {
      setError(MENSAJES_FIREBASE[err?.code] || err?.message || 'Ocurrió un error. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  // "Continuar con Google": entra o crea la cuenta. El efecto de arriba
  // decide a dónde ir (o pide el celular si es la primera vez).
  async function entrarConGoogle() {
    setError('')
    setAviso('')
    setCargando(true)
    try {
      await loginConGoogle()
      setModo('login')
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Entrar con Google', err)
        setError(MENSAJES_FIREBASE[err?.code] || `No pudimos entrar con Google. Probá de nuevo${err?.code ? ` (${err.code})` : ''}.`)
      }
    } finally {
      setCargando(false)
    }
  }

  async function guardarCelular(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const chequeo = validarWhatsappBoliviano(celular)
    if (!chequeo.valido) { setError(chequeo.motivo || 'Celular inválido.'); return }
    setCargando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/usuarios/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ celular, campana: leerCampana() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'No pudimos guardar el celular. Probá de nuevo.'); return }
      marcarCelularListo()
      router.push(destinoTrasLogin())
    } catch {
      setError('No pudimos guardar el celular. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/usuarios/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codigo }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      // Le avisamos al contexto global YA MISMO, antes de navegar —
      // si esperamos a que /api/usuarios/estado se vuelva a consultar
      // solo, el gate global todavía ve el valor viejo (false) durante
      // ese instante y rebota a la persona de vuelta para acá.
      marcarEmailVerificado()
      router.push(destinoTrasLogin())
    } catch {
      setError('No pudimos verificar el código. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function reenviarCodigo() {
    setReenviando(true)
    setError('')
    setAviso('')
    try {
      await enviarCodigoAlMail()
    } finally {
      setReenviando(false)
    }
  }

  if (modo === 'verificar') {
    return (
      <div className="max-w-[360px] mx-auto px-5 py-20">
        <div className="font-display text-xl font-bold text-ink mb-1">Verificá tu email</div>
        <div className="font-body text-[13px] text-inksoft mb-6">
          Te mandamos un código de 6 dígitos a <strong>{email}</strong>. Ingresalo acá para activar tu cuenta.
        </div>
        <form onSubmit={verificarCodigo}>
          <input
            type="text"
            inputMode="numeric"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            required
            maxLength={6}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-center text-lg tracking-[6px] mb-3"
          />
          {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
          {aviso && <div className="font-body text-xs text-teal mb-3">{aviso}</div>}
          <button
            type="submit"
            disabled={cargando || codigo.length !== 6}
            className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold mb-3 disabled:opacity-60"
          >
            {cargando ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
        <button
          onClick={reenviarCodigo}
          disabled={reenviando}
          className="w-full text-center font-body text-[13px] text-inksoft underline mb-2 disabled:opacity-60"
        >
          {reenviando ? 'Enviando...' : 'Reenviar código'}
        </button>
        {esGmail(email) && (
          <button
            onClick={entrarConGoogle}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-line bg-white font-body text-[13px] text-ink font-semibold mb-2 disabled:opacity-60"
          >
            <LogoGoogle /> ¿No te llega? Entrá con Google
          </button>
        )}
        <button
          onClick={() => { logout(); setModo('login'); setCodigo(''); setAviso(''); setError('') }}
          className="w-full text-center font-body text-[12px] text-inksoft underline"
        >
          Usar otra cuenta
        </button>
      </div>
    )
  }

  if (modo === 'celular') {
    return (
      <div className="max-w-[360px] mx-auto px-5 py-20">
        <div className="font-display text-xl font-bold text-ink mb-1">Un último dato</div>
        <div className="font-body text-[13px] text-inksoft mb-6">
          Entraste con Google como <strong>{usuario?.email}</strong>. Dejanos tu celular para coordinar tus pedidos.
        </div>
        <form onSubmit={guardarCelular}>
          <input
            type="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            placeholder="Celular (8 dígitos, sin el +591)"
            required
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
          {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold mb-3 disabled:opacity-60"
          >
            {cargando ? 'Guardando...' : 'Continuar'}
          </button>
        </form>
        <button
          onClick={() => { logout(); setModo('login'); setError('') }}
          className="w-full text-center font-body text-[12px] text-inksoft underline"
        >
          Usar otra cuenta
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[360px] mx-auto px-5 py-20">
      <div className="font-display text-xl font-bold text-ink mb-1">
        {modo === 'login' ? 'Iniciar sesión' : modo === 'recuperar' ? 'Recuperar contraseña' : 'Crear cuenta'}
      </div>
      <div className="font-body text-[13px] text-inksoft mb-6">
        {modo === 'login'
          ? 'Para comprar y vender en Clasi Click'
          : modo === 'recuperar'
            ? 'Te mandamos un link a tu email para elegir una nueva'
            : 'Con tu cuenta ya podés publicar productos'}
      </div>

      {modo !== 'recuperar' && (
        <>
          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-line bg-white font-body text-sm text-ink font-semibold mb-4 disabled:opacity-60"
          >
            <LogoGoogle /> Continuar con Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-line" />
            <span className="font-body text-[11px] text-inksoft">o con tu email</span>
            <div className="flex-1 h-px bg-line" />
          </div>
        </>
      )}

      <form onSubmit={enviar}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        {modo !== 'recuperar' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
            minLength={6}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
        )}
        {modo === 'registro' && (
          <input
            type="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            placeholder="Celular (8 dígitos, sin el +591)"
            required
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          />
        )}
        {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
        {aviso && <div className="font-body text-xs text-teal mb-3">{aviso}</div>}
        <button
          type="submit"
          disabled={cargando}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold mb-3 disabled:opacity-60"
        >
          {cargando ? 'Un momento...' : modo === 'login' ? 'Entrar' : modo === 'recuperar' ? 'Enviar link' : 'Crear cuenta'}
        </button>
      </form>

      {modo === 'login' && (
        <button
          onClick={() => { setModo('recuperar'); setError(''); setAviso('') }}
          className="w-full text-center font-body text-[12px] text-inksoft underline mb-3"
        >
          ¿Olvidaste tu contraseña?
        </button>
      )}

      <button
        onClick={() => {
          setModo(modo === 'login' ? 'registro' : 'login')
          setError('')
          setAviso('')
        }}
        className="w-full text-center font-body text-[13px] text-inksoft underline"
      >
        {modo === 'registro' || modo === 'recuperar' ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate'}
      </button>

      <Link href="/ayuda" className="block w-full text-center font-body text-[11px] text-inksoft underline mt-4">
        Centro de ayuda
      </Link>
    </div>
  )
}
