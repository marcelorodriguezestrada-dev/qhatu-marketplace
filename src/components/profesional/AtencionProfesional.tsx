'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useCiudad, useTodasLasCiudades } from '@/lib/ciudad'
import { CampoCiudad } from '@/components/SelectorCiudad'
import { buscarCiudad, ciudadDe, zonasDeCiudad, type CiudadId } from '@/data/ciudades'

// Mi perfil → "📍 Dónde y cómo atendés": ciudad, zona y forma de
// atención (presencial / online / viaja a otras ciudades). Online hace
// que el perfil aparezca en todas las ciudades.
export default function AtencionProfesional({ profesional, onGuardado }: { profesional: any; onGuardado: (cambios: Record<string, any>) => void }) {
  const ciudadesTodas = useTodasLasCiudades()
  const { obtenerToken } = useAuth()
  const { multiciudad } = useCiudad()
  const [ciudad, setCiudad] = useState<CiudadId>(ciudadDe(profesional))
  const [zona, setZona] = useState<string>(profesional.zona || '')
  const [presencial, setPresencial] = useState(profesional.atiendePresencial !== false)
  const [online, setOnline] = useState(profesional.atiendeOnline === true)
  const [viajaA, setViajaA] = useState<CiudadId[]>(Array.isArray(profesional.viajaA) ? profesional.viajaA : [])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const zonas = zonasDeCiudad(ciudad)
  const cambioCiudad = ciudad !== ciudadDe(profesional)

  async function guardar() {
    if (!presencial && !online) { setMensaje('Marcá presencial, online o las dos.'); return }
    setGuardando(true)
    setMensaje('')
    try {
      const token = await obtenerToken()
      const cambios = { ciudad, zona, atiendePresencial: presencial, atiendeOnline: online, viajaA }
      const res = await fetch(`/api/profesionales/${profesional.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cambios),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || 'No se pudo guardar.')
      onGuardado(cambios)
      setMensaje('Guardado ✓')
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4 mb-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">📍 Dónde y cómo atendés</div>
      <div className="font-body text-[12px] text-inksoft mb-3">
        {multiciudad ? 'Te buscan por ciudad. Si atendés online, tu perfil aparece en todas.' : `Ciudad: ${buscarCiudad(ciudad).nombre}. Si atendés online, marcalo: te van a encontrar también desde otras ciudades.`}
      </div>
      <CampoCiudad value={ciudad} onChange={(c) => { setCiudad(c); setViajaA((v) => v.filter((x) => x !== c)) }} etiqueta="Ciudad" className="mb-3" />
      <label className="block font-body text-xs text-ink mb-3">
        <span className="block font-semibold mb-1">Zona / barrio</span>
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          list={`zonas-${ciudad}`}
          placeholder={cambioCiudad ? `Ej: ${zonas[0]}` : 'Tu zona o barrio'}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
        />
        <datalist id={`zonas-${ciudad}`}>
          {zonas.map((z) => <option key={z} value={z} />)}
        </datalist>
      </label>
      <label className="flex items-center gap-2 font-body text-sm text-ink mb-1.5 cursor-pointer">
        <input type="checkbox" checked={presencial} onChange={(e) => setPresencial(e.target.checked)} className="accent-teal" />
        🏢 Presencial
      </label>
      <label className="flex items-center gap-2 font-body text-sm text-ink mb-2 cursor-pointer">
        <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="accent-teal" />
        💻 Online / videollamada
      </label>
      {multiciudad && (
        <div className="mb-2">
          <div className="font-body text-xs text-inksoft mb-1">🚗 También viajo a atender a:</div>
          <div className="flex flex-wrap gap-3">
            {ciudadesTodas.filter((c) => c.id !== ciudad).map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 font-body text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={viajaA.includes(c.id)} onChange={(e) => setViajaA((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))} className="accent-teal" />
                {c.nombre}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-teal text-white font-body text-sm font-semibold disabled:opacity-60">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        {mensaje && <span className="font-body text-xs text-ink">{mensaje}</span>}
      </div>
    </div>
  )
}
