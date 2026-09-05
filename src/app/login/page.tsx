'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login, registrarse } = useAuth()
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      if (modo === 'login') {
        await login(email, password)
      } else {
        await registrarse(email, password)
      }
      router.push('/')
    } catch (err: any) {
      // Traducimos los errores más comunes de Firebase Auth a algo legible.
      const codigo = err?.code || ''
      const mensajes: Record<string, string> = {
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
        'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
        'auth/invalid-email': 'Ese email no es válido.',
      }
      setError(mensajes[codigo] || err?.message || 'Ocurrió un error. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="max-w-[360px] mx-auto px-5 py-20">
      <div className="font-display text-xl font-bold text-ink mb-1">
        {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </div>
      <div className="font-body text-[13px] text-inksoft mb-6">
        {modo === 'login' ? 'Para comprar y vender en Clasi Click' : 'Con tu cuenta ya podés publicar productos'}
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
          minLength={6}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
        <button
          type="submit"
          disabled={cargando}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold mb-3"
        >
          {cargando ? 'Un momento...' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <button
        onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
        className="w-full text-center font-body text-[13px] text-inksoft underline"
      >
        {modo === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
      </button>
    </div>
  )
}
