import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/sitio'
import { ldJson } from '@/lib/seo'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { buscarLanding, esCiudadAbierta, itemsDeLanding, landingsDeCiudad, nombreCiudad, urlLanding, type Landing } from '@/lib/landing'
import { CabeceraLanding, ListaLinks, Migas, Preguntas, TarjetaProducto, TarjetaProfesional } from '@/components/landing/PiezasLanding'

// /potosi/servicios/electricista · /potosi/productos/calzado — ver src/lib/landing.ts.
export const revalidate = 3600

type Params = { ciudad: string; tipo: string; slug: string }

async function datos(params: Params) {
  if (params.tipo !== 'servicios' && params.tipo !== 'productos') return null
  if (!(await esCiudadAbierta(params.ciudad).catch(() => false))) return null
  const l = await buscarLanding(params.ciudad, params.tipo, params.slug)
  if (!l) return null
  const items = await itemsDeLanding(params.ciudad, l)
  return { l, items, ciudad: nombreCiudad(params.ciudad) }
}

function titulos(l: Landing, ciudad: string, n: number) {
  const que = l.tipo === 'servicios' ? (n === 1 ? 'profesional' : 'profesionales') : n === 1 ? 'producto' : 'productos'
  return {
    h1: `${l.label} en ${ciudad}`,
    title: `${l.label} en ${ciudad} — ${n} ${que} | Clasi Click`,
  }
}

function rangoPrecios(items: any[], ciudadId: string) {
  const precios = items.map((p) => Number(p.precio)).filter((x) => x > 0)
  if (!precios.length) return null
  const pais = paisDeCiudad(ciudadId)
  return { min: formatoMoneda(Math.min(...precios), pais), max: formatoMoneda(Math.max(...precios), pais) }
}

function zonas(items: any[]) {
  return [...new Set(items.map((p) => String(p.zona || '').trim()).filter(Boolean))].slice(0, 6)
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = await datos(params)
  if (!d) return { title: 'Clasi Click', robots: { index: false } }
  const { l, items, ciudad } = d
  const t = titulos(l, ciudad, items.length)
  const z = zonas(items)
  const rango = rangoPrecios(items, params.ciudad)
  const description =
    l.tipo === 'servicios'
      ? `${items.length} ${l.label.toLowerCase()} en ${ciudad}${z.length ? ` (${z.slice(0, 3).join(', ')})` : ''}. Mirá sus servicios y reseñas, y contactalos directo por WhatsApp en Clasi Click.`
      : `${items.length} productos de ${l.label.toLowerCase()} en ${ciudad}${rango ? ` desde ${rango.min}` : ''}. Comprá en tiendas de tu ciudad, pagá con QR y recibí en tu casa.`
  const url = `${SITE_URL}${urlLanding(params.ciudad, l)}`
  return {
    title: t.title,
    description: description.slice(0, 200),
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Clasi Click', locale: 'es_BO', url, title: t.h1, description: description.slice(0, 200) },
  }
}

