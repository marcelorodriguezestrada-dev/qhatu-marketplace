'use client'

import { useState } from 'react'
import { useTodasLasCiudades } from '@/lib/ciudad'
import { buscarCiudad } from '@/data/ciudades'
import { banderaDe } from '@/data/paisesMercado'
import { generarPassword } from '@/components/admin/CrearUsuario'

// Admin → Usuarios → "🧪 Crear usuario de prueba": una cuenta de prueba
// para una ciudad (también las que están "en prueba", ej. Buenos Aires).
// Con ella se ve esa ciudad, se compra a cualquier hora y el checkout
// arranca con su casa de prueba (la dirección de acá, ubicada en el mapa).

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.clasiclick.com').replace(/\/$/, '')
const input = 'w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-sm'

export default function CrearUsuarioPrueba({ password, onCreado }: { password: string; onCreado: () => void }) {
  const ciudades = useTodasLasCiudades()
  const [abierto, setAbierto] = useState(false)
  const [ciudad, setCiudad] = useState('potosi')
  const [email, setEmail] = useState('test-potosi@test.com')
  const [clave, setClave] = useState(() => generarPassword())
  const [direccion, setDireccion] = useState('Fortunato Gumiel 20')
  const [zona, setZona] = useState('Cuarto Centenario')
  const [punto, setPunto] = useState<{ lat: number; lng: number; nombre: string } | null>({ lat: -19.5797, lng: -65.7618, nombre: 'Fortunato Gumiel 20, Potosí' })
  const [ocupado, setOcupado] = useState<'' | 'ubicar' | 'crear'>('')
  const [error, setError] = useState('')
  const [creado, setCreado] = useState<{ email: string; clave: string; ciudad: string; direccion: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  function elegirCiudad(id: string) {
    const c = buscarCiudad(id)
    setCiudad(c.id)
    setEmail(`test-${c.id}@test.com`)
    setDireccion(c.id === 'potosi' ? 'Fortunato Gumiel 20' : c.centro.nombre)
    setZona(c.id === 'potosi' ? 'Cuarto Centenario' : '')
    setPunto(c.id === 'potosi' ? { lat: -19.5797, lng: -65.7618, nombre: 'Fortunato Gumiel 20, Potosí' } : { lat: c.centro.lat, lng: c.centro.lng, nombre: `${c.centro.nombre} (centro de ${c.nombre})` })
    setError('')
  }

  async function ubicar() {
    const c = buscarCiudad(ciudad)
    setOcupado('ubicar')
    setError('')
    try {
      const res = await fetch('/api/admin/ciudades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ accion: 'ubicar', q: `${direccion}, ${c.nombre}`, pais: c.pais }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No la encontramos en el mapa.')
      setPunto(d)
    } catch (err: any) {
      setError(err?.message || 'No la encontramos en el mapa.')
      setPunto(null)
    } finally {
      setOcupado('')
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!punto) return
    setOcupado('crear')
    setError('')
    try {
      const c = buscarCiudad(ciudad)
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ email, nombre: `Prueba ${c.nombre}`, password: clave, ciudad, esPrueba: true, ubicacionPrueba: { lat: punto.lat, lng: punto.lng, direccion, zona } }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo crear.')
      setCreado({ email: d.email, clave, ciudad: c.nombre, direccion })
      setClave(generarPassword())
      onCreado()
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear.')
    } finally {
      setOcupado('')
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 font-body text-xs font-semibold mb-4 ml-2">
        🧪 Crear usuario de prueba
      </button>
    )
  }

  const textoAcceso = creado ? `Usuario de prueba (${creado.ciudad})\nEmail: ${creado.email}\nContraseña: ${creado.clave}\nCasa de prueba: ${creado.direccion}\nEntrar: ${SITE}/login` : ''

  return (
    <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-body text-sm font-semibold text-ink">🧪 Crear usuario de prueba</div>
        <button type="button" onClick={() => { setAbierto(false); setCreado(null) }} className="font-body text-xs text-inksoft">Cerrar ✕</button>
      </div>
      <div className="font-body text-[11px] text-inksoft mb-3">
        Ve la ciudad elegida (aunque esté “en prueba”), compra a cualquier hora y el checkout arranca con esta casa de prueba. Sus pedidos quedan marcados como prueba.
      </div>

      {creado ? (
        <div className="grid gap-2">
          <pre className="whitespace-pre-wrap bg-panel border border-line rounded-lg p-3 font-body text-xs text-ink">{textoAcceso}</pre>
          <div className="flex gap-2">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(textoAcceso); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }} className="px-3 py-1.5 rounded-md border-none bg-ink text-white font-body text-xs font-semibold">
              {copiado ? '✓ Copiado' : '📋 Copiar datos'}
            </button>
            <button type="button" onClick={() => setCreado(null)} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">Crear otro</button>
          </div>
          <div className="font-body text-[11px] text-inksoft">Entrá con estos datos en otra ventana (o en modo incógnito) para no cerrar tu sesión de admin.</div>
        </div>
      ) : (
        <form onSubmit={crear} className="grid gap-2.5">
          <label className="block font-body text-xs text-ink">
            <span className="block font-semibold mb-1">Ciudad</span>
            <select value={ciudad} onChange={(e) => elegirCiudad(e.target.value)} className={input}>
              {ciudades.map((c) => <option key={c.id} value={c.id}>{banderaDe(c.pais)} {c.nombre}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block font-body text-xs text-ink">
              <span className="block font-semibold mb-1">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} className={input} />
            </label>
            <label className="block font-body text-xs text-ink">
              <span className="block font-semibold mb-1">Contraseña</span>
              <input value={clave} onChange={(e) => setClave(e.target.value)} className={input} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block font-body text-xs text-ink">
              <span className="block font-semibold mb-1">Casa de prueba (dirección)</span>
              <input value={direccion} onChange={(e) => { setDireccion(e.target.value); setPunto(null) }} placeholder="Ej: Av. Corrientes 1234" className={input} />
            </label>
            <label className="block font-body text-xs text-ink">
              <span className="block font-semibold mb-1">Barrio / zona</span>
              <input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej: San Nicolás" className={input} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={ubicar} disabled={!direccion.trim() || ocupado !== ''} className="px-3 py-1.5 rounded-md border border-teal bg-tealsoft text-teal font-body text-xs font-semibold disabled:opacity-50">
              {ocupado === 'ubicar' ? 'Buscando...' : '📍 Ubicar en el mapa'}
            </button>
            {punto ? (
              <a href={`https://www.openstreetmap.org/?mlat=${punto.lat}&mlon=${punto.lng}#map=17/${punto.lat}/${punto.lng}`} target="_blank" rel="noreferrer" className="font-body text-[11px] text-teal underline">
                ✓ {punto.nombre} — ver en el mapa
              </a>
            ) : (
              <span className="font-body text-[11px] text-inksoft">Ubicá la dirección en el mapa para poder crearla.</span>
            )}
          </div>
          {error && <div className="font-body text-xs text-maroon">{error}</div>}
          <button type="submit" disabled={!punto || !email || clave.length < 6 || ocupado !== ''} className="w-full py-2.5 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-40">
            {ocupado === 'crear' ? 'Creando...' : 'Crear usuario de prueba'}
          </button>
        </form>
      )}
    </div>
  )
}
