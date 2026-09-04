'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ProductIcon } from '@/components/ProductIcon'

const CATEGORIAS = ['Calzado', 'Ropa', 'Accesorios', 'Hogar']
const ICONOS = ['boot', 'sandal', 'shoe', 'sneaker', 'textile', 'sweater', 'hat', 'bag']

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

export default function VenderPage() {
  const { usuario, cargando, obtenerToken } = useAuth()
  const router = useRouter()
  const [misProductos, setMisProductos] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [precio, setPrecio] = useState('')
  const [icono, setIcono] = useState(ICONOS[0])
  const [imagenUrl, setImagenUrl] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cargando && !usuario) router.push('/login')
  }, [cargando, usuario, router])

  useEffect(() => {
    if (usuario) cargarMisProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function cargarMisProductos() {
    const res = await fetch('/api/productos')
    const data = await res.json()
    const propios = (data.productos || []).filter((p: any) => p.vendedorId === usuario?.uid)
    setMisProductos(propios)
  }

  // Mismo patrón que el resto de la app: subimos el archivo a nuestro
  // propio endpoint /api/upload-image, que a su vez lo reenvía a ImgBB
  // (hosting de imágenes gratuito) y nos devuelve la URL pública.
  async function subirImagen(file: File | null) {
    if (!file) return
    setSubiendoImagen(true)
    setError('')
    try {
      const token = await obtenerToken()
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImagenUrl(data.url)
    } catch (e: any) {
      setError('Error subiendo la imagen: ' + e.message)
    } finally {
      setSubiendoImagen(false)
    }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !precio) {
      setError('Completá el nombre y el precio.')
      return
    }
    setPublicando(true)
    try {
      const token = await obtenerToken()
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, categoria, precio: Number(precio), icono, imagenUrl }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setNombre('')
      setPrecio('')
      setImagenUrl('')
      await cargarMisProductos()
    } finally {
      setPublicando(false)
    }
  }

  async function borrar(id: string) {
    const token = await obtenerToken()
    await fetch(`/api/productos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    cargarMisProductos()
  }

  if (cargando || !usuario) {
    return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="font-display text-xl font-bold text-ink mb-1">Vender en Qhatu</div>
      <div className="font-body text-[13px] text-inksoft mb-6">Publicando como {usuario.email}</div>

      <form onSubmit={publicar} className="bg-panel border border-line rounded-xl p-5 mb-8">
        <div className="font-body text-sm font-semibold text-ink mb-3">Nuevo producto</div>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del producto"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio en Bs"
            className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
        </div>
        <div className="mb-4">
          <div className="font-body text-xs text-inksoft mb-1.5">Foto del producto</div>
          <div className="flex items-center gap-3 flex-wrap">
            {imagenUrl && (
              <img
                src={imagenUrl}
                alt="Vista previa"
                className="w-14 h-14 object-cover rounded-lg border border-line"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => subirImagen(e.target.files?.[0] || null)}
                disabled={subiendoImagen}
                className="font-body text-xs"
              />
              {subiendoImagen && <div className="font-body text-xs text-maroon mt-1">Subiendo imagen...</div>}
            </div>
          </div>
          <div className="font-body text-[11px] text-inksoft mt-1.5">
            Opcional — si no subís foto, se usa el ícono que elijas abajo.
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {ICONOS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcono(i)}
              className={`w-11 h-11 rounded-lg border flex items-center justify-center ${
                icono === i ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'
              }`}
            >
              <ProductIcon kind={i} size={20} />
            </button>
          ))}
        </div>
        {error && <div className="font-body text-xs text-maroon mb-3">{error}</div>}
        <button
          type="submit"
          disabled={publicando || subiendoImagen}
          className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
        >
          {publicando ? 'Publicando...' : 'Publicar producto'}
        </button>
      </form>

      <div className="font-body text-sm font-semibold text-ink mb-3">Mis productos ({misProductos.length})</div>
      {misProductos.length === 0 && (
        <div className="font-body text-sm text-inksoft">Todavía no publicaste ningún producto.</div>
      )}
      {misProductos.map((p) => (
        <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden">
            {p.imagenUrl ? (
              <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
            ) : (
              <ProductIcon kind={p.icono} size={20} />
            )}
          </div>
          <div className="flex-1">
            <div className="font-body text-sm font-medium text-ink">{p.nombre}</div>
            <div className="font-body text-xs text-inksoft">{p.categoria} · {bs(p.precio)}</div>
          </div>
          <button
            onClick={() => borrar(p.id)}
            className="font-body text-xs text-maroon underline shrink-0"
          >
            Borrar
          </button>
        </div>
      ))}
    </div>
  )
}
