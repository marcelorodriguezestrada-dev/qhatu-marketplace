'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTodasLasCiudades } from '@/lib/ciudad'
import { buscarCiudad } from '@/data/ciudades'
import { proximasFechas, type FechaAdmin } from '@/lib/fechasEspeciales'

// Admin → Marketing: fechas propias (aniversario de la ciudad, ferias...)
// que aparecen en la "🎯 Estrategia con IA" de las tiendas, junto a las
// fijas (Día de la Madre, Navidad...). Se repiten todos los años.

const hoyBolivia = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)

export default function FechasEspecialesAdmin({ password }: { password: string }) {
  const ciudades = useTodasLasCiudades()
  const [fechas, setFechas] = useState<FechaAdmin[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [emoji, setEmoji] = useState('📅')
  const [idea, setIdea] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  async function cargar() {
    const d = await fetch('/api/admin/fechas-marketing', { headers }).then((r) => r.json()).catch(() => ({}))
    setFechas(d.fechas || [])
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  // Lo que ve hoy una tienda de Bolivia y una de Argentina (fijas + las del admin).
  const vista = useMemo(() => {
    const hoy = hoyBolivia()
    return (['BO', 'AR'] as const).map((pais) => ({ pais, lista: proximasFechas(pais, '', hoy, (fechas || []).filter((f) => !f.ciudad || buscarCiudad(f.ciudad).pais === pais).map((f) => ({ ...f, ciudad: '' }))) }))
  }, [fechas])

  async function agregar() {
    setError('')
    if (!nombre.trim() || !fecha) return setError('Poné el nombre y la fecha.')
    setGuardando(true)
    try {
      const res = await fetch('/api/admin/fechas-marketing', { method: 'POST', headers, body: JSON.stringify({ nombre, mmdd: fecha.slice(5), emoji, idea, ciudad }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar.')
      setNombre('')
      setFecha('')
      setIdea('')
      await cargar()
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta fecha?')) return
    await fetch(`/api/admin/fechas-marketing?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers }).catch(() => null)
    cargar()
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">🎉 Fechas especiales para las tiendas</div>
      <div className="font-body text-[12px] text-inksoft mb-4">
        Aparecen en Vender → Marketing → “🎯 Estrategia con IA” cuando faltan menos de 75 días. Las de siempre (Día de la Madre, Navidad, Black Friday...) ya están; acá sumás las tuyas, que se repiten cada año.
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {vista.map((v) => (
          <div key={v.pais} className="bg-panelalt rounded-lg p-3">
            <div className="font-body text-xs font-semibold text-ink mb-1.5">Próximas en {v.pais === 'BO' ? '🇧🇴 Bolivia' : '🇦🇷 Argentina'}</div>
            {v.lista.length === 0 ? (
              <div className="font-body text-[12px] text-inksoft">Ninguna en los próximos 75 días.</div>
            ) : (
              v.lista.map((f) => (
                <div key={f.id} className="font-body text-[12px] text-ink">
                  {f.emoji} {f.nombre} <span className="text-inksoft">· {f.fecha.slice(8)}/{f.fecha.slice(5, 7)} · faltan {f.faltan} días</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <div className="font-body text-xs font-semibold text-ink mb-2">Tus fechas</div>
      {fechas === null ? (
        <div className="font-body text-xs text-inksoft mb-3">Cargando...</div>
      ) : fechas.length === 0 ? (
        <div className="font-body text-xs text-inksoft mb-3">Todavía no agregaste ninguna.</div>
      ) : (
        <div className="grid gap-1.5 mb-3">
          {fechas.map((f) => (
            <div key={f.id} className="flex items-center gap-2 bg-panelalt rounded-lg px-3 py-2">
              <span className="font-body text-sm">{f.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm text-ink">{f.nombre} <span className="text-inksoft text-[12px]">· {f.mmdd.slice(3)}/{f.mmdd.slice(0, 2)} · {f.ciudad ? buscarCiudad(f.ciudad).nombre : 'Todas las ciudades'}</span></div>
                {f.idea && <div className="font-body text-[11px] text-inksoft truncate">{f.idea}</div>}
              </div>
              <button type="button" onClick={() => borrar(f.id)} className="font-body text-xs text-maroon">Borrar</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-[70px_1fr_160px_180px] gap-2 mb-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 8))} aria-label="Emoji" className="px-2 py-2 rounded-lg border border-line bg-panel font-body text-sm text-center" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Aniversario de Potosí" className="px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm" />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha (se repite cada año)" className="px-2 py-2 rounded-lg border border-line bg-panel font-body text-sm" />
        <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} aria-label="Ciudad" className="px-2 py-2 rounded-lg border border-line bg-panel font-body text-sm">
          <option value="">Todas las ciudades</option>
          {ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Qué se suele vender (opcional, ayuda a la IA): ej. ropa típica, banderas, artículos de fiesta" className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm mb-2" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={agregar} disabled={guardando} className="px-4 py-2 rounded-lg border-none bg-ink text-white font-body text-xs font-semibold disabled:opacity-60">
          {guardando ? 'Guardando...' : '➕ Agregar fecha'}
        </button>
        <span className="font-body text-[11px] text-inksoft">Del año solo se usa el día y el mes.</span>
      </div>
      {error && <div className="font-body text-xs text-maroon mt-2">{error}</div>}
    </div>
  )
}
