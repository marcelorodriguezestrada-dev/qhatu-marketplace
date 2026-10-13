'use client'

import { useState } from 'react'
import { linkWhatsapp } from '@/lib/prospectos'

// "📦 Pedir productos y precios": la IA arma el WhatsApp con una
// plantilla para que la tienda (o el cliente) complete productos y
// precios. El admin puede escribir lo que necesita y la IA lo estructura.
// Se usa en Admin → Captar tiendas (ficha) y Admin → Usuarios.

const EJEMPLOS = [
  'Pedile 10 productos con foto, precio y talles',
  'Necesito sus precios por mayor y por menor',
  'Que me mande su catálogo de temporada con stock',
  'Cotizar 20 poleras estampadas para un colegio',
]

export default function PedirProductosIA({
  password,
  nombre,
  contacto,
  rubro,
  ciudad,
  whatsapp,
  onEnviado,
}: {
  password: string
  nombre?: string
  contacto?: string
  rubro?: string
  ciudad?: string
  whatsapp?: string
  onEnviado?: (texto: string) => void
}) {
  const [tipo, setTipo] = useState<'tienda' | 'cliente'>('tienda')
  const [requerimiento, setRequerimiento] = useState('')
  const [cargando, setCargando] = useState(false)
  const [res, setRes] = useState<{ mensaje: string; plantilla: string; consejos: string[]; ia: boolean } | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState('')
  const [error, setError] = useState('')

  async function armar() {
    setCargando(true)
    setError('')
    try {
      const r = await fetch('/api/admin/pedir-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ nombre, contacto, rubro, ciudad, requerimiento, tipo }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo armar el mensaje.')
      setRes(d)
      setMensaje(d.mensaje)
    } catch (e: any) {
      setError(e?.message || 'No se pudo armar el mensaje.')
    } finally {
      setCargando(false)
    }
  }

  function copiar(texto: string, cual: string) {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(cual); setTimeout(() => setCopiado(''), 1500) }).catch(() => {})
  }

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3">
      <div className="font-body text-sm font-semibold text-ink mb-0.5">📦 Pedir productos y precios</div>
      <div className="font-body text-[11px] text-inksoft mb-2">La IA arma un WhatsApp con una plantilla fácil de completar desde el celular. Escribí lo que necesitás y la armamos a tu medida.</div>
      <div className="flex gap-1.5 mb-2">
        {([['tienda', '🏪 Tienda: su catálogo'], ['cliente', '🛒 Cliente: cotizar lo que busca']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTipo(id)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] font-semibold ${tipo === id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={requerimiento}
        onChange={(e) => setRequerimiento(e.target.value)}
        rows={2}
        placeholder="Tu requerimiento (opcional). Ej: necesito sus precios por mayor y fotos de 10 productos"
        className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs mb-1.5"
      />
      <div className="flex flex-wrap gap-1 mb-2">
        {EJEMPLOS.map((e) => (
          <button key={e} type="button" onClick={() => setRequerimiento(e)} className="px-2 py-0.5 rounded-full border border-line bg-panel font-body text-[10px] text-inksoft">{e}</button>
        ))}
      </div>
      <button type="button" onClick={armar} disabled={cargando} className="px-3.5 py-2 rounded-lg border-none bg-indigo-600 text-white font-body text-xs font-semibold disabled:opacity-50">
        {cargando ? 'Armando el mensaje…' : res ? '✨ Volver a armar' : '✨ Armar mensaje con IA'}
      </button>
      {error && <div className="font-body text-xs text-maroon mt-2">{error}</div>}

      {res && (
        <div className="mt-3 grid gap-2">
          {!res.ia && <div className="font-body text-[11px] text-ochre">La IA no respondió: te dejé el mensaje con la plantilla de siempre (podés editarlo).</div>}
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={12} className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-body text-xs whitespace-pre-wrap" />
          <div className="flex flex-wrap gap-2">
            <a
              href={linkWhatsapp(whatsapp || '', mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onEnviado?.(mensaje)}
              className="px-3 py-1.5 rounded-md bg-[#25D366] !text-white font-body text-xs font-semibold no-underline"
            >
              💬 Enviar por WhatsApp{whatsapp ? '' : ' (elegir contacto)'}
            </a>
            <button type="button" onClick={() => copiar(mensaje, 'mensaje')} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">{copiado === 'mensaje' ? '✓ Copiado' : '📋 Copiar mensaje'}</button>
            <button type="button" onClick={() => copiar(res.plantilla, 'plantilla')} className="px-3 py-1.5 rounded-md border border-line bg-panel font-body text-xs">{copiado === 'plantilla' ? '✓ Copiada' : '🧾 Copiar solo la plantilla'}</button>
          </div>
          {res.consejos.length > 0 && (
            <ul className="font-body text-[11px] text-inksoft pl-4 m-0 grid gap-0.5">
              {res.consejos.map((c, i) => <li key={i}>💡 {c}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
