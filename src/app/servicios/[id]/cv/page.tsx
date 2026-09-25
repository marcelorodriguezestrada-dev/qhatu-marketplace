'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  PuestoLaboral,
  Idioma,
  ordenarHistorial,
  rangoFechas,
  separarLogro,
  filasEducacion,
  habilidadesDelHistorial,
} from '@/lib/cvEstandar'

// CV "oficial" y estandarizado de un profesional, armado con los datos
// de su perfil (ver src/lib/cvEstandar.ts). Mismo formato para todos,
// tenga o no la persona un CV propio. El PDF sale del propio navegador
// (window.print → "Guardar como PDF"): el texto queda seleccionable y
// no hace falta ninguna librería ni servicio extra.
//
// Los colores son fijos (no los de la marca) a propósito: es un
// documento para mandar a terceros y tiene que verse sobrio e igual
// impreso en blanco y negro.

const AZUL_OSCURO = '#1F3864'
const AZUL = '#2E75B6'
const GRIS = '#555'

type Perfil = {
  nombre: string
  especialidad?: string
  descripcion?: string
  experiencia?: string
  educacion?: string
  servicios?: string[]
  zona?: string
  direccion?: string
  email?: string
  whatsapp?: string
  historialLaboral?: PuestoLaboral[]
  idiomas?: Idioma[]
  cvPublico?: boolean
  // Lo agrega la API cuando el CV está oculto y quien mira no es ni el
  // dueño ni el admin (ver GET /api/profesionales/[id]).
  cvOculto?: boolean
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="cv-seccion" style={{ marginTop: 18 }}>
      <h2
        style={{
          color: AZUL_OSCURO,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          borderBottom: `1.5px solid ${AZUL}`,
          paddingBottom: 3,
          marginBottom: 9,
          breakAfter: 'avoid',
        }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function telefonoLegible(w?: string) {
  const d = (w || '').replace(/\D/g, '')
  return d ? `+${d}` : ''
}

export default function CVPage() {
  const params = useParams()
  const id = params.id as string
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const { usuario, cargando: authCargando, obtenerToken } = useAuth()

  // Mandamos el login (dueño) o la contraseña de admin guardada: si el
  // CV está oculto al público, la API solo lo devuelve a ellos dos.
  useEffect(() => {
    if (authCargando) return
    let cancelado = false
    ;(async () => {
      const headers: Record<string, string> = {}
      try {
        const pw = localStorage.getItem('clasiclick_admin_pw')
        if (pw) headers['x-admin-password'] = pw
      } catch {}
      if (usuario) {
        const token = await obtenerToken().catch(() => null)
        if (token) headers.Authorization = `Bearer ${token}`
      }
      try {
        const data = await fetch(`/api/profesionales/${id}?sinVista=1`, { headers }).then((r) => r.json())
        if (!cancelado) setPerfil(data.error ? null : data)
      } catch {
        if (!cancelado) setPerfil(null)
      }
    })()
    return () => { cancelado = true }
  }, [id, authCargando, usuario?.uid])

  // El título de la pestaña es el nombre que el navegador propone para
  // el PDF al "Guardar como PDF".
  useEffect(() => {
    if (!perfil?.nombre) return
    const anterior = document.title
    document.title = `CV_${perfil.nombre.trim().replace(/\s+/g, '_')}`
    return () => { document.title = anterior }
  }, [perfil?.nombre])

  if (perfil === undefined) {
    return <div className="py-16 text-center font-body text-sm text-inksoft">Cargando...</div>
  }
  if (!perfil) {
    return <div className="py-16 text-center font-body text-sm text-inksoft">No encontramos este perfil.</div>
  }
  if (perfil.cvOculto) {
    return (
      <div className="py-16 px-4 text-center font-body text-sm text-inksoft">
        El CV de este profesional no está disponible para descargar.{' '}
        <Link href={`/servicios/${id}`} className="underline">Volver al perfil</Link>
      </div>
    )
  }

  const historial = ordenarHistorial(perfil.historialLaboral || [])
  const educacion = filasEducacion(perfil.educacion)
  const habilidades = habilidadesDelHistorial(historial)
  const idiomas = perfil.idiomas || []
  const servicios = perfil.servicios || []
  const resumen = perfil.descripcion || perfil.experiencia || ''

  const lineaTitulos = educacion.length > 0 && educacion.length <= 3 ? educacion.map((e) => (e.institucion ? `${e.titulo} (${e.institucion})` : e.titulo)).join('  ·  ') : ''
  const contacto = [perfil.direccion || perfil.zona, perfil.email, telefonoLegible(perfil.whatsapp)].filter(Boolean).join('  ·  ')
  const incompleto = historial.length === 0

  return (
    <div className="cv-fondo min-h-screen py-6 px-3" style={{ background: '#E9E6DE' }}>
      <style>{`
        @page { size: A4; margin: 14mm 15mm; }
        @media print {
          .no-print { display: none !important; }
          .cv-fondo { background: #fff !important; padding: 0 !important; }
          .cv-hoja { box-shadow: none !important; padding: 0 !important; max-width: none !important; }
          body { background: #fff !important; }
        }
        .cv-hoja li, .cv-puesto-cabecera, .cv-fila { break-inside: avoid; }
      `}</style>

      <div className="no-print max-w-[794px] mx-auto mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/servicios/${id}`} className="font-body text-xs text-inksoft underline mr-auto">← Volver al perfil</Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
        >
          ⬇ Descargar PDF
        </button>
        <div className="w-full font-body text-[11px] text-inksoft text-right">
          En la ventana que se abre elegí &quot;Guardar como PDF&quot; como destino.
        </div>
        {perfil.cvPublico === false && (
          <div className="w-full font-body text-xs text-ink bg-ochresoft border border-ochre rounded-lg px-3 py-2">
            🔒 Este CV está oculto: no aparece en el perfil público y solo lo ven el profesional y el admin.
          </div>
        )}
        {incompleto && (
          <div className="w-full font-body text-xs text-ink bg-ochresoft border border-ochre rounded-lg px-3 py-2">
            Este CV todavía no tiene historial laboral. Cargalo desde <Link href="/mi-perfil" className="underline">Mi perfil → Mi CV</Link> para que quede completo.
          </div>
        )}
      </div>

      <article
        className="cv-hoja mx-auto bg-white"
        style={{
          maxWidth: 794,
          padding: '44px 52px 36px',
          boxShadow: '0 2px 14px rgba(0,0,0,0.12)',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#222',
          fontSize: 12,
          lineHeight: 1.42,
        }}
      >
        {/* --- Encabezado --- */}
        <header>
          <h1 style={{ color: AZUL_OSCURO, fontSize: 26, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.2, lineHeight: 1.15 }}>
            {perfil.nombre}
          </h1>
          {perfil.especialidad && <div style={{ color: AZUL, fontSize: 15, fontWeight: 700, marginTop: 4 }}>{perfil.especialidad}</div>}
          {lineaTitulos && <div style={{ color: GRIS, fontSize: 11.5, marginTop: 4 }}>{lineaTitulos}</div>}
          {contacto && <div style={{ color: GRIS, fontSize: 11.5, marginTop: 2 }}>{contacto}</div>}
        </header>

        {resumen && (
          <Seccion titulo="Resumen profesional">
            <p style={{ whiteSpace: 'pre-line' }}>{resumen}</p>
          </Seccion>
        )}

        {historial.length > 0 && (
          <Seccion titulo="Experiencia profesional">
            {historial.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div className="cv-puesto-cabecera" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingLeft: 6, breakAfter: 'avoid' }}>
                  <div>
                    <span style={{ color: AZUL_OSCURO, fontWeight: 700, fontSize: 13 }}>{p.cargo}</span>
                    {p.empresa && <span style={{ color: GRIS }}>{'  ·  '}{p.empresa.toUpperCase()}</span>}
                    {p.cliente && <span style={{ color: GRIS }}>{'  ·  '}({p.cliente})</span>}
                  </div>
                  <div style={{ color: GRIS, fontStyle: 'italic', whiteSpace: 'nowrap', fontSize: 11.5 }}>{rangoFechas(p)}</div>
                </div>
                {p.logros.length > 0 && (
                  <ul style={{ listStyle: 'disc', paddingLeft: 28, marginTop: 4 }}>
                    {p.logros.map((l, i) => {
                      const { titulo, detalle } = separarLogro(l)
                      return (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {titulo && <strong>{titulo}: </strong>}
                          {detalle}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {p.stack.length > 0 && (
                  <div style={{ fontSize: 11, marginTop: 3, color: GRIS }}>
                    <strong style={{ color: '#333' }}>Stack: </strong>
                    <em>{p.stack.join(' · ')}</em>
                  </div>
                )}
              </div>
            ))}
          </Seccion>
        )}

        {servicios.length > 0 && (
          <Seccion titulo="Servicios que ofrece">
            <ul style={{ listStyle: 'disc', paddingLeft: 22 }}>
              {servicios.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s}</li>)}
            </ul>
          </Seccion>
        )}

        {habilidades.length > 0 && (
          <Seccion titulo="Habilidades y herramientas">
            <div style={{ background: '#EEF4FB', border: '1px solid #DCE6F2', padding: '7px 10px' }}>{habilidades.join('  ·  ')}</div>
          </Seccion>
        )}

        {educacion.length > 0 && (
          <Seccion titulo="Educación">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {educacion.map((e, i) => (
                  <tr key={i} className="cv-fila" style={{ borderBottom: '1px solid #E4E4E4' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, width: e.institucion ? '58%' : '100%' }}>{e.titulo}</td>
                    {e.institucion && <td style={{ padding: '6px 8px', color: '#777' }}>{e.institucion}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}

        {idiomas.length > 0 && (
          <Seccion titulo="Idiomas">
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 22, rowGap: 2 }}>
              {idiomas.map((x, i) => (
                <span key={i}>
                  <strong>{x.idioma}:</strong> {x.nivel}
                </span>
              ))}
            </div>
          </Seccion>
        )}

        <footer style={{ marginTop: 26, paddingTop: 6, borderTop: '1px solid #E4E4E4', color: '#999', fontSize: 9.5, textAlign: 'center' }}>
          CV generado en Clasi Click · {typeof window !== 'undefined' ? `${window.location.host}/servicios/${id}` : ''}
        </footer>
      </article>
    </div>
  )
}
