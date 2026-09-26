'use client'

import { useState } from 'react'
import { entrarComoUsuario } from '@/lib/modoAdmin'

// Admin → Usuarios → "➕ Crear usuario": da de alta una cuenta (sin
// contraseña), le arma la tienda si se completa, y devuelve un link para
// que la persona elija su contraseña — se lo mandás por WhatsApp.
// Desde acá mismo podés "entrar como" ese usuario para cargarle los
// productos.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasiclick.ezeti.pro').replace(/\/$/, '')

export function mensajeAcceso(d: { nombre?: string | null; negocio?: string | null; email: string; link: string | null }) {
  const hola = d.nombre ? `¡Hola ${d.nombre}! 👋` : '¡Hola! 👋'
  const tienda = d.negocio ? `tu tienda *${d.negocio}*` : 'tu cuenta'
  return (
    `${hola}\n\nYa creamos ${tienda} en *Clasi Click* 🛍️\n\n` +
    (d.link ? `Para entrar, elegí tu contraseña acá 👉 ${d.link}\n\n` : '') +
    `Tu usuario es: ${d.email}\n` +
    `Después entrás en ${SITE}/login\n\n` +
    `(Si el link venció, en ${SITE}/login tocá "¿Olvidaste tu contraseña?" y te llega uno nuevo al correo.)`
  )
}

export function abrirWhatsapp(numero: string | null | undefined, texto: string) {
  const n = String(numero || '').replace(/\D/g, '')
  const url = n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`
  window.open(url, '_blank')
}

type Creado = { uid: string; email: string; whatsapp: string; link: string | null; nombre: string; negocio: string }

export default function CrearUsuario({ password, onCreado }: { password: string; onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [negocio, setNegocio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [creado, setCreado] = useState<Creado | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [entrando, setEntrando] = useState(false)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ email, nombre, whatsapp, nombreNegocio: negocio }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo crear el usuario.')
      setCreado({ uid: d.uid, email: d.email, whatsapp: d.whatsapp, link: d.link, nombre, negocio })
      setEmail(''); setNombre(''); setWhatsapp(''); setNegocio('')
      onCreado()
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  async function entrar(uid: string) {
    if (!confirm('Vas a entrar a la cuenta de este vendedor en esta pestaña para cargarle la tienda y los productos. Si tenías tu propia sesión abierta en el sitio, se cierra. ¿Seguir?')) return
    setEntrando(true)
    try {
      await entrarComoUsuario(uid, password)
    } catch (err: any) {
      alert(err?.message || 'No se pudo entrar.')
      setEntrando(false)
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold mb-4">
        ➕ Crear usuario
      </button>
    )
  }

  return (
    <div className="bg-panel border border-teal rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-body text-sm font-semibold text-ink">➕ Crear usuario / vendedor</div>
        <button type="button" onClick={() => { setAbierto(false); setCreado(null) }} className="font-body text-xs text-inksoft">Cerrar ✕</button>
      </div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        La cuenta se crea sin contraseña: la persona la elige con el link que le mandás por WhatsApp. Después podés entrar a su cuenta para cargarle los productos.
      </div>

      {creado ? (
        <div className="bg-tealsoft border border-teal rounded-lg p-3">
          <div className="font-body text-sm font-semibold text-teal mb-1">✓ Cuenta creada: {creado.email}</div>
          {!creado.link && (
            <div className="font-body text-xs text-maroon mb-2">No se pudo generar el link de contraseña. Decile que entre a /login y toque “¿Olvidaste tu contraseña?”.</div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => entrar(creado.uid)} disabled={entrando} className="px-3 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-60">
              {entrando ? 'Entrando...' : '🛍️ Cargarle productos ahora'}
            </button>
            <button
              type="button"
              onClick={() => abrirWhatsapp(creado.whatsapp, mensajeAcceso({ nombre: creado.nombre, negocio: creado.negocio, email: creado.email, link: creado.link }))}
              className="px-3 py-2 rounded-lg border-none bg-[#25D366] text-white font-body text-xs font-semibold"
            >
              💬 Enviar acceso por WhatsApp
            </button>
            {creado.link && (
              <button
                type="button"
                onClick={async () => { try { await navigator.clipboard.writeText(creado.link!); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {} }}
                className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink"
              >
                {copiado ? '✓ Copiado' : '📋 Copiar link de contraseña'}
              </button>
            )}
            <button type="button" onClick={() => setCreado(null)} className="px-3 py-2 rounded-lg border border-line font-body text-xs text-ink">Crear otro</button>
          </div>
          <div className="font-body text-[10px] text-inksoft mt-2">
            El link vence en 1 hora. Si lo mandás más tarde, usá “🔑 Enviar acceso” en la lista de usuarios, que genera uno nuevo.
          </div>
        </div>
      ) : (
        <form onSubmit={crear} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="font-body text-xs text-ink">
            <span className="block font-semibold mb-1">Email *</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendedor@gmail.com" className={input} />
          </label>
          <label className="font-body text-xs text-ink">
            <span className="block font-semibold mb-1">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Doña Rosa" className={input} />
          </label>
          <label className="font-body text-xs text-ink">
            <span className="block font-semibold mb-1">WhatsApp</span>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="71234567" inputMode="tel" className={input} />
          </label>
          <label className="font-body text-xs text-ink">
            <span className="block font-semibold mb-1">Nombre de la tienda (opcional)</span>
            <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Zapatería Doña Rosa" className={input} />
          </label>
          {error && <div className="sm:col-span-2 font-body text-xs text-maroon">{error}</div>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold disabled:opacity-60">
              {guardando ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
