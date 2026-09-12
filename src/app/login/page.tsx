'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { validarWhatsappBoliviano } from '@/lib/validarWhatsapp'

const MENSAJES_FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/invalid-email': 'Ese email no es válido.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
}

export default function LoginPage() {
  const { usuario, emailVerificado, login, registrarse, recuperarPassword, obtenerToken, logout } = useAuth()
  const router = useRouter()

  // 'login' / 'registro' → formulario normal. 'verificar' → paso extra
  // obligatorio después de registrarse, antes de poder usar la cuenta.
  // 'recuperar' → pantalla de "te mandamos un link para resetear".
  const [modo, setModo] = useState<'login' | 'registro' | 'verificar' | 'recuperar'>('login')
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
      router.push('/')
      return
    }
    setEmail(usuario.email || '')
    setModo('verificar')
    if (!yaMandoCodigoAlLlegar.current) {
      yaMandoCodigoAlLlegar.current = true
      enviarCodigoAlMail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, emailVerificado, modo])

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
        await fetch('/api/usuarios/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ celular }),
        })
      }
      await enviarCodigoAlMail()
      setModo('verificar')
    } catch (err: any) {
      setError(MENSAJES_FIREBASE[err?.code] || err?.message || 'Ocurrió un error. Probá de nuevo.')
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
      router.push('/')
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
        <button
          onClick={() => { logout(); setModo('login'); setCodigo(''); setAviso(''); setError('') }}
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
    </div>
  )
}
