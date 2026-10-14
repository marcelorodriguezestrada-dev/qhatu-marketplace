import Link from 'next/link'
import { LogoClasiClick } from '@/components/LogoClasiClick'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { ciudadDe } from '@/data/ciudades'

// Piezas de las páginas por ciudad y rubro (servidor, sin JS): Google las
// lee completas. Los links llevan a las páginas de siempre.

export function CabeceraLanding() {
  return (
    <header className="bg-marca">
      <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/" aria-label="Clasi Click — inicio"><LogoClasiClick size={30} /></Link>
        <nav className="flex gap-3 sm:gap-4 font-body text-sm whitespace-nowrap">
          <Link href="/" className="hidden sm:inline text-white/85 hover:text-white">Productos</Link>
          <Link href="/servicios" className="text-white/85 hover:text-white">Servicios</Link>
          <Link href="/vender" className="text-verde font-semibold">Vendé gratis</Link>
        </nav>
      </div>
    </header>
  )
}

export function Migas({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Ubicación" className="font-body text-xs text-inksoft mb-3 flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span key={i} className="flex gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          {it.href ? <Link href={it.href} className="hover:underline">{it.label}</Link> : <span className="text-ink">{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function TarjetaProfesional({ p, rubro }: { p: any; rubro: string }) {
  const servicios = Array.isArray(p.servicios) ? p.servicios.map((s: any) => String(s?.nombre || s)).filter(Boolean).slice(0, 3) : []
  return (
    <Link href={`/servicios/${p.id}`} className="block bg-panel border border-line rounded-xl p-4 hover:border-teal no-underline">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-maroonsoft text-maroon font-display font-bold flex items-center justify-center overflow-hidden shrink-0">
          {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} loading="lazy" className="w-full h-full object-cover" /> : String(p.nombre || '?').split(/\s+/).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink truncate m-0">{p.nombre}</h3>
          <div className="font-body text-xs text-maroon font-semibold truncate">{p.especialidad || rubro}</div>
        </div>
      </div>
      {Number(p.cantidadResenas) > 0 && Number(p.ratingPromedio) > 0 && (
        <div className="font-body text-xs text-ochre mb-1">★ {Number(p.ratingPromedio).toFixed(1)} <span className="text-inksoft">({p.cantidadResenas} reseñas)</span></div>
      )}
      {p.zona && <div className="font-body text-xs text-inksoft mb-1">📍 {p.zona}{p.atiendeOnline ? ' · 💻 también online' : ''}</div>}
      {servicios.length > 0 && <div className="font-body text-xs text-ink">{servicios.join(' · ')}</div>}
    </Link>
  )
}

export function TarjetaProducto({ p }: { p: any }) {
  const pais = paisDeCiudad(ciudadDe(p))
  return (
    <Link href={`/producto/${p.id}`} className="block bg-panel border border-line rounded-xl overflow-hidden hover:border-teal no-underline">
      <div className="aspect-square bg-panelalt">
        {(p.thumbUrl || p.imagenUrl) && <img src={p.thumbUrl || p.imagenUrl} alt={p.nombre} loading="lazy" className="w-full h-full object-cover" />}
      </div>
      <div className="p-3">
        <h3 className="font-body text-sm text-ink line-clamp-2 m-0 mb-1">{p.nombre}</h3>
        <div className="font-display text-lg font-bold text-ink">{formatoMoneda(Number(p.precio || 0), pais)}</div>
        {p.tiendaNombre && <div className="font-body text-[11px] text-inksoft truncate">{p.tiendaNombre}</div>}
      </div>
    </Link>
  )
}

export function Preguntas({ items }: { items: { p: string; r: string }[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink mb-3">Preguntas frecuentes</h2>
      <div className="grid gap-2">
        {items.map((it) => (
          <details key={it.p} className="bg-panel border border-line rounded-lg p-3">
            <summary className="font-body text-sm font-semibold text-ink cursor-pointer">{it.p}</summary>
            <p className="font-body text-sm text-inksoft mt-2 mb-0">{it.r}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function ListaLinks({ titulo, links }: { titulo: string; links: { href: string; label: string; n?: number }[] }) {
  if (!links.length) return null
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-ink mb-3">{titulo}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-full bg-panel border border-line font-body text-sm text-ink hover:border-teal no-underline">
            {l.label}{l.n != null && <span className="text-inksoft"> ({l.n})</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}
