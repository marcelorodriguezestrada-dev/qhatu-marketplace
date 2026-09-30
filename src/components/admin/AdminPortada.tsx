'use client'

import { useEffect, useState } from 'react'
import { PORTADA_POR_DEFECTO, SECCIONES_PORTADA, cargarPortada, type ConfigPortada, type SeccionPortada } from '@/lib/portada'

// Admin → Banners: checklist de qué se ve en la portada.
export default function AdminPortada({ password }: { password: string }) {
  const [config, setConfig] = useState<ConfigPortada | null>(null)
  const [guardando, setGuardando] = useState<SeccionPortada | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarPortada(true).then(setConfig)
  }, [])

  async function cambiar(id: SeccionPortada, valor: boolean) {
    const anterior = config || PORTADA_POR_DEFECTO
    setConfig({ ...anterior, [id]: valor })
    setGuardando(id)
    setError('')
    try {
      const d = await fetch('/api/portada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ secciones: { [id]: valor } }),
      }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setConfig({ ...PORTADA_POR_DEFECTO, ...d.portada })
    } catch (err: any) {
      setConfig(anterior)
      setError(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-3.5 mb-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">Qué se ve en la portada</div>
      <div className="font-body text-[11px] text-inksoft mb-3">Tildá lo que querés mostrar. Se guarda solo y se nota en la página en menos de un minuto.</div>
      {!config ? (
        <div className="font-body text-xs text-inksoft">Cargando...</div>
      ) : (
        <div className="grid gap-2">
          {SECCIONES_PORTADA.map((s) => (
            <label key={s.id} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config[s.id]}
                disabled={guardando === s.id}
                onChange={(e) => cambiar(s.id, e.target.checked)}
                className="accent-teal mt-0.5 w-4 h-4"
              />
              <span className="font-body text-xs">
                <span className="text-ink font-medium">{s.label}</span>
                <span className={`ml-1.5 ${config[s.id] ? 'text-teal' : 'text-inksoft'}`}>{guardando === s.id ? '· guardando...' : config[s.id] ? '· visible' : '· oculto'}</span>
                <span className="block text-inksoft">{s.ayuda}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error && <div className="font-body text-xs text-maroon mt-2">{error}</div>}
    </div>
  )
}