export default async function LandingPage({ params }: { params: Params }) {
  const d = await datos(params)
  if (!d) notFound()
  const { l, items, ciudad } = d
  const t = titulos(l, ciudad, items.length)
  const todas = await landingsDeCiudad(params.ciudad)
  const z = zonas(items)
  const rango = rangoPrecios(items, params.ciudad)
  const url = `${SITE_URL}${urlLanding(params.ciudad, l)}`

  // Relacionadas: los rubros / subcategorías de la misma categoría, y la categoría de arriba.
  const categoriaSlug = l.nivel === 'categoria' ? l.slug : l.padre?.slug
  const hermanas = todas
    .filter((x) => x.tipo === l.tipo && x.slug !== l.slug && (x.padre?.slug === categoriaSlug || (l.nivel !== 'categoria' && x.slug === categoriaSlug)))
    .slice(0, 24)
  const otrasCategorias = todas.filter((x) => x.tipo === l.tipo && x.nivel === 'categoria' && x.slug !== categoriaSlug).slice(0, 16)

  const preguntas =
    l.tipo === 'servicios'
      ? [
          { p: `¿Cómo contacto a un profesional de ${l.label.toLowerCase()} en ${ciudad}?`, r: `Entrá al perfil del profesional y tocá "Contactar por WhatsApp": le escribís directo, sin intermediarios. Algunos también te dejan reservar un turno en su consultorio o una videollamada.` },
          { p: `¿Cuántos profesionales de ${l.label.toLowerCase()} hay en ${ciudad}?`, r: `Hoy hay ${items.length} ${items.length === 1 ? 'profesional publicado' : 'profesionales publicados'}${z.length ? `, en zonas como ${z.join(', ')}` : ''}. Cada perfil muestra qué hace, sus estudios y las reseñas de otros clientes.` },
          { p: '¿Es gratis buscar un profesional?', r: 'Sí. Buscar, ver perfiles y escribirles por WhatsApp es gratis.' },
          { p: `Trabajo en ${l.label.toLowerCase()}, ¿cómo aparezco acá?`, r: 'Publicá tu perfil gratis desde "Ofrecer un servicio" en Clasi Click. Lo revisamos y queda visible en tu ciudad.' },
        ]
      : [
          { p: `¿Dónde comprar ${l.label.toLowerCase()} en ${ciudad}?`, r: `En Clasi Click hay ${items.length} ${items.length === 1 ? 'producto' : 'productos'} de ${l.label.toLowerCase()} de tiendas de ${ciudad}${rango ? `, con precios desde ${rango.min} hasta ${rango.max}` : ''}.` },
          { p: '¿Cómo pago?', r: 'Pagás con QR desde la app de tu banco y subís el comprobante; la tienda confirma el pedido.' },
          { p: '¿Hacen envíos a domicilio?', r: `Sí: elegís el envío a tu casa en ${ciudad} (o retirar en la tienda) al momento de comprar.` },
          { p: 'Tengo una tienda, ¿puedo vender acá?', r: 'Sí, abrir tu tienda en Clasi Click es gratis desde "Vendé gratis".' },
        ]

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Clasi Click', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: ciudad, item: `${SITE_URL}/${params.ciudad}` },
        ...(l.padre ? [{ '@type': 'ListItem', position: 3, name: l.padre.label, item: `${SITE_URL}/${params.ciudad}/${l.tipo}/${l.padre.slug}` }] : []),
        { '@type': 'ListItem', position: l.padre ? 4 : 3, name: l.label, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t.h1,
      itemListElement: items.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/${l.tipo === 'servicios' ? 'servicios' : 'producto'}/${p.id}`, name: p.nombre })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: preguntas.map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
    },
  ]

  const ordenados =
    l.tipo === 'servicios'
      ? [...items].sort((a, b) => Number(b.plan === 'premium') - Number(a.plan === 'premium') || (Number(b.ratingPromedio) || 0) - (Number(a.ratingPromedio) || 0) || (b.clicsWhatsapp || 0) - (a.clicsWhatsapp || 0))
      : [...items].sort((a, b) => Number(b.plan === 'premium') - Number(a.plan === 'premium') || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  return (
    <div className="min-h-screen bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <CabeceraLanding />
      <main className="max-w-[1100px] mx-auto px-4 py-6">
        <Migas
          items={[
            { href: '/', label: 'Inicio' },
            { href: `/${params.ciudad}`, label: ciudad },
            ...(l.padre ? [{ href: `/${params.ciudad}/${l.tipo}/${l.padre.slug}`, label: l.padre.label }] : []),
            { label: l.label },
          ]}
        />
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mb-2">{t.h1}</h1>
        <p className="font-body text-sm text-inksoft max-w-[760px] mb-6">
          {l.tipo === 'servicios'
            ? `${items.length} ${items.length === 1 ? 'profesional' : 'profesionales'} de ${l.label.toLowerCase()} en ${ciudad}${z.length ? `, en zonas como ${z.join(', ')}` : ''}. Mirá qué hace cada uno, sus reseñas y contactalos directo por WhatsApp.`
            : `${items.length} ${items.length === 1 ? 'producto' : 'productos'} de ${l.label.toLowerCase()} de tiendas de ${ciudad}${rango ? `, desde ${rango.min}` : ''}. Pagá con QR y recibilo en tu casa.`}
        </p>

        {l.tipo === 'servicios' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ordenados.map((p) => <TarjetaProfesional key={p.id} p={p} rubro={l.label} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ordenados.slice(0, 60).map((p) => <TarjetaProducto key={p.id} p={p} />)}
          </div>
        )}

        <div className="mt-6">
          <Link href={l.tipo === 'servicios' ? '/servicios' : '/'} className="inline-block px-4 py-2.5 rounded-lg bg-ink text-white font-body text-sm font-semibold no-underline">
            {l.tipo === 'servicios' ? 'Ver todos los servicios' : 'Ver todos los productos'}
          </Link>
        </div>

        <ListaLinks titulo={l.tipo === 'servicios' ? 'Servicios relacionados' : 'También te puede interesar'} links={hermanas.map((x) => ({ href: urlLanding(params.ciudad, x), label: x.label, n: x.ids.length }))} />
        <ListaLinks titulo={`Más en ${ciudad}`} links={otrasCategorias.map((x) => ({ href: urlLanding(params.ciudad, x), label: x.label, n: x.ids.length }))} />
        <Preguntas items={preguntas} />
      </main>
    </div>
  )
}
