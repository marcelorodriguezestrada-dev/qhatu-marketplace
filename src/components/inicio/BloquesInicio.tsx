'use client'

import Link from 'next/link'
import type { Producto } from '@/data/productos'
import { ProductCard } from '@/components/ProductCard'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import type { ItemCarrito } from '@/lib/store'

// Bloques del inicio (estilo Mercado Libre): antes de la grilla de
// productos, información útil y accesos rápidos.

const foto = (p: { thumbUrl?: string; imagenUrl?: string }) => p.thumbUrl || p.imagenUrl || ''

// Ícono de cada categoría principal (las de src/data/categoriasProductos.ts).
export const ICONO_CATEGORIA: Record<string, string> = {
  'accesorios-para-vehiculos': '🚗', agro: '🚜', 'alimentos-y-bebidas': '🥤', mascotas: '🐶', 'antiguedades-y-colecciones': '🏺',
  'arte-libreria-y-merceria': '✏️', 'autos-motos-y-otros': '🏍️', bebes: '🍼', 'belleza-y-cuidado-personal': '💄', 'camaras-y-accesorios': '📷',
  'celulares-y-telefonos': '📱', computacion: '💻', 'consolas-y-videojuegos': '🎮', construccion: '🧱', 'deportes-y-fitness': '⚽',
  'electrodomesticos-y-aires-ac': '🧺', 'electronica-audio-y-video': '🎧', 'entradas-para-eventos': '🎟️', herramientas: '🔧', hogar: '🛋️',
  'industrias-y-oficinas': '🏭', inmuebles: '🏠', 'instrumentos-musicales': '🎸', 'joyas-y-relojes': '⌚', 'juegos-y-juguetes': '🧸',
  'libros-revistas-y-comics': '📚', 'musica-peliculas-y-series': '🎬', ropa: '👗', 'salud-y-equipamiento-medico': '🩺', servicios: '🛠️',
  'souvenirs-cotillon-y-fiestas': '🎉', 'otros-productos': '📦',
}

function Circulo({ icono, label, onClick, href }: { icono: string; label: string; onClick?: () => void; href?: string }) {
  const contenido = (
    <>
      <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-panel border border-line shadow-sm flex items-center justify-center text-2xl sm:text-[28px] group-hover:border-verde transition-colors">{icono}</span>
      <span className="font-body text-[11px] sm:text-xs text-ink text-center leading-tight line-clamp-2 w-[72px]">{label}</span>
    </>
  )
  const clase = 'group flex flex-col items-center gap-1.5 shrink-0'
  return href ? <Link href={href} className={clase}>{contenido}</Link> : <button type="button" onClick={onClick} className={`${clase} bg-transparent border-none p-0`}>{contenido}</button>
}

// Fila de accesos: lo que se puede hacer en Clasi Click, de un toque.
export function AccesosInicio({ onProductos, onOfertas, hayOfertas, logueado }: { onProductos: () => void; onOfertas: () => void; hayOfertas: boolean; logueado: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:justify-between [scrollbar-width:none] mb-6">
      <Circulo icono="🛍️" label="Productos" onClick={onProductos} />
      {hayOfertas && <Circulo icono="🔥" label="Ofertas" onClick={onOfertas} />}
      <Circulo icono="🧑‍🔧" label="Servicios" href="/servicios" />
      <Circulo icono="📢" label="Anuncios" href="/anuncios" />
      <Circulo icono="🗂️" label="Categorías" href="/categorias" />
      <Circulo icono="🏪" label="Vendé gratis" href="/vender" />
      {logueado && <Circulo icono="📦" label="Mis pedidos" href="/mis-pedidos" />}
      <Circulo icono="❓" label="Ayuda" href="/ayuda" />
    </div>
  )
}

function Tarjeta({ titulo, children, boton, onBoton, href }: { titulo: string; children: React.ReactNode; boton: string; onBoton?: () => void; href?: string }) {
  const btn = 'block w-full text-center py-2 rounded-md bg-verdesoft text-verdeoscuro font-body text-xs font-semibold no-underline hover:bg-verde hover:text-white transition-colors'
  return (
    <div className="bg-panel rounded-xl shadow-sm border border-line/60 p-3.5 flex flex-col w-[170px] sm:w-auto shrink-0">
      <div className="font-display text-[15px] font-bold text-ink mb-2 leading-tight">{titulo}</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[120px]">{children}</div>
      <div className="mt-3">{href ? <Link href={href} className={btn}>{boton}</Link> : <button type="button" onClick={onBoton} className={`${btn} border-none`}>{boton}</button>}</div>
    </div>
  )
}

