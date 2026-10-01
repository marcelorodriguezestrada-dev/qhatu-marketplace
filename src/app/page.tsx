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
import { puntajeRelacionado, relevancia } from '@/lib/busqueda'
import ListadoResultados from '@/components/ListadoResultados'
import { useCarrito } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'
import { PUBLICOS_PRODUCTO } from '@/data/publicoProducto'
import MenuCategorias from '@/components/MenuCategorias'
import { SelectorCiudad, BannerCiudad } from '@/components/SelectorCiudad'
import { useCiudad } from '@/lib/ciudad'
import { productoEnCiudad } from '@/data/ciudades'

export default function CatalogoPage() {
  const { categorias: categoriasProductos, buscarRubroProducto } = useCategoriasProductos()
  const [todosLosProductos, setProductos] = useState<Producto[]>(PRODUCTOS_SEED)
  // Productos de la ciudad del comprador + los de tiendas que envían a
  // todo Bolivia (llevan "🚚 Envía desde …").
  const { ciudadId } = useCiudad()
  const productos = todosLosProductos.filter((p) => productoEnCiudad(p as any, ciudadId))
  const [publico, setPublico] = useState('Todo')
  const [categoria, setCategoria] = useState('Todo')
  // Rubro elegido desde el menú "Categorías" o /categorias (?rubro=).
  const [rubroSel, setRubroSel] = useState<string | null>(null)
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

  const filtrados = productos.filter((p) => {
    const matchPublico = publico === 'Todo' || (p.publico || 'unisex') === publico
    const matchCat = rubroSel ? p.rubro === rubroSel : categoria === 'Todo' || buscarRubroProducto(p.rubro)?.categoriaId === categoria
    return matchPublico && matchCat
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
    const exactos: Producto[] = []
    const parecidos: Producto[] = []
    for (const p of productos) {
      const r = relevancia(p as any, buscarRubroProducto(p.rubro), consulta)
      if (r === 'exacto') exactos.push(p)
      else if (r === 'relacionado') parecidos.push(p)
    }
    parecidos.sort((a, b) => puntajeRelacionado(b as any, consulta) - puntajeRelacionado(a as any, consulta))
    return { resultadosBusqueda: [...exactos, ...parecidos], relacionadosBusqueda: new Set(parecidos.map((p) => String(p.id))) }
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
    if (cat) setCategoria(cat)
    if (rub) setRubroSel(rub)
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
    const cid = buscarRubroProducto(p.rubro)?.categoriaId
    if (cid) conteoCategorias[cid] = (conteoCategorias[cid] || 0) + 1
  }
  const categoriaActual = categoriasProductos.find((c) => c.id === (rubroSel ? buscarRubroProducto(rubroSel)?.categoriaId : categoria))
  const rubroActual = rubroSel ? buscarRubroProducto(rubroSel) : undefined

  // Mujer / Hombre / Niños / Otros con productos dentro de la categoría
  // (o rubro) elegida — el filtro secundario.
  const enCategoria = productos.filter((p) => (rubroSel ? p.rubro === rubroSel : categoria !== 'Todo' && buscarRubroProducto(p.rubro)?.categoriaId === categoria))
  const publicosDisponibles = PUBLICOS_PRODUCTO.map((pub) => ({ ...pub, cantidad: enCategoria.filter((p) => (p.publico || 'unisex') === pub.id).length })).filter((pub) => pub.cantidad > 0)

  function elegirCategoria(catId: string, rubroId: string | null, bajar = true) {
    setMenuCategorias(false)
    setCategoria(catId)
    setRubroSel(rubroId)
    setPublico('Todo')
    const params = new URLSearchParams()
    params.set(rubroId ? 'rubro' : 'categoria', rubroId || catId)
    window.history.replaceState(null, '', `/?${params.toString()}`)
    if (bajar) setTimeout(() => document.getElementById('grilla-productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function quitarFiltroCategoria() {
    setPublico('Todo')
    setCategoria('Todo')
    setRubroSel(null)
    window.history.replaceState(null, '', '/')
  }

  return (
    <div className="min-h-screen">
      <div className="bg-ink px-4 sm:px-5 py-3">
        <div className="max-w-[960px] mx-auto">
          <div className="flex items-center gap-3 mb-2.5">
            <Link href="/" className="font-display text-xl font-bold text-white shrink-0">Clasi Click</Link>
            <div className="flex-1" />
            {/* La campanita va acá arriba (no en la fila de links de abajo):
                esa fila se desplaza de costado en el celular y cortaba
                tanto la campanita como su panel. */}
            {usuario && <NotificacionesBell variante="oscura" />}
            <button
              onClick={() => setCarritoAbierto(true)}
              className="border-none bg-white/10 text-white px-3 sm:px-4 py-2 rounded-lg font-body text-sm shrink-0 whitespace-nowrap"
            >
              🛒 {cantidadCarrito > 0 && `(${cantidadCarrito})`}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2.5">
            <BuscadorProductos
              valor={busqueda}
              onCambiar={setBusqueda}
              onBuscar={buscar}
              productos={productos}
              rubroDe={buscarRubroProducto}
            />
            <button
              type="button"
              onClick={() => buscar(busqueda)}
              className="px-3 py-2 rounded-lg bg-white/20 text-white text-sm shrink-0"
              aria-label="Buscar"
            >
              🔍
            </button>
          </div>

          <div className="relative">
          <MenuCategorias
            categorias={categoriasProductos}
            abierto={menuCategorias}
            onCerrar={() => setMenuCategorias(false)}
            onElegir={elegirCategoria}
            conteo={conteoCategorias}
          />
          <div className="flex items-center gap-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
            <SelectorCiudad />
            <button type="button" onClick={() => setMenuCategorias((v) => !v)} className="border-none bg-transparent text-white font-body text-[13px] font-semibold shrink-0 whitespace-nowrap">
              Categorías ▾
            </button>
            <Link href="/servicios" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
              Servicios
            </Link>
            <Link href="/anuncios" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
              Anuncios
            </Link>
            <Link href="/ayuda" className="border-none bg-transparent text-white/60 font-body text-[13px] shrink-0 whitespace-nowrap">
              Ayuda
            </Link>
            <Link href="/vender" className="border-none bg-white/10 text-white px-3 py-1.5 rounded-lg font-body text-[13px] shrink-0 whitespace-nowrap">
              Vender
            </Link>
            {usuario ? (
              <>
                <Link href="/mis-pedidos" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
                  Mis pedidos
                </Link>
                <button onClick={() => logout()} className="border-none bg-transparent text-white/60 font-body text-[12px] shrink-0 whitespace-nowrap">
                  {usuario.email?.split('@')[0]} · salir
                </button>
              </>
            ) : (
              <Link href="/login" className="border-none bg-transparent text-white/80 font-body text-[13px] shrink-0 whitespace-nowrap">
                Iniciar sesión
              </Link>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-12">
        <BannerCiudad />
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
        {portada?.accesos !== false && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Estás en Productos: ese botón va en verde (seleccionado) y
              Servicios en blanco. */}
          <div className="bg-teal border-2 border-teal rounded-xl p-4 sm:p-5 text-center" aria-current="page">
            <div className="text-2xl mb-1">🛍️</div>
            <div className="font-display text-sm sm:text-base font-bold text-white">Productos</div>
            <div className="font-body text-[11px] sm:text-xs text-white/80">Comprá acá abajo</div>
          </div>
          <Link
            href="/servicios"
            className="bg-panel border-2 border-line hover:border-teal rounded-xl p-4 sm:p-5 text-center"
          >
            <div className="text-2xl mb-1">🧑‍🔧</div>
            <div className="font-display text-sm sm:text-base font-bold text-ink">Servicios</div>
            <div className="font-body text-[11px] sm:text-xs text-inksoft">Profesionales</div>
          </Link>
        </div>
        )}

        {portada?.ofertas && ofertas.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🔥</span>
              <div className="font-display text-base font-bold text-ink">Ofertas</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
              {ofertas.map((p) => (
                <div key={p.id} className="w-40 sm:w-44 shrink-0">
                  <ProductCard p={p} ciudadComprador={ciudadId} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fila 1 (como Mercado Libre): tipo de producto. */}
        <div className="flex gap-2 mb-3 items-center overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
          <button
            onClick={() => { setPublico('Todo'); quitarFiltroCategoria() }}
            aria-label="Ver todo"
            title="Ver todo"
            className={`w-9 h-9 rounded-full border flex items-center justify-center text-base shrink-0 ${
              categoria === 'Todo' && !rubroSel ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
            }`}
          >
            🏠
          </button>
          {categoriasProductos.filter((c) => conteoCategorias[c.id]).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                elegirCategoria(c.id, null, false)
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

        {portada?.cupon && <BannerCuponPromo />}

        {categoria === 'Todo' && !rubroSel ? (
          portada?.banners && <BannerCarousel />
        ) : (
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

        {(rubroSel || categoria !== 'Todo') && categoriaActual && (
          <div className="flex flex-wrap items-center gap-2 mb-4 font-body text-sm">
            <Link href="/categorias" className="text-inksoft hover:text-teal">Categorías</Link>
            <span className="text-inksoft">›</span>
            <button type="button" onClick={() => elegirCategoria(categoriaActual.id, null)} className={rubroActual ? 'text-inksoft hover:text-teal' : 'text-ink font-semibold'}>{categoriaActual.label}</button>
            {rubroActual && (
              <>
                <span className="text-inksoft">›</span>
                <span className="text-ink font-semibold">{rubroActual.label}</span>
              </>
            )}
            <button type="button" onClick={quitarFiltroCategoria} className="ml-1 px-2.5 py-0.5 rounded-full border border-line bg-panel text-inksoft text-xs">✕ Quitar filtro</button>
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

      {carritoAbierto && <CartDrawer onClose={() => setCarritoAbierto(false)} />}
    </div>
  )
}
