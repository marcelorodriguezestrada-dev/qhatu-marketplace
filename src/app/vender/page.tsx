'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ProductIcon } from '@/components/ProductIcon'
import ModalIASuggestions from '@/components/ModalIASuggestions'

const CATEGORIAS = ['Calzado', 'Ropa', 'Accesorios', 'Hogar']
const ICONOS = ['boot', 'sandal', 'shoe', 'sneaker', 'textile', 'sweater', 'hat', 'bag']

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

const ESTADOS_LABEL: Record<string, { texto: string; color: string }> = {
  pendiente_pago: { texto: 'Esperando pago', color: 'text-inksoft' },
  informado_pago: { texto: 'Pago avisado', color: 'text-ochre' },
  pagado: { texto: 'Pagado', color: 'text-teal' },
  en_preparacion: { texto: 'En preparación', color: 'text-indigo-600' },
  en_entrega: { texto: 'En entrega', color: 'text-amber-600' },
  entregado: { texto: 'Entregado', color: 'text-emerald-600' },
  cancelado: { texto: 'Cancelado', color: 'text-red-600' },
}

export default function VenderPage() {
  const { usuario, cargando, obtenerToken } = useAuth()
  const router = useRouter()
  const [misProductos, setMisProductos] = useState<any[]>([])
  const [misPedidos, setMisPedidos] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [precio, setPrecio] = useState('')
  const [precioOriginal, setPrecioOriginal] = useState('')
  const [plan, setPlan] = useState<'basico' | 'premium'>('basico')
  const [icono, setIcono] = useState(ICONOS[0])
  const [descripcionCorta, setDescripcionCorta] = useState('')
  const [descripcionLarga, setDescripcionLarga] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removerFondo, setRemoverFondo] = useState(false)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [previewProcessedUrl, setPreviewProcessedUrl] = useState<string | null>(null)
  const [processingPreview, setProcessingPreview] = useState(false)
  const [generandoIA, setGenerandoIA] = useState(false)
  const [showModalIA, setShowModalIA] = useState(false)
  const [sugerenciasIA, setSugerenciasIA] = useState<any[]>([])
  const [fetchingSugerencias, setFetchingSugerencias] = useState(false)

  // Perfil de cobro (QR/CBU propio) — con esto, quien te compre paga
  // directo a tu cuenta, no a una cuenta centralizada de la plataforma.
  const [cobroQrUrl, setCobroQrUrl] = useState('')
  const [cobroCbu, setCobroCbu] = useState('')
  const [cobroNegocio, setCobroNegocio] = useState('')
  const [subiendoQrCobro, setSubiendoQrCobro] = useState(false)
  const [guardandoCobro, setGuardandoCobro] = useState(false)
  const [cobroGuardado, setCobroGuardado] = useState(false)

  useEffect(() => {
    if (!cargando && !usuario) router.push('/login')
  }, [cargando, usuario, router])

  useEffect(() => {
    if (usuario) {
      cargarMisProductos()
      cargarMisPedidos()
      cargarMiCobro()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function cargarMiCobro() {
    if (!usuario) return
    const res = await fetch(`/api/vendedores/${usuario.uid}`)
    const data = await res.json()
    if (data.configurado) {
      setCobroQrUrl(data.qrImageUrl || '')
      setCobroCbu(data.cbu || '')
      setCobroNegocio(data.nombreNegocio || '')
    }
  }

  async function subirQrCobro(file: File | null) {
    if (!file) return
    setSubiendoQrCobro(true)
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
      setCobroQrUrl(data.url)
    } catch (e) {
      // @ts-ignore
      setError('Error subiendo el QR: ' + (e?.message || e))
    } finally {
      setSubiendoQrCobro(false)
    }
  }

  async function guardarCobro() {
    setGuardandoCobro(true)
    setCobroGuardado(false)
    try {
      const token = await obtenerToken()
      await fetch('/api/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrImageUrl: cobroQrUrl, cbu: cobroCbu, nombreNegocio: cobroNegocio }),
      })
      setCobroGuardado(true)
    } finally {
      setGuardandoCobro(false)
    }
  }

  async function cargarMisProductos() {
    const res = await fetch('/api/productos')
    const data = await res.json()
    const propios = (data.productos || []).filter((p: any) => p.vendedorId === usuario?.uid)
    setMisProductos(propios)
  }

  async function cargarMisPedidos() {
    const token = await obtenerToken()
    if (!token) return
    const res = await fetch('/api/pedidos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setMisPedidos(data.pedidos || [])
  }

  // Mismo patrón que el resto de la app: subimos el archivo a nuestro
  // propio endpoint /api/upload-image, que a su vez lo reenvía a ImgBB
  // (hosting de imágenes gratuito) y nos devuelve la URL pública.
  async function subirImagen(file: File | null) {
    if (!file) return
    // Comprimir imagen en cliente antes de cualquier procesamiento para
    // acelerar subida y segmentación. Guardamos la versión comprimida
    // en `lastFile` para previsualizar/procesar rápidamente.
    let workingFile = file
    try {
      const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
      const maxDim = isMobile ? 600 : 800
      const quality = isMobile ? 0.6 : 0.7
      const compressed = await compressImage(file, maxDim, quality)
      if (compressed) workingFile = compressed
    } catch (err) {
      console.warn('Compression failed, uploading original', err)
    }
    setLastFile(workingFile)
    // Generar preview pequeño inmediato para mejorar percepción en móviles
    try {
      const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
      const previewDim = isMobile ? 300 : 400
      const previewQuality = isMobile ? 0.6 : 0.7
      const small = await compressImage(file, previewDim, previewQuality)
      if (small) {
        const obj = URL.createObjectURL(small)
        // mostrar preview local hasta que la subida termine
        setLocalPreviewUrl(obj)
        // revoke previo (si existía) al reemplazar después
      }
    } catch (err) {
      console.warn('preview generation failed', err)
    }

    setSubiendoImagen(true)
    setError('')
    try {
      // Procesamiento cliente gratuito: intenta remover fondo en el navegador
      // Sólo si el usuario tiene activada la opción
      let processedFile: File = workingFile
      if (removerFondo) {
        try {
          const processedDataUrl = await removeBgClient(workingFile)
          // Convertir dataURL a File
          const blob = await (await fetch(processedDataUrl)).blob()
          processedFile = new File([blob], workingFile.name, { type: blob.type })
        } catch (err) {
          // Si falla la remoción en cliente, seguimos con el archivo comprimido/original
          console.warn('remove-bg client failed', err)
        }
      }

      // Subimos la versión media en background (la que se mostrará como imagen final)
      const token = await obtenerToken()
      const formData = new FormData()
      formData.append('image', processedFile)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // reemplazar preview local por URL remota
      if (localPreviewUrl) {
        try { URL.revokeObjectURL(localPreviewUrl) } catch (e) {}
        setLocalPreviewUrl(null)
      }
      setImagenUrl(data.url)
    } catch (e) {
      // @ts-ignore
      setError('Error subiendo la imagen: ' + (e?.message || e))
    } finally {
      setSubiendoImagen(false)
    }
  }

  async function previewRemoveBg() {
    if (!lastFile) {
      setError('No hay archivo local para procesar. Volvé a seleccionar la imagen.')
      return
    }
    setProcessingPreview(true)
    setError('')
    try {
      const dataUrl = await removeBgClient(lastFile)
      setPreviewProcessedUrl(dataUrl)
    } catch (err) {
      console.error('Preview remove bg failed', err)
      // @ts-ignore
      setError('No se pudo generar la previsualización: ' + (err?.message || err))
    } finally {
      setProcessingPreview(false)
    }
  }

  async function applyPreviewAsImage() {
    if (!previewProcessedUrl) return
    setSubiendoImagen(true)
    setError('')
    try {
      const blob = await (await fetch(previewProcessedUrl)).blob()
      const file = new File([blob], lastFile?.name || 'processed.png', { type: blob.type })
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
      // reemplazamos lastFile con el nuevo file
      setLastFile(file)
      setPreviewProcessedUrl(null)
    } catch (err) {
      // @ts-ignore
      setError('Error subiendo la imagen procesada: ' + (err?.message || err))
    } finally {
      setSubiendoImagen(false)
    }
  }

  // removeBgClient: ejecuta segmentación con BodyPix y compone la persona
  async function removeBgClient(file: File): Promise<string> {
    // Carga de TF.js + BodyPix desde CDN en tiempo de ejecución para evitar
    // que el builder intente resolver dependencias en el servidor.
    function loadScript(src: string, globalName?: string) {
      return new Promise<void>((resolve, reject) => {
        if (globalName && (window as any)[globalName]) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Error cargando ' + src))
        document.head.appendChild(s)
      })
    }

    // Versiones estables en CDN; podés ajustar si necesitás otra.
    await loadScript('https://unpkg.com/@tensorflow/tfjs@4.9.0/dist/tf.min.js', 'tf')
    await loadScript('https://unpkg.com/@tensorflow-models/body-pix@2.0.5/dist/body-pix.min.js', 'bodyPix')

    const tf = (window as any).tf
    const bodyPix = (window as any).bodyPix
    if (!tf || !bodyPix) throw new Error('No se pudieron cargar las librerías de segmentación')
    await tf.setBackend('webgl')
    await tf.ready()

    // Cargar imagen en elemento HTMLImageElement
    const img = document.createElement('img')
    img.src = URL.createObjectURL(file)
    await new Promise((r, rej) => { img.onload = r; img.onerror = rej })

    const net = await bodyPix.load()
    const segmentation = await net.segmentPerson(img, { internalResolution: 'medium' })

    const w = img.naturalWidth
    const h = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // Si la máscara detecta casi nada (p. ej. no es una persona), devolvemos
    // la imagen original sin aplicar la eliminación de fondo para evitar "desaparecer" el objeto.
    const segData = (segmentation as any).data as Uint8Array
    let fgCount = 0
    for (let i = 0; i < segData.length; i++) if (segData[i]) fgCount++
    const fgRatio = fgCount / (w * h)
    if (fgRatio < 0.01) {
      // Fallback: devolver la imagen original (dibujada sobre blanco)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      URL.revokeObjectURL(img.src)
      return dataUrl
    }

    // Crear máscara e incorporar la persona sobre el fondo blanco correctamente
    const mask = bodyPix.toMask(segmentation)
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = w
    maskCanvas.height = h
    const mctx = maskCanvas.getContext('2d')!
    mctx.putImageData(mask, 0, 0)

    // Dibujar la imagen original
    ctx.drawImage(img, 0, 0)
    // Usar la máscara para recortar la imagen (mantener sólo la persona)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas, 0, 0)
    // Dibujar fondo blanco debajo
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    const dataUrl = canvas.toDataURL('image/png')
    URL.revokeObjectURL(img.src)
    return dataUrl
  }

  // compressImage: redimensiona la imagen manteniendo proporción y reduce calidad
  async function compressImage(file: File, maxDim = 800, quality = 0.7): Promise<File | null> {
    try {
      const img = document.createElement('img')
      img.src = URL.createObjectURL(file)
      await new Promise((r, rej) => { img.onload = r; img.onerror = rej })
      const w = img.naturalWidth
      const h = img.naturalHeight
      let nw = w
      let nh = h
      if (Math.max(w, h) > maxDim) {
        if (w >= h) {
          nw = maxDim
          nh = Math.round((maxDim * h) / w)
        } else {
          nh = maxDim
          nw = Math.round((maxDim * w) / h)
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = nw
      canvas.height = nh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, nw, nh)
      // Preferir WebP para mejor compresión en navegadores que lo soporten
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
      // Si WebP no está disponible, caer a jpeg
      const finalBlob = blob || (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)))
      URL.revokeObjectURL(img.src)
      if (!finalBlob) return null
      const ext = finalBlob.type === 'image/webp' ? '.webp' : '.jpg'
      return new File([finalBlob], file.name.replace(/\.[^.]+$/, ext), { type: finalBlob.type })
    } catch (err) {
      console.warn('compressImage error', err)
      return null
    }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !precio) {
      setError('Completá el nombre y el precio.')
      return
    }
    if (precioOriginal && Number(precioOriginal) <= Number(precio)) {
      setError('El precio anterior tiene que ser mayor al precio actual, o dejalo vacío.')
      return
    }
    setPublicando(true)
    try {
      const token = await obtenerToken()
      if (editingId) {
        const res = await fetch(`/api/productos/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            nombre,
            categoria,
            precio: Number(precio),
            icono,
            imagenUrl,
            precioOriginal: precioOriginal ? Number(precioOriginal) : null,
            descripcionCorta,
            descripcionLarga,
          }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          return
        }
        setEditingId(null)
      } else {
        const res = await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            nombre,
            categoria,
            precio: Number(precio),
            icono,
            imagenUrl,
            precioOriginal: precioOriginal ? Number(precioOriginal) : null,
            plan,
            descripcionCorta,
            descripcionLarga,
          }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          return
        }
      }
      setNombre('')
      setPrecio('')
      setPrecioOriginal('')
      setImagenUrl('')
      setIcono(ICONOS[0])
      setPlan('basico')
      setDescripcionCorta('')
      setDescripcionLarga('')
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

  // El vendedor confirma el pago que recibió directo en su propio QR/CBU,
  // y después va avanzando el estado de preparación/entrega — todo sin
  // necesitar la contraseña de admin, porque es su propia venta.
  async function avanzarEstadoPedido(id: string, estado: string) {
    const token = await obtenerToken()
    await fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado }),
    })
    cargarMisPedidos()
  }

  if (cargando || !usuario) {
    return <div className="px-5 py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="font-display text-xl font-bold text-ink mb-1">Vender en Clasi Click</div>
      <div className="font-body text-[13px] text-inksoft mb-6">Publicando como {usuario.email}</div>
      {editingId && (
        <div className="mb-4 p-3 rounded-lg bg-ochre/10 border border-ochre text-ink font-body text-sm">
          Estás editando el producto <strong>{editingId}</strong>. Hacé los cambios y presioná "Actualizar producto" o "Cancelar".
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl p-5 mb-8">
        <div className="font-body text-sm font-semibold text-ink mb-1">Cobros — tu QR o CBU</div>
        <p className="font-body text-[12px] text-inksoft mb-3">
          Configurá esto para que cuando alguien te compre, pague directo a tu cuenta — no pasa por la plataforma. Si no lo configurás, tus ventas van a mostrar el QR general de Clasi Click como respaldo.
        </p>
        <input
          value={cobroNegocio}
          onChange={(e) => setCobroNegocio(e.target.value)}
          placeholder="Nombre de tu negocio (opcional)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <div className="mb-3">
          <div className="font-body text-xs text-inksoft mb-1.5">Foto de tu QR de cobro</div>
          <div className="flex items-center gap-3 flex-wrap">
            {cobroQrUrl && (
              <img src={cobroQrUrl} alt="Tu QR" loading="lazy" decoding="async" className="w-16 h-16 object-cover rounded-lg border border-line" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => subirQrCobro(e.target.files?.[0] || null)}
              disabled={subiendoQrCobro}
              className="font-body text-xs"
            />
          </div>
          {subiendoQrCobro && <div className="font-body text-xs text-maroon mt-1">Subiendo...</div>}
        </div>
        <input
          value={cobroCbu}
          onChange={(e) => setCobroCbu(e.target.value)}
          placeholder="CBU / número de cuenta (opcional, alternativa al QR)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <button
          type="button"
          onClick={guardarCobro}
          disabled={guardandoCobro || subiendoQrCobro}
          className="px-4 py-2 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold disabled:opacity-60"
        >
          {guardandoCobro ? 'Guardando...' : 'Guardar datos de cobro'}
        </button>
        {cobroGuardado && <span className="font-body text-xs text-teal ml-3">Guardado ✓</span>}
      </div>

      <form onSubmit={publicar} className="bg-panel border border-line rounded-xl p-5 mb-8">
        <div className="font-body text-sm font-semibold text-ink mb-3">Nuevo producto</div>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del producto"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <input
          value={descripcionCorta}
          onChange={(e) => setDescripcionCorta(e.target.value)}
          placeholder="Descripción corta (ej: Botines de cuero, talle 38)"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
        />
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={async () => {
              setError('')
              setFetchingSugerencias(true)
              try {
                const res = await fetch('/api/generate-description', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nombre, categoria, precio, imagenUrl, descripcionLarga, variantes: 3 }),
                })
                const j = await res.json()
                if (j.error) throw new Error(j.error)
                const list = j.suggestions || (j.title ? [{ title: j.title, short: j.short, long: j.long }] : [])
                if (list.length === 0) throw new Error('No hay sugerencias')
                setSugerenciasIA(list)
                setShowModalIA(true)
              } catch (err) {
                // @ts-ignore
                setError('Error generando con IA: ' + (err?.message || err))
              } finally {
                setFetchingSugerencias(false)
              }
            }}
            className="px-3 py-2 rounded-md border font-body text-sm"
            disabled={fetchingSugerencias}
          >
            {fetchingSugerencias ? 'Generando...' : 'Generar con IA (ver 3 sugerencias)'}
          </button>
          <div className="font-body text-[12px] text-inksoft self-center">Usa IA para proponer título, descripción corta y detallada.</div>
        </div>

        <ModalIASuggestions
          open={showModalIA}
          onClose={() => setShowModalIA(false)}
          suggestions={sugerenciasIA}
          onApply={(s) => {
            if (s.title) setNombre(s.title)
            if (s.short) setDescripcionCorta(s.short)
            if (s.long) setDescripcionLarga(s.long)
            setShowModalIA(false)
          }}
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
        <div className="mb-3">
          <input
            type="number"
            value={precioOriginal}
            onChange={(e) => setPrecioOriginal(e.target.value)}
            placeholder="Precio anterior (opcional, para mostrar descuento)"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
          />
          <div className="font-body text-[11px] text-inksoft mt-1.5">
            Dejalo vacío si no tenés descuento. Si lo completás, tiene que ser mayor al precio actual.
          </div>
        </div>
        <div className="mb-3">
          <div className="font-body text-xs text-inksoft mb-1.5">Descripción detallada</div>
          <textarea
            value={descripcionLarga}
            onChange={(e) => setDescripcionLarga(e.target.value)}
            placeholder="Detalles: material, estado, envío, medidas, etc."
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm min-h-[100px]"
          />
        </div>
        <div className="mb-4">
          <div className="font-body text-xs text-inksoft mb-1.5">Plan del vendedor</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlan('basico')}
              className={`px-3 py-2 rounded-lg border font-body text-sm ${plan === 'basico' ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'}`}
            >
              Básico
            </button>
            <button
              type="button"
              onClick={() => setPlan('premium')}
              className={`px-3 py-2 rounded-lg border font-body text-sm ${plan === 'premium' ? 'border-ochre bg-ochresoft text-ochre' : 'border-line text-inksoft'}`}
            >
              Premium
            </button>
          </div>
          <div className="font-body text-[11px] text-inksoft mt-1.5">
            {plan === 'premium'
              ? 'Tu producto aparece destacado y arriba del catálogo.'
              : 'Tu producto se publica como estándar.'}
          </div>
        </div>

        <div className="mb-4">
          <div className="font-body text-xs text-inksoft mb-1.5">Foto del producto</div>
          <div className="flex items-center gap-3 flex-wrap">
            {(localPreviewUrl || imagenUrl) && (
              <img
                src={localPreviewUrl || imagenUrl}
                alt="Vista previa"
                loading="lazy"
                decoding="async"
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previewRemoveBg}
                disabled={!lastFile || processingPreview}
                className="px-3 py-1 rounded-md border font-body text-xs"
              >
                {processingPreview ? 'Procesando...' : 'Sacar fondo (previsualizar)'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <label className="font-body text-[13px] flex items-center gap-2">
              <input type="checkbox" checked={removerFondo} onChange={(e) => setRemoverFondo(e.target.checked)} />
              <span className="font-body text-[11px] text-inksoft">Remover fondo (cliente, puede fallar con objetos)</span>
            </label>
          </div>
          <div className="font-body text-[11px] text-inksoft mt-1.5">
            Opcional — si no subís foto, se usa el ícono que elijas abajo. Si la remoción falla, se sube la imagen original.
          </div>
        </div>

        {previewProcessedUrl && (
          <div className="mt-3 p-3 border rounded-lg bg-white/50">
            <div className="font-body text-sm font-semibold mb-2">Previsualización sin fondo</div>
            <div className="flex items-center gap-3">
              <img src={previewProcessedUrl} alt="Preview sin fondo" loading="lazy" decoding="async" className="w-20 h-20 object-contain rounded-md border" />
              <div className="flex flex-col gap-2">
                <button onClick={applyPreviewAsImage} className="px-3 py-1 rounded-md bg-maroon text-white text-sm">Usar esta imagen</button>
                <button onClick={() => setPreviewProcessedUrl(null)} className="px-3 py-1 rounded-md border text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

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
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={publicando || subiendoImagen}
            className="flex-1 py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold disabled:opacity-60"
          >
            {publicando ? (editingId ? 'Actualizando...' : 'Publicando...') : (editingId ? 'Actualizar producto' : 'Publicar producto')}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setNombre('')
                setCategoria(CATEGORIAS[0])
                setPrecio('')
                setPrecioOriginal('')
                setIcono(ICONOS[0])
                setImagenUrl('')
                setPlan('basico')
              }}
              className="px-4 py-2.5 rounded-lg border border-line font-body text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-panel border border-line rounded-xl p-4 mb-8">
        <div className="font-body text-sm font-semibold text-ink mb-3">Mis pedidos ({misPedidos.length})</div>
        {misPedidos.length === 0 && (
          <div className="font-body text-sm text-inksoft">Todavía no tenés pedidos para tus productos.</div>
        )}
        {misPedidos.map((p) => {
          const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
          const itemsVendidos = (p.items || []).filter((it: any) => it.vendedorId === usuario.uid || it.vendedor === usuario.email)
          const siguienteAccion: Record<string, { estado: string; texto: string }> = {
            pendiente_pago: { estado: 'pagado', texto: 'Confirmar pago recibido' },
            informado_pago: { estado: 'pagado', texto: 'Confirmar pago recibido' },
            pagado: { estado: 'en_preparacion', texto: 'Marcar en preparación' },
            en_preparacion: { estado: 'en_entrega', texto: 'Marcar en camino' },
            en_entrega: { estado: 'entregado', texto: 'Marcar entregado' },
          }
          const accion = siguienteAccion[p.estado]
          return (
            <div key={p.id} className="border border-line rounded-lg p-3 mb-2.5 bg-white/40">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="font-body text-xs text-inksoft">Pedido #{p.id.slice(0, 6)}</div>
                <div className={`font-body text-[11px] font-semibold ${estado.color}`}>{estado.texto}</div>
              </div>
              <div className="font-body text-sm font-medium text-ink">{itemsVendidos.length} producto(s) · {bs(p.total)}</div>
              <div className="font-body text-[11px] text-inksoft mt-1 mb-2">
                Comprador: {p.comprador || 'Sin email'}
              </div>
              {accion && (
                <button
                  onClick={() => avanzarEstadoPedido(p.id, accion.estado)}
                  className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold"
                >
                  {accion.texto}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="font-body text-sm font-semibold text-ink mb-3">Mis productos ({misProductos.length})</div>
      {misProductos.length === 0 && (
        <div className="font-body text-sm text-inksoft">Todavía no publicaste ningún producto.</div>
      )}
      {misProductos.map((p) => (
        <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden">
            {p.imagenUrl ? (
              <img src={p.imagenUrl} alt={p.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <ProductIcon kind={p.icono} size={20} />
            )}
          </div>
          <div className="flex-1">
            <div className="font-body text-sm font-medium text-ink">{p.nombre}</div>
            <div className="font-body text-xs text-inksoft">
              {p.categoria} · {p.precioOriginal ? (
                <>
                  <span className="line-through">{bs(p.precioOriginal)}</span> {bs(p.precio)}
                </>
              ) : (
                bs(p.precio)
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Prefill form for editing
                setEditingId(p.id)
                setNombre(p.nombre || '')
                setCategoria(p.categoria || CATEGORIAS[0])
                setPrecio(String(p.precio || ''))
                setPrecioOriginal(p.precioOriginal ? String(p.precioOriginal) : '')
                setIcono(p.icono || ICONOS[0])
                setImagenUrl(p.imagenUrl || '')
                setDescripcionCorta(p.descripcionCorta || '')
                setDescripcionLarga(p.descripcionLarga || '')
                setPlan(p.plan || 'basico')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="font-body text-xs text-ink underline"
            >
              Editar
            </button>
            <button
              onClick={() => borrar(p.id)}
              className="font-body text-xs text-maroon underline shrink-0"
            >
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
