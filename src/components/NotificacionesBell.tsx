'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { track } from '@/lib/tracking'

type Notificacion = {
  id: string
  mensaje: string
  anuncioId?: string
  // A dónde lleva al tocarla (ej. cupones → la home). Sin link, como
  // antes: a /anuncios (las de macheo de anuncios).
  link?: string
  leida: boolean
  createdAt: string
}

// Se monta una vez por página (ver page.tsx, vender/page.tsx,
// mis-pedidos/page.tsx — los mismos lugares donde ya aparece "Mis
// pedidos" en el menú) — no hay un header compartido en todo el sitio
// todavía, así que por ahora vive en esos puntos de entrada donde los
// profesionales ya navegan seguido.
export function NotificacionesBell({ variante = 'clara' }: { variante?: 'clara' | 'oscura' }) {
  const { usuario, obtenerToken } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function cargar() {
    const token = await obtenerToken()
    if (!token) return
    setCargando(true)
    try {
      const res = await fetch('/api/notificaciones', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setNotificaciones(data.notificaciones || [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!usuario) return
    cargar()
    // Refresca cada 2 minutos mientras la pestaña está abierta — no
    // hace falta algo en tiempo real para esto, con que aparezca al
    // rato de que llegue alcanza.
    const interval = setInterval(cargar, 120000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function marcarLeida(id: string) {
    const n = notificaciones.find((x) => x.id === id) as any
    track('abrir_notificacion', { tipo: n?.tipo || '', cupon: n?.cuponCodigo || '' })
    const token = await obtenerToken()
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    fetch(`/api/notificaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ leida: true }),
    }).catch(() => {})
  }

  async function marcarTodasLeidas() {
    const token = await obtenerToken()
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ todasLeidas: true }),
    }).catch(() => {})
  }

  if (!usuario) return null

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`relative w-9 h-9 rounded-full border flex items-center justify-center text-base shrink-0 ${
          variante === 'oscura' ? 'border-white/25 bg-white/10' : 'border-line bg-panel'
        }`}
        aria-label="Notificaciones"
      >
        🔔
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-maroon text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          {/* En el celular el panel es fijo al ancho de la pantalla (así
              nunca queda cortado ni fuera de la vista); desde sm vuelve a
              colgar de la campanita. */}
          <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-80 bg-panel border border-line rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between p-3 border-b border-line">
              <span className="font-body text-sm font-semibold text-ink">Notificaciones</span>
              {noLeidas > 0 && (
                <button type="button" onClick={marcarTodasLeidas} className="font-body text-[11px] text-teal underline">
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {cargando && <div className="font-body text-xs text-inksoft p-3">Cargando...</div>}
            {!cargando && notificaciones.length === 0 && (
              <div className="font-body text-xs text-inksoft p-3">No tenés notificaciones todavía.</div>
            )}
            {notificaciones.map((n) => (
              <Link
                key={n.id}
                href={n.link || '/anuncios'}
                onClick={() => marcarLeida(n.id)}
                className={`block p-3 border-b border-line last:border-b-0 font-body text-xs ${n.leida ? 'text-inksoft' : 'text-ink bg-maroonsoft/30'}`}
              >
                <div>{n.mensaje}</div>
                <div className="text-[10px] text-inksoft mt-1">{new Date(n.createdAt).toLocaleDateString('es-BO')}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
