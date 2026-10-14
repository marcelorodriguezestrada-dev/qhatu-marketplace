import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/sitio'
import { esCiudadAbierta, landingsDeCiudad, nombreCiudad, urlLanding } from '@/lib/landing'
import { CabeceraLanding, ListaLinks, Migas } from '@/components/landing/PiezasLanding'

// /potosi — todo lo que hay en la ciudad: categorías de productos y
// servicios con su cantidad (cada una lleva a su página). Ver src/lib/landing.ts.
export const revalidate = 3600

export async function generateMetadata({ params }: { params: { ciudad: string } }): Promise<Metadata> {
  if (!(await esCiudadAbierta(params.ciudad).catch(() => false)) || !(await landingsDeCiudad(params.ciudad).catch(() => [])).length) return { title: 'Clasi Click', robots: { index: false } }
  const ciudad = nombreCiudad(params.ciudad)
  return {
    title: `Comprar y contratar en ${ciudad} — tiendas y profesionales | Clasi Click`,
    description: `Tiendas y profesionales de ${ciudad} en un solo lugar: ropa, calzado, tecnología y más con pago QR y envío a domicilio, y electricistas, abogados, médicos y otros servicios por WhatsApp.`,
    alternates: { canonical: `${SITE_URL}/${params.ciudad}` },
  }
}

export default async function CiudadPage({ params }: { params: { ciudad: string } }) {
  if (!(await esCiudadAbierta(params.ciudad).catch(() => false))) notFound()
  const ciudad = nombreCiudad(params.ciudad)
  const todas = await landingsDeCiudad(params.ciudad)
  if (!todas.length) notFound() // sin nada publicado todavía: sin página vacía
  const cats = (tipo: 'servicios' | 'productos') => todas.filter((l) => l.tipo === tipo && l.nivel === 'categoria').sort((a, b) => b.ids.length - a.ids.length)
  const rubros = todas.filter((l) => l.tipo === 'servicios' && l.nivel === 'rubro').sort((a, b) => b.ids.length - a.ids.length).slice(0, 30)
  const subcats = todas.filter((l) => l.tipo === 'productos' && l.nivel === 'grupo').sort((a, b) => b.ids.length - a.ids.length).slice(0, 30)
  const link = (l: (typeof todas)[number]) => ({ href: urlLanding(params.ciudad, l), label: l.label, n: l.ids.length })

  return (
    <div className="min-h-screen bg-bg">
      <CabeceraLanding />
      <main className="max-w-[1100px] mx-auto px-4 py-6">
        <Migas items={[{ href: '/', label: 'Inicio' }, { label: ciudad }]} />
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mb-2">Clasi Click en {ciudad}</h1>
        <p className="font-body text-sm text-inksoft max-w-[760px] mb-2">
          Comprá en tiendas de {ciudad} y pagá con QR, con envío a tu casa. Y encontrá profesionales de tu ciudad para contactarlos por WhatsApp.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/" className="px-4 py-2.5 rounded-lg bg-ink text-white font-body text-sm font-semibold no-underline">🛍️ Ver productos</Link>
          <Link href="/servicios" className="px-4 py-2.5 rounded-lg border border-line bg-panel text-ink font-body text-sm font-semibold no-underline">🧰 Ver servicios</Link>
        </div>
        <ListaLinks titulo={`Productos en ${ciudad}`} links={cats('productos').map(link)} />
        <ListaLinks titulo="Categorías populares" links={subcats.map(link)} />
        <ListaLinks titulo={`Servicios en ${ciudad}`} links={cats('servicios').map(link)} />
        <ListaLinks titulo="Profesionales por rubro" links={rubros.map(link)} />
      </main>
    </div>
  )
}
