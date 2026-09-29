'use client'

import { useEffect, useState } from 'react'
import { cargarCiudades, type CiudadPublica } from '@/lib/ciudad'

// Admin → Inicio → "🏙️ Ciudades": abrir/cerrar ciudades (el selector
// "📍 Ciudad" y el cartel "¿Dónde estás?" aparecen recién con 2 o más
// abiertas) y si cada una tiene envío de Clasi Click.
export default function AdminCiudades({ password }: { password: string }) {
  const [ciudades, setCiudades] = useState<CiudadPublica[] | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarCiudades(true).then(setCiudades)
  }, [])

  async function cambiar(c: CiudadPublica, campo: 'activa' | 'envioClasiClick', valor: boolean) {
    if (campo === 'activa' && valor && !confirm(`¿Abrir ${c.nombre}? A los compradores les va a aparecer el selector de ciudad y el cartel "¿Dónde estás?".`)) return
    setGuardando(c.id + campo)
    setMensaje('')
    try {
      const d = await fetch('/api/ciudades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ ciudades: { [c.id]: { [campo]: valor } } }),
      }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setCiudades(await cargarCiudades(true))
      setMensaje('Guardado ✓ (en el sitio se ve en hasta 5 minutos)')
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4 mb-6">
      <div className="font-body text-sm font-semibold text-ink mb-1">🏙️ Ciudades</div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        Con una sola ciudad abierta, el sitio se ve igual que siempre. Al abrir otra, aparece el selector “📍 Ciudad” arriba y, la primera vez, el cartel “¿Dónde estás?”.
      </div>
      {!ciudades ? (
        <div className="font-body text-xs text-inksoft">Cargando...</div>
      ) : (
        <div className="grid gap-2">
          {ciudades.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5 rounded-lg bg-panelalt font-body text-sm text-ink">
              <span className="font-semibold w-24">{c.nombre}</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.activa}
                  disabled={c.id === 'potosi' || guardando === c.id + 'activa'}
                  onChange={(e) => cambiar(c, 'activa', e.target.checked)}
                  className="accent-teal"
                />
                Abierta
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer" title="Tus envíos (el comprador te paga a tu QR). Los envíos de cada vendedor se configuran aparte.">
                <input
                  type="checkbox"
                  checked={c.envioClasiClick}
                  disabled={guardando === c.id + 'envioClasiClick'}
                  onChange={(e) => cambiar(c, 'envioClasiClick', e.target.checked)}
                  className="accent-teal"
                />
                Envío Clasi Click
              </label>
              {c.id === 'potosi' && <span className="text-[11px] text-inksoft">(siempre abierta)</span>}
            </div>
          ))}
        </div>
      )}
      {mensaje && <div className="font-body text-xs text-teal mt-2">{mensaje}</div>}
      <div className="font-body text-[10px] text-inksoft mt-2">El check “Envío Clasi Click” queda guardado; el checkout lo va a usar en el próximo paso (envíos por ciudad).</div>
    </div>
  )
}