function Miniatura({ p, tam = 'w-24 h-24' }: { p: { nombre: string; thumbUrl?: string; imagenUrl?: string }; tam?: string }) {
  return foto(p) ? <img src={foto(p)} alt={p.nombre} loading="lazy" className={`${tam} object-contain`} /> : <span className={`${tam} flex items-center justify-center text-4xl`}>🛍️</span>
}

// Tarjetas informativas: tu carrito, lo último que viste, cómo se paga,
// el envío, precios bajos y vender.
export function TarjetasInicio({
  carrito, ultimoVisto, ciudadId, envioClasiClick, onAbrirCarrito, onMenosDe, topeBarato,
}: {
  carrito: ItemCarrito[]
  ultimoVisto: Producto | null
  ciudadId: string
  envioClasiClick: boolean
  onAbrirCarrito: () => void
  onMenosDe: (n: number) => void
  topeBarato: number
}) {
  const pais = paisDeCiudad(ciudadId)
  return (
    <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] mb-7">
      {carrito.length > 0 && (
        <Tarjeta titulo="Seguí con tu carrito" boton="Ir al carrito" onBoton={onAbrirCarrito}>
          <div className="flex -space-x-4">
            {carrito.slice(0, 2).map((it) => <Miniatura key={String(it.id)} p={it} tam="w-16 h-16" />)}
          </div>
          <div className="font-body text-[11px] text-inksoft mt-1">{carrito.reduce((s, i) => s + i.cantidad, 0)} producto(s) esperándote</div>
        </Tarjeta>
      )}
      {ultimoVisto && (
        <Tarjeta titulo="Visto recientemente" boton="Ver de nuevo" href={`/producto/${ultimoVisto.id}`}>
          <Miniatura p={ultimoVisto} />
          <div className="font-body text-[12px] text-ink line-clamp-2 mt-1">{ultimoVisto.nombre}</div>
        </Tarjeta>
      )}
      <Tarjeta titulo="Medios de pago" boton="Cómo pagar" href="/ayuda">
        <span className="text-4xl mb-1.5">📲</span>
        <div className="font-body text-[12px] text-inksoft">{pais.id === 'BO' ? 'Pagá con QR desde cualquier banco o billetera.' : 'Pagá con QR o transferencia.'}</div>
      </Tarjeta>
      {envioClasiClick ? (
        <Tarjeta titulo="Envío a tu casa" boton="Ver productos" onBoton={() => document.getElementById('grilla-productos')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="text-4xl mb-1.5">🛵</span>
          <div className="font-body text-[12px] text-inksoft">Recibilo mañana, o <b className="text-ink">hoy</b> con envío express.</div>
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Comprá cerca" boton="Ver productos" onBoton={() => document.getElementById('grilla-productos')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="text-4xl mb-1.5">🏬</span>
          <div className="font-body text-[12px] text-inksoft">Tiendas de tu ciudad: retiro o envío de cada tienda.</div>
        </Tarjeta>
      )}
      <Tarjeta titulo={`Menos de ${formatoMoneda(topeBarato, pais)}`} boton="Mostrar productos" onBoton={() => onMenosDe(topeBarato)}>
        <span className="text-4xl mb-1.5">🪙</span>
        <div className="font-body text-[12px] text-inksoft">Descubrí productos con precios bajos.</div>
      </Tarjeta>
      <Tarjeta titulo="¿Tenés algo para vender?" boton="Vendé gratis" href="/vender">
        <span className="text-4xl mb-1.5">🏪</span>
        <div className="font-body text-[12px] text-inksoft">Abrí tu tienda virtual en minutos.</div>
      </Tarjeta>
    </div>
  )
}

