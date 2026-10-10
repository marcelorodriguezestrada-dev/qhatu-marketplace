'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Producto } from '@/data/productos'
import { PRODUCTOS_SEED } from '@/data/productos'
import { ProductCard } from '@/components/ProductCard'
import { CartDrawer } from '@/components/CartDrawer'
import { NotificacionesBell } from '@/components/NotificacionesBell'
import { BannerCarousel } from '@/components/BannerCarousel'
import BannerCuponPromo from '@/components/BannerCuponPromo'
import { usePortada } from '@/lib/portada'
import BuscadorProductos, { guardarReciente } from '@/components/BuscadorProductos'
import { buscarProducto, prepararConsulta } from '@/lib/busqueda'
import ListadoResultados from '@/components/ListadoResultados'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'
import MenuCategorias from '@/components/MenuCategorias'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { useCiudad } from '@/lib/ciudad'
import { productoEnCiudad } from '@/data/ciudades'
import { LogoClasiClick } from '@/components/LogoClasiClick'
import { AccesosInicio, BarraInferiorCelular, CarruselProductos, CategoriasInicio, HeroInicio, TarjetasInicio } from '@/components/inicio/BloquesInicio'
import { leerVistos } from '@/lib/vistos'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'

export default function CatalogoPage() {
  const { categorias: categoriasProductos, rubrosFlat, buscarRubroProducto } = useCategoriasProductos()
  const [todosLosProductos, setProductos] = useState<Producto[]>(PRODUCTOS_SEED)
  // Productos de la ciudad del comprador + los de tiendas que envían a
  // todo Bolivia (llevan "🚚 Envía desde …").
  const { ciudadId, ciudad, abiertas } = useCiudad()
  const envioClasiCiudad = abiertas.find((c) => c.id === ciudadId)?.envioClasiClick ?? ciudadId === 'potosi'
  // "Menos de Bs 50" (o su equivalente en otro país): ?max= en la URL.
  const [precioMax, setPrecioMax] = useState<number | null>(null)
  const topeBarato = paisDeCiudad(ciudadId).id === 'BO' ? 50 : 20000
  // Lo último que vio esta persona (ver src/lib/vistos.ts).
  const [vistos, setVistos] = useState<string[]>([])
  useEffect(() => { setVistos(leerVistos()) }, [])
  const productos = todosLosProductos.filter((p) => productoEnCiudad(p as any, ciudadId))
  const [publico, setPublico] = useState('Todo')
  const [categoria, setCategoria] = useState('Todo')
  // Rubro elegido desde el menú "Categorías" o /categorias (?rubro=).
  const [rubroSel, setRubroSel] = useState<string | null>(null)
  // Subcategoría elegida (nivel del medio: Ropa › Calzado › …).
  const [grupoSel, setGrupoSel] = useState<string | null>(null)
  const [menuCategorias, setMenuCategorias] = useState(false)
  const portada = usePortada()
  const [busqueda, setBusqueda] = useState('')
  // Búsqueda confirmada (Enter / lupa / sugerencia) — muestra el listado.
  const [consulta, setConsulta] = useState('')
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const { items } = useCarrito()
  const { usuario, logout } = useAuth()

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        if (data.productos) setProductos(data.productos)
      })
      .catch(() => {
        // Si falla la carga (por ejemplo, Firebase no configurado todavía
        // en desarrollo), nos quedamos con el catálogo semilla local.
      })
  }, [])

  // ¿El producto está dentro de lo elegido (rubro, subcategoría o categoría)?
  const enSeleccion = (p: Producto) => {
    if (rubroSel) return p.rubro === rubroSel
    if (grupoSel) return buscarRubroProducto(p.rubro)?.grupoId === grupoSel
    return categoria === 'Todo' || buscarRubroProducto(p.rubro)?.categoriaId === categoria
  }
  const filtrados = productos.filter((p) => {
    const matchPublico = publico === 'Todo' || (p.publico || 'unisex') === publico
    const matchCat = enSeleccion(p)
    const matchPrecio = precioMax == null || p.precio <= precioMax
    return matchPublico && matchCat && matchPrecio
  })

  // Solo entran acá los descuentos reales (precioOriginal cargado por
  // el propio vendedor y mayor al precio actual) — nada de porcentajes
  // inventados para la sección de ofertas.
  const ofertas = productos.filter((p) => p.precioOriginal && p.precioOriginal > p.precio).slice(0, 8)

  const cantidadCarrito = items.reduce((s, i) => s + i.cantidad, 0)
  const router = useRouter()
  const pathname = usePathname()

  // Primero lo que coincide con el texto; después lo que entra por
  // sinónimos o por las palabras de búsqueda de la IA ("relacionados").
  const { resultadosBusqueda, relacionadosBusqueda } = (() => {
    if (!consulta.trim()) return { resultadosBusqueda: [] as Producto[], relacionadosBusqueda: new Set<string>() }
    // Ordenados por puntaje: primero lo que tiene la palabra en el nombre.
    const c = prepararConsulta(consulta)
    const exactos: { p: Producto; n: number }[] = []
    const parecidos: { p: Producto; n: number }[] = []
    for (const p of productos) {
      const r = buscarProducto(p as any, buscarRubroProducto(p.rubro), c)
      if (r?.tipo === 'exacto') exactos.push({ p, n: r.puntaje })
      else if (r) parecidos.push({ p, n: r.puntaje })
    }
    const orden = (a: { n: number }, b: { n: number }) => b.n - a.n
    exactos.sort(orden)
    parecidos.sort(orden)
    return { resultadosBusqueda: [...exactos, ...parecidos].map((x) => x.p), relacionadosBusqueda: new Set(parecidos.map((x) => String(x.p.id))) }
  })()
  function buscar(texto: string) {
    const t = texto.trim()
    setConsulta(t)
    if (t) guardarReciente(t)
    router.push(`${pathname}${t ? `?q=${encodeURIComponent(t)}` : ''}`)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q') || ''
    if (q) { setBusqueda(q); setConsulta(q) }
    const cat = params.get('categoria')
    const rub = params.get('rubro')
    const gru = params.get('grupo')
    if (cat) setCategoria(cat)
    if (rub) setRubroSel(rub)
    if (gru) setGrupoSel(gru)
    const max = Number(params.get('max'))
    if (max > 0) setPrecioMax(max)
  }, [])

  // Atrás/adelante del navegador: seguir la búsqueda de la URL.
  useEffect(() => {
    const alVolver = () => {
      const q = new URLSearchParams(window.location.search).get('q') || ''
      setBusqueda(q)
      setConsulta(q)
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  // Cuántos productos hay por rubro y por categoría (para el menú y los chips).
  const conteoCategorias: Record<string, number> = {}
  for (const p of productos) {
    if (!p.rubro) continue
    conteoCategorias[p.rubro] = (conteoCategorias[p.rubro] || 0) + 1
    const info = buscarRubroProducto(p.rubro)
    if (info) conteoCategorias[info.categoriaId] = (conteoCategorias[info.categoriaId] || 0) + 1
    // Subcategorías con prefijo "g:" (su id puede ser el mismo que el de su rubro "Otros").
    if (info?.grupoId) conteoCategorias[`g:${info.grupoId}`] = (conteoCategorias[`g:${info.grupoId}`] || 0) + 1
  }
  const rubroActual = rubroSel ? buscarRubroProducto(rubroSel) : undefined
  // La subcategoría (elegida, o la del rubro elegido) y su categoría.
  const grupoActualId = grupoSel || rubroActual?.grupoId || null
  const hojaDeGrupo = grupoActualId ? rubrosFlat.find((r) => r.grupoId === grupoActualId) : undefined
  const grupoActual = hojaDeGrupo ? { id: grupoActualId!, label: hojaDeGrupo.grupo || '', categoriaId: hojaDeGrupo.categoriaId } : undefined
  const categoriaActual = categoriasProductos.find((c) => c.id === (rubroActual?.categoriaId || grupoActual?.categoriaId || categoria))
  // Atajos de un nivel más abajo, solo con lo que tiene productos: en una
  // categoría, sus subcategorías (y rubros sueltos); en una subcategoría, sus rubros.
  const atajos: { id: string; label: string; tipo: 'grupo' | 'rubro' }[] = (() => {
    if (rubroSel || !categoriaActual) return []
    if (grupoSel) return categoriaActual.rubros.filter((r) => r.grupoId === grupoSel && conteoCategorias[r.id]).map((r) => ({ id: r.id, label: r.label, tipo: 'rubro' as const }))
    const out: { id: string; label: string; tipo: 'grupo' | 'rubro' }[] = []
    for (const r of categoriaActual.rubros) {
      if (r.grupoId) { if (!out.some((x) => x.id === r.grupoId) && conteoCategorias[`g:${r.grupoId}`]) out.push({ id: r.grupoId, label: r.grupo || '', tipo: 'grupo' }) }
      else if (conteoCategorias[r.id]) out.push({ id: r.id, label: r.label, tipo: 'rubro' })
    }
    return out
  })()

  // Mujer / Hombre / Niños / Otros con productos dentro de la categoría
  // (o rubro) elegida — el filtro secundario.
  const enCategoria = productos.filter((p) => (rubroSel || grupoSel || categoria !== 'Todo') && enSeleccion(p))
  const publicosDisponibles = PUBLICOS_PRODUCTO.map((pub) => ({ ...pub, cantidad: enCategoria.filter((p) => (p.publico || 'unisex') === pub.id).length })).filter((pub) => pub.cantidad > 0)

  function elegirCategoria(catId: string, rubroId: string | null, grupoId: string | null = null, bajar = true) {
    setMenuCategorias(false)
    setCategoria(catId)
    setRubroSel(rubroId)
    setGrupoSel(rubroId ? null : grupoId)
    setPublico('Todo')
    const params = new URLSearchParams()
    if (rubroId) params.set('rubro', rubroId)
    else if (grupoId) params.set('grupo', grupoId)
    else params.set('categoria', catId)
    window.history.replaceState(null, '', `/?${params.toString()}`)
    if (bajar) setTimeout(() => document.getElementById('grilla-productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function quitarFiltroCategoria() {
    setPrecioMax(null)
    setPublico('Todo')
    setCategoria('Todo')
    setRubroSel(null)
    setGrupoSel(null)
    window.history.replaceState(null, '', '/')
  }

  const hayFiltro = !!(rubroSel || grupoSel || categoria !== 'Todo' || precioMax != null)
  const irAProductos = () => document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const productosVistos = vistos.map((id) => productos.find((p) => String(p.id) === id)).filter((p): p is Producto => !!p)
  const ultimoVisto = productosVistos[0] || null
  // "Inspirado en lo último que viste": del mismo rubro (o categoría) que lo último que abrió.
  const inspirados = (() => {
    if (!ultimoVisto) return [] as Producto[]
    const cat = buscarRubroProducto(ultimoVisto.rubro)?.categoriaId
    const mismos = productos.filter((p) => p.id !== ultimoVisto.id && (p.rubro === ultimoVisto.rubro || (cat && buscarRubroProducto(p.rubro)?.categoriaId === cat)))
    return [...productosVistos.slice(1), ...mismos].filter((p, k, arr) => arr.findIndex((x) => x.id === p.id) === k).slice(0, 12)
  })()
  const novedades = [...productos].filter((p) => (p as any).createdAt).sort((a, b) => String((b as any).createdAt).localeCompare(String((a as any).createdAt))).slice(0, 12)
  const categoriasConProductos = categoriasProductos.filter((c) => conteoCategorias[c.id]).map((c) => ({ id: c.id, label: c.label, cantidad: conteoCategorias[c.id] })).sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Cabecera con la marca: logo, buscador grande al medio, ciudad y menú. */}
      <header className="bg-marca sticky top-0 z-20 shadow-md">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-5 pt-2.5 pb-2">
          <div className="flex items-center gap-3 md:gap-6">
            <Link href="/" className="shrink-0" aria-label="Clasi Click — inicio">
              <span className="md:hidden"><LogoClasiClick size={30} /></span>
              <span className="hidden md:inline"><LogoClasiClick size={40} /></span>
            </Link>
            {/* En la compu el buscador va en la misma fila, bien grande. */}
            <div className="hidden md:flex flex-1 items-center bg-white rounded-lg shadow-sm overflow-visible max-w-[640px]">
              <BuscadorProductos
                valor={busqueda}
                onCambiar={setBusqueda}
                onBuscar={buscar}
                productos={productos}
                rubroDe={buscarRubroProducto}
                placeholder="Buscar productos, marcas y más…"
                claro
              />
              <button type="button" onClick={() => buscar(busqueda)} className="px-4 self-stretch rounded-r-lg bg-verde text-marca text-lg border-none" aria-label="Buscar">🔍</button>
            </div>
            <div className="flex-1 md:hidden" />
            <div className="hidden lg:block font-body text-[11px] text-white/60 leading-tight text-right shrink-0">Ahorrá tiempo.<br /><span className="text-verde font-semibold">Viví más feliz.</span></div>
            {usuario && <NotificacionesBell variante="oscura" />}
            <button
              onClick={() => setCarritoAbierto(true)}
              className="relative border-none bg-white/10 text-white px-3 py-2 rounded-lg font-body text-sm shrink-0"
              aria-label="Carrito"
            >
              🛒
              {cantidadCarrito > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-verde text-marca text-[10px] font-bold flex items-center justify-center">{cantidadCarrito}</span>}
            </button>
          </div>

          {/* Celular: el buscador ocupa todo el ancho, debajo del logo. */}
          <div className="md:hidden flex items-center bg-white rounded-lg mt-2.5 shadow-sm">
            <BuscadorProductos
              valor={busqueda}
              onCambiar={setBusqueda}
              onBuscar={buscar}
              productos={productos}
              rubroDe={buscarRubroProducto}
              placeholder="Buscar en Clasi Click"
              claro
            />
            <button type="button" onClick={() => buscar(busqueda)} className="px-3.5 self-stretch rounded-r-lg bg-verde text-marca border-none" aria-label="Buscar">🔍</button>
          </div>

          <div className="relative mt-2">
            <MenuCategorias
              categorias={categoriasProductos}
              abierto={menuCategorias}
              onCerrar={() => setMenuCategorias(false)}
              onElegir={elegirCategoria}
              conteo={conteoCategorias}
            />
            <div className="flex items-center gap-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
              {abiertas.length > 1 ? (
                <SelectorCiudad />
              ) : (
                <span className="font-body text-[12px] text-white/70 shrink-0 whitespace-nowrap">📍 Estás en <b className="text-white">{ciudad.nombre}</b></span>
              )}
              <button type="button" onClick={() => setMenuCategorias((v) => !v)} className="border-none bg-transparent text-white font-body text-[13px] font-semibold shrink-0 whitespace-nowrap">
                Categorías ▾
              </button>
              {ofertas.length > 0 && (
                <button type="button" onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })} className="border-none bg-transparent text-white/85 font-body text-[13px] shrink-0 whitespace-nowrap">Ofertas</button>
              )}
              <Link href="/servicios" className="text-white/85 font-body text-[13px] shrink-0 whitespace-nowrap">Servicios</Link>
              <Link href="/anuncios" className="text-white/85 font-body text-[13px] shrink-0 whitespace-nowrap">Anuncios</Link>
              <Link href="/vender" className="text-white/85 font-body text-[13px] shrink-0 whitespace-nowrap">Vender</Link>
              <Link href="/ayuda" className="text-white/60 font-body text-[13px] shrink-0 whitespace-nowrap">Ayuda</Link>
              <span className="flex-1 hidden sm:block" />
              {usuario ? (
                <>
                  <Link href="/mis-pedidos" className="text-white/85 font-body text-[13px] shrink-0 whitespace-nowrap">Mis compras</Link>
                  <button onClick={() => logout()} className="border-none bg-transparent text-white/55 font-body text-[12px] shrink-0 whitespace-nowrap">
                    👤 {usuario.email?.split('@')[0]} · salir
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-white font-body text-[13px] font-semibold shrink-0 whitespace-nowrap">Ingresá</Link>
                  <Link href="/login" className="text-white/70 font-body text-[13px] shrink-0 whitespace-nowrap">Creá tu cuenta</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-12">
        {consulta.trim() ? (
          <ListadoResultados
            consulta={consulta}
            resultados={resultadosBusqueda}
            relacionados={relacionadosBusqueda}
            rubroDe={buscarRubroProducto}
            ciudadId={ciudadId}
            onBuscar={buscar}
            onLimpiarBusqueda={() => { setBusqueda(''); buscar('') }}
          />
        ) : (
        <>
        {!hayFiltro && (
          <>
            {/* Portada informativa (como Mercado Libre): primero lo útil, los productos más abajo. */}
            {portada?.banners !== false && <BannerCarousel />}
            {portada?.hero !== false && <HeroInicio ciudad={ciudad.nombre} onVer={irAProductos} />}
            {portada?.accesos !== false && <AccesosInicio onProductos={irAProductos} onOfertas={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })} hayOfertas={!!portada?.ofertas && ofertas.length > 0} logueado={!!usuario} />}
            {portada?.tarjetas !== false && <TarjetasInicio
              carrito={items}
              ultimoVisto={ultimoVisto}
              ciudadId={ciudadId}
              envioClasiClick={envioClasiCiudad}
              onAbrirCarrito={() => setCarritoAbierto(true)}
              topeBarato={topeBarato}
              onMenosDe={(n) => { setPrecioMax(n); window.history.replaceState(null, '', `/?max=${n}`); setTimeout(irAProductos, 50) }}
            />}
            {portada?.cupon && <BannerCuponPromo />}
            {portada?.categorias !== false && <CategoriasInicio categorias={categoriasConProductos} onElegir={(id) => elegirCategoria(id, null)} />}
            {portada?.ofertas && <CarruselProductos id="ofertas" titulo="🔥 Ofertas" productos={ofertas} ciudadId={ciudadId} />}
            {portada?.carruseles !== false && (
              <>
                <CarruselProductos titulo="Inspirado en lo último que viste" productos={inspirados} ciudadId={ciudadId} />
                <CarruselProductos titulo="✨ Recién llegados" productos={novedades} ciudadId={ciudadId} accion={{ label: 'Ver todo', onClick: irAProductos }} />
              </>
            )}
            <div id="productos" className="font-display text-lg sm:text-xl font-bold text-ink mb-3 scroll-mt-32">Productos para vos</div>
          </>
        )}

        {precioMax != null && (
          <div className="flex items-center gap-2 mb-3 font-body text-sm">
            <span className="px-3 py-1 rounded-full bg-verdesoft text-verdeoscuro font-semibold">Menos de {formatoMoneda(precioMax, paisDeCiudad(ciudadId))}</span>
            <button type="button" onClick={() => { setPrecioMax(null); window.history.replaceState(null, '', '/') }} className="px-2.5 py-0.5 rounded-full border border-line bg-panel text-inksoft text-xs">✕ Quitar</button>
          </div>
        )}

        {/* Fila 1 (como Mercado Libre): tipo de producto. */}
        <div className="flex gap-2 mb-3 items-center overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
          <button
            onClick={() => { setPublico('Todo'); quitarFiltroCategoria() }}
            aria-label="Ver todo"
            title="Ver todo"
            className={`w-9 h-9 rounded-full border flex items-center justify-center text-base shrink-0 ${
              categoria === 'Todo' && !rubroSel && !grupoSel ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
            }`}
          >
            🏠
          </button>
          {categoriasProductos.filter((c) => conteoCategorias[c.id]).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                elegirCategoria(c.id, null, null, false)
                fetch('/api/analitica/categoria', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tipo: 'producto', valor: c.label }),
                }).catch(() => {})
              }}
              className={`px-4 py-1.5 rounded-full border font-body text-sm font-medium shrink-0 whitespace-nowrap ${
                categoriaActual?.id === c.id ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {categoria === 'Todo' && !rubroSel && !grupoSel ? null : (
          // Fila 2: género como filtro secundario dentro de la categoría —
          // solo los que tienen productos ahí.
          publicosDisponibles.length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <button
                onClick={() => setPublico('Todo')}
                className={`px-3.5 py-1 rounded-full border font-body text-[13px] ${
                  publico === 'Todo' ? 'border-teal bg-tealsoft text-teal font-semibold' : 'border-line bg-panel text-inksoft'
                }`}
              >
                Todos
              </button>
              {publicosDisponibles.map((pub) => (
                <button
                  key={pub.id}
                  onClick={() => setPublico(pub.id)}
                  className={`px-3.5 py-1 rounded-full border font-body text-[13px] ${
                    publico === pub.id ? 'border-teal bg-tealsoft text-teal font-semibold' : 'border-line bg-panel text-inksoft'
                  }`}
                >
                  {pub.label} <span className="text-inksoft font-normal">({pub.cantidad})</span>
                </button>
              ))}
            </div>
          )
        )}

        {(rubroSel || grupoSel || categoria !== 'Todo') && categoriaActual && (
          <div className="flex flex-wrap items-center gap-2 mb-4 font-body text-sm">
            <Link href="/categorias" className="text-inksoft hover:text-teal">Categorías</Link>
            <span className="text-inksoft">›</span>
            <button type="button" onClick={() => elegirCategoria(categoriaActual.id, null)} className={rubroActual || grupoActual ? 'text-inksoft hover:text-teal' : 'text-ink font-semibold'}>{categoriaActual.label}</button>
            {grupoActual && (
              <>
                <span className="text-inksoft">›</span>
                <button type="button" onClick={() => elegirCategoria(categoriaActual.id, null, grupoActual.id)} className={rubroActual && rubroActual.id !== grupoActual.id ? 'text-inksoft hover:text-teal' : 'text-ink font-semibold'}>{grupoActual.label}</button>
              </>
            )}
            {rubroActual && rubroActual.id !== grupoActual?.id && (
              <>
                <span className="text-inksoft">›</span>
                <span className="text-ink font-semibold">{rubroActual.label}</span>
              </>
            )}
            <button type="button" onClick={quitarFiltroCategoria} className="ml-1 px-2.5 py-0.5 rounded-full border border-line bg-panel text-inksoft text-xs">✕ Quitar filtro</button>
          </div>
        )}

        {atajos.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 [scrollbar-width:none]">
            {atajos.map((x) => (
              <button
                key={x.tipo + x.id}
                type="button"
                onClick={() => (x.tipo === 'grupo' ? elegirCategoria(categoriaActual!.id, null, x.id, false) : elegirCategoria(categoriaActual!.id, x.id, null, false))}
                className="shrink-0 px-3 py-1 rounded-full border border-line bg-panel font-body text-[13px] text-ink hover:border-teal whitespace-nowrap"
              >
                {x.label} <span className="text-inksoft">({conteoCategorias[x.tipo === 'grupo' ? `g:${x.id}` : x.id]})</span>
              </button>
            ))}
          </div>
        )}

        <div id="grilla-productos" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 scroll-mt-4">
          {filtrados.map((p) => (
            <ProductCard key={p.id} p={p} ciudadComprador={ciudadId} />
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="text-center py-14 text-inksoft font-body text-sm">
            {todosLosProductos.length > 0 && productos.length === 0
              ? <>Todavía no hay productos en tu ciudad. ¿Vendés algo? <Link href="/vender" className="text-teal underline">Publicalo gratis</Link></>
              : 'No encontramos productos para esa búsqueda.'}
          </div>
        )}
        </>
        )}
      </div>

      <BarraInferiorCelular cantidadCarrito={cantidadCarrito} onCarrito={() => setCarritoAbierto(true)} logueado={!!usuario} />
      {carritoAbierto && <CartDrawer onClose={() => setCarritoAbierto(false)} />}
    </div>
  )
}
