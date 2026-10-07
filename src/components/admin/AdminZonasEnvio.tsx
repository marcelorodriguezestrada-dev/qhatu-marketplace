'use client'

import { useEffect, useState } from 'react'

// Admin → Zonas de envío. Las zonas que escriben los compradores con la
// casa marcada en el mapa (y no están en la lista) aparecen acá con
// cuántos pedidos tuvieron y dónde quedan; "Agregar" las suma a la lista
// del checkout en ese punto (promedio de los pedidos).

type Sugerida = { id: string; nombre: string; pedidos: number; lat: number; lng: number; cercana: string; ultimoPedido: string | null }
type Extra = { nombre: string; lat: number; lng: number; agregadaSola?: boolean }

export default function AdminZonasEnvio({ password }: { password: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [sugeridas, setSugeridas] = useState<Sugerida[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [cargando, setCargando] = useState(true)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    const d = await fetch('/api/admin/zonas', { headers }).then((r) => r.json()).catch(() => ({}))
    setSugeridas(d.sugeridas || [])
    setExtras(d.extras || [])
    setCargando(false)
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function accion(body: Record<string, unknown>) {
    setError('')
    const d = await fetch('/api/admin/zonas', { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ error: 'No se pudo guardar.' }))
    if (d.error) setError(d.error)
    cargar()
  }

  const mapa = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  return (
    <div>
      <div className="font-display text-lg font-bold text-ink mb-1">Zonas de envío</div>
      <div className="font-body text-xs text-inksoft mb-4">
        Cuando un comprador marca su casa en el mapa y escribe una zona que no está en la lista, aparece acá. El envío ya se le cobró según la distancia de su casa al centro; agregarla solo hace que la próxima vez aparezca en la lista.
      </div>
      {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}

      <div className="font-body text-sm font-semibold text-ink mb-2">Zonas sugeridas por compradores</div>
      {cargando ? (
        <div className="font-body text-xs text-inksoft mb-6">Cargando...</div>
      ) : sugeridas.length === 0 ? (
        <div className="font-body text-xs text-inksoft mb-6 bg-panelalt rounded-lg p-3">Todavía no hay zonas sugeridas.</div>
      ) : (
        <div className="grid gap-2 mb-6">
          {sugeridas.map((s) => (
            <div key={s.id} className="bg-panel border border-line rounded-lg p-3 flex flex-wrap items-center gap-2">
              <input
                value={nombres[s.id] ?? s.nombre}
                onChange={(e) => setNombres((n) => ({ ...n, [s.id]: e.target.value }))}
                className="px-2.5 py-1.5 rounded-md border border-line font-body text-sm font-semibold min-w-[180px]"
                aria-label="Nombre de la zona"
              />
              <span className="font-body text-[11px] text-inksoft">
                {s.pedidos} pedido{s.pedidos === 1 ? '' : 's'} · cerca de {s.cercana} · <a href={mapa(s.lat, s.lng)} target="_blank" rel="noreferrer" className="text-teal underline">ver en el mapa</a>
              </span>
              <span className="flex-1" />
              <button type="button" onClick={() => accion({ accion: 'agregar', id: s.id, nombre: (nombres[s.id] ?? s.nombre).trim(), lat: s.lat, lng: s.lng })} className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold">
                ✓ Agregar a la lista
              </button>
              <button type="button" onClick={() => accion({ accion: 'descartar', id: s.id })} className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">
                Descartar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="font-body text-sm font-semibold text-ink mb-1">Zonas agregadas</div>
      <div className="font-body text-[11px] text-inksoft mb-2">Las que agregás vos, y las que se suman solas cuando 3 pedidos con la casa marcada escriben la misma zona en el mismo lugar (🤖).</div>
      {extras.length === 0 ? (
        <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg p-3">Ninguna todavía (la lista tiene las zonas de siempre).</div>
      ) : (
        <div className="grid gap-1.5">
          {extras.map((z) => (
            <div key={z.nombre} className="flex items-center gap-2 font-body text-sm">
              <span className="text-ink">{z.nombre}</span>
              {z.agregadaSola && <span className="text-[11px] text-indigo-700" title="Se agregó sola por los pedidos">🤖</span>}
              <a href={mapa(z.lat, z.lng)} target="_blank" rel="noreferrer" className="text-[11px] text-teal underline">mapa</a>
              <button type="button" onClick={() => { if (confirm(`¿Quitar la zona ${z.nombre} de la lista?`)) accion({ accion: 'quitar', nombre: z.nombre }) }} className="text-[11px] text-maroon underline">quitar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