// Categorías con productos, como círculos con ícono.
export function CategoriasInicio({ categorias, onElegir }: { categorias: { id: string; label: string; cantidad: number }[]; onElegir: (id: string) => void }) {
  if (!categorias.length) return null
  return (
    <div className="bg-panel rounded-xl border border-line/60 shadow-sm p-4 mb-7">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-base sm:text-lg font-bold text-ink">Categorías</div>
        <Link href="/categorias" className="font-body text-xs text-verdeoscuro font-semibold">Ver todas ›</Link>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
        {categorias.map((c) => (
          <Circulo key={c.id} icono={ICONO_CATEGORIA[c.id] || '📦'} label={c.label} onClick={() => onElegir(c.id)} />
        ))}
      </div>
    </div>
  )
}

// Fila deslizable de productos con título ("🔥 Ofertas", "Novedades"…).
export function CarruselProductos({ id, titulo, productos, ciudadId, accion }: { id?: string; titulo: string; productos: Producto[]; ciudadId: string; accion?: { label: string; onClick: () => void } }) {
  if (!productos.length) return null
  return (
    <div id={id} className="bg-panel rounded-xl border border-line/60 shadow-sm p-4 mb-7 scroll-mt-28">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-base sm:text-lg font-bold text-ink">{titulo}</div>
        {accion && <button type="button" onClick={accion.onClick} className="font-body text-xs text-verdeoscuro font-semibold bg-transparent border-none">{accion.label} ›</button>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {productos.map((p) => (
          <div key={p.id} className="w-40 sm:w-44 shrink-0">
            <ProductCard p={p} ciudadComprador={ciudadId} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Portada cuando todavía no hay banners cargados: la marca y lo que es Clasi Click.
export function HeroInicio({ ciudad, onVer }: { ciudad: string; onVer: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl mb-6 bg-marca text-white px-5 sm:px-10 py-7 sm:py-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(22,195,91,0.25), transparent 55%)' }}>
      <div className="relative max-w-xl">
        <div className="inline-flex items-center gap-2 bg-marcaalt rounded-full px-3 py-1 font-body text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-white/70 mb-3">PRODUCTOS • SERVICIOS • ANUNCIOS</div>
        <div className="font-display text-2xl sm:text-4xl font-bold leading-tight">Ahorrá tiempo.<br /><span className="text-verde">Viví más feliz.</span></div>
        <div className="font-body text-sm sm:text-base text-white/75 mt-2 mb-4">Comprá en las tiendas de {ciudad}, contratá profesionales y encontrá avisos, todo en un solo lugar.</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onVer} className="px-4 py-2.5 rounded-lg bg-verde text-marca font-body text-sm font-bold border-none">Ver productos</button>
          <Link href="/vender" className="px-4 py-2.5 rounded-lg border border-white/30 text-white font-body text-sm font-semibold no-underline">Vendé gratis</Link>
        </div>
      </div>
      <svg viewBox="0 0 100 100" className="absolute -right-6 -bottom-8 w-48 h-48 sm:w-72 sm:h-72 opacity-25" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#16C35B" strokeWidth="4" strokeDasharray="9 6" />
        <path d="M22 66 L50 38 L78 66 L68 66 L50 48 L32 66 Z" fill="#16C35B" />
      </svg>
    </div>
  )
}

// Celular: barra fija abajo (como la app de Mercado Libre).
export function BarraInferiorCelular({ cantidadCarrito, onCarrito, logueado }: { cantidadCarrito: number; onCarrito: () => void; logueado: boolean }) {
  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 font-body text-[10px] no-underline bg-transparent border-none'
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-panel border-t border-line flex pb-[env(safe-area-inset-bottom)]" aria-label="Navegación principal">
      <Link href="/" className={`${item} text-verdeoscuro font-semibold`}><span className="text-xl">🏠</span>Inicio</Link>
      <Link href="/categorias" className={`${item} text-ink`}><span className="text-xl">🗂️</span>Categorías</Link>
      <button type="button" onClick={onCarrito} className={`${item} text-ink relative`}>
        <span className="text-xl">🛒</span>Carrito
        {cantidadCarrito > 0 && <span className="absolute top-0.5 left-1/2 ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-verde text-white text-[10px] font-bold flex items-center justify-center">{cantidadCarrito}</span>}
      </button>
      <Link href="/servicios" className={`${item} text-ink`}><span className="text-xl">🧑‍🔧</span>Servicios</Link>
      <Link href={logueado ? '/mis-pedidos' : '/login'} className={`${item} text-ink`}><span className="text-xl">👤</span>{logueado ? 'Mi cuenta' : 'Entrar'}</Link>
    </nav>
  )
}
