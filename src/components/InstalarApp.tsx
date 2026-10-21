'use client'

import { useEffect, useState } from 'react'
import { MarcaClasiClick } from '@/components/LogoClasiClick'

// Registra el service worker (public/sw.js) y, en Android, ofrece instalar
// Clasi Click como app cuando Chrome lo permite ("beforeinstallprompt").
// Si la cierran, no se vuelve a ofrecer por 14 días.
const CLAVE = 'clasiclick_instalar_cerrado'

export default function InstalarApp() {
  const [evento, setEvento] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const alOfrecer = (e: Event) => {
      e.preventDefault()
      setEvento(e)
      let cerrado = 0
      try { cerrado = Number(localStorage.getItem(CLAVE) || 0) } catch {}
      // No en el admin (lo usás en la compu) ni si la cerraron hace poco.
      if (Date.now() - cerrado > 14 * 86_400_000 && !location.pathname.startsWith('/admin')) setVisible(true)
    }
    const alInstalar = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', alOfrecer)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alOfrecer)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (!visible || !evento) return null
  const cerrar = () => {
    setVisible(false)
    try { localStorage.setItem(CLAVE, String(Date.now())) } catch {}
  }
  const instalar = async () => {
    evento.prompt()
    const r = await evento.userChoice.catch(() => null)
    if (r?.outcome !== 'accepted') cerrar()
    setVisible(false)
  }
  return (
    <div className="fixed bottom-3 left-3 right-3 z-[60] mx-auto max-w-md bg-ink text-white rounded-xl shadow-lg p-3 flex items-center gap-3" role="dialog" aria-label="Instalar la app">
      <MarcaClasiClick size={40} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm font-bold">Instalá la app de Clasi Click</div>
        <div className="font-body text-[11px] text-white/70">Abrila desde tu pantalla de inicio, más rápido.</div>
      </div>
      <button onClick={instalar} className="px-3 py-2 rounded-lg bg-[#16C35B] text-ink font-body text-xs font-bold border-none">Instalar</button>
      <button onClick={cerrar} aria-label="Cerrar" className="text-white/60 text-lg leading-none px-1 bg-transparent border-none">×</button>
    </div>
  )
}
