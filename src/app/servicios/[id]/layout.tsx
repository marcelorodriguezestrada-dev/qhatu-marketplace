import type { Metadata } from 'next'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { SITE_URL } from '@/lib/sitio'
import { jsonLdProfesional, ldJson, leerProfesionalPublico, nombreRubroServidor, textoCorto } from '@/lib/seo'
import { DatosIniciales } from '@/components/DatosIniciales'

// Perfil de un profesional: título "Nombre — Rubro en Ciudad" para Google,
// vista previa al compartir, datos estructurados (ProfessionalService:
// dirección, zona, servicios, estrellas) y el perfil ya leído para que la
// página llegue armada.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  await cargarCiudadesServidor().catch(() => null)
  const p = await leerProfesionalPublico(params.id)
  if (!p) return { title: 'Servicio | Clasi Click', robots: { index: false } }
  const rubro = p.especialidad || (await nombreRubroServidor(p.rubro))
  const ciudad = buscarCiudad(ciudadDe(p)).nombre
  const titulo = `${p.nombre} — ${rubro} en ${ciudad}`
  const servicios = Array.isArray(p.servicios) ? p.servicios.map((s: any) => String(s?.nombre || s)).filter(Boolean).slice(0, 4) : []
  const descripcion = (
    textoCorto(p.descripcion, 120) ||
    `${rubro} en ${ciudad}${p.zona ? `, ${p.zona}` : ''}.`
  ) + (servicios.length ? ` ${servicios.join(' · ')}.` : '') + ' Contacto por WhatsApp en Clasi Click.'
  const url = `${SITE_URL}/servicios/${params.id}`
  return {
    title: `${titulo} | Clasi Click`,
    description: descripcion.slice(0, 200),
    keywords: [rubro, `${rubro} ${ciudad}`, `${rubro} en ${ciudad}`, ...(p.zona ? [`${rubro} ${p.zona}`] : []), ...servicios],
    alternates: { canonical: url },
    openGraph: { type: 'profile', siteName: 'Clasi Click', locale: 'es_BO', url, title: titulo, description: descripcion.slice(0, 200), ...(p.imagenUrl ? { images: [{ url: p.imagenUrl, alt: p.nombre }] } : {}) },
  }
}

export default async function ServicioLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const p = await leerProfesionalPublico(params.id)
  const rubro = p ? p.especialidad || (await nombreRubroServidor(p.rubro)) : ''
  return (
    <>
      {p && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLdProfesional(p, rubro)) }} />}
      <DatosIniciales datos={p ? { profesional: p } : {}}>{children}</DatosIniciales>
    </>
  )
}
