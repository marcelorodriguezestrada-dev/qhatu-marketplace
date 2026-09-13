'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { TIPOS_ANUNCIO } from '@/data/anuncios'
import { PAISES, PAIS_FALLBACK_ID } from '@/data/paises'

export default function PublicarAnuncioPage() {
  const { usuario, cargando, obtenerToken } = useAuth()

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState(TIPOS_ANUNCIO[0].id)
  const [precio, setPrecio] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappPais, setWhatsappPais] = useState(PAIS_FALLBACK_ID)
  const [imagenUrl, setImagenUrl] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function subirImagen(file: File | null) {
    if (!file) return
    setSubiendoImagen(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) setImagenUrl(data.url)
    } finally {
      setSubiendoImagen(false)
    }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!titulo.trim() || !descripcion.trim() || !whatsapp.trim()) {
      setError('Completá título, descripción y WhatsApp.')
      return
    }
    setPublicando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/anuncios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titulo, descripcion, tipo, precio, whatsapp, whatsappPais, imagenUrl }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setEnviado(true)
    } finally {
      setPublicando(false)
    }
  }

  if (cargando) {
    return <div className="max-w-[480px] mx-auto px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  if (!usuario) {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-16 text-center">
        <div className="font-display text-xl font-bold text-ink mb-3">Iniciá sesión</div>
        <div className="font-body text-sm text-inksoft mb-5">Necesitás una cuenta para publicar un anuncio.</div>
        <Link href="/login" className="inline-block px-4 py-2.5 rounded-lg bg-maroon text-white font-body text-sm font-semibold">
          Ir al login
        </Link>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="max-w-[480px] mx-auto px-5 py-16 text-center">
        <div className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center mx-auto mb-3.5 text-xl">✓</div>
        <div className="font-display text-lg font-bold text-ink mb-1.5">¡Listo, lo mandamos a revisión!</div>
        <div className="font-body text-sm text-inksoft mb-5">Un admin lo revisa y lo publica en /anuncios — normalmente no tarda mucho.</div>
        <Link href="/anuncios" className="inline-block px-4 py-2.5 rounded-lg bg-maroon text-white font-body text-sm font-semibold">
          Ver anuncios publicados
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[480px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="font-display text-xl font-bold text-ink">Publicar un anuncio</div>
        <Link href="/anuncios" className="font-body text-sm text-maroon underline">Ver anuncios</Link>
      </div>
      <div className="font-body text-xs text-inksoft mb-5">
        Un admin lo revisa antes de que se vea públicamente — no aparece solo con enviarlo.
      </div>

      <form onSubmit={publicar} className="bg-panel border border-line rounded-xl p-5">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel mb-3"
        >
          {TIPOS_ANUNCIO.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (ej: Se busca niñera de lunes a viernes)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />

        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción"
          rows={4}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />

        <input
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          type="number"
          placeholder="Precio en Bs (opcional)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />

        <div className="mb-3">
          <div className="font-body text-xs text-inksoft mb-1.5">Foto (opcional)</div>
          <div className="flex items-center gap-3 flex-wrap">
            {imagenUrl && <img src={imagenUrl} alt="Vista previa" className="w-14 h-14 object-cover rounded-lg border border-line" />}
            <input type="file" accept="image/*" onChange={(e) => subirImagen(e.target.files?.[0] || null)} disabled={subiendoImagen} className="font-body text-xs" />
          </div>
          {subiendoImagen && <div className="font-body text-xs text-maroon mt-1">Subiendo imagen...</div>}
        </div>

        <div className="flex gap-2 items-center mb-1">
          <select
            value={whatsappPais}
            onChange={(e) => setWhatsappPais(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-line font-body text-sm bg-panel shrink-0"
          >
            {PAISES.map((p) => (
              <option key={p.id} value={p.id}>{p.bandera} {p.nombre} (+{p.codigo})</option>
            ))}
          </select>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Tu WhatsApp (ej: 71234567)"
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
        </div>

        {error && <div className="font-body text-xs text-maroon mb-3 mt-3">{error}</div>}

        <button
          type="submit"
          disabled={publicando || subiendoImagen}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold mt-3 disabled:opacity-60"
        >
          {publicando ? 'Enviando...' : 'Enviar a revisión'}
        </button>
      </form>
    </div>
  )
}
