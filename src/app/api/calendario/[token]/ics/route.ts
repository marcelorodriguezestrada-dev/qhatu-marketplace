import { NextRequest } from 'next/server'
import { REDES_LANZAMIENTO } from '@/lib/lanzamiento'
import { publicacionesCompartidas, validarToken } from '@/lib/calendarioCompartido'

export const dynamic = 'force-dynamic'

// El calendario en formato iCalendar: se suscribe desde Google Calendar o
// el calendario del celular y se actualiza solo. Un evento de día entero
// por publicación.
const esc = (t: string) => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
// Las líneas de iCalendar van de a 75 caracteres.
const plegar = (l: string) => l.match(/.{1,73}/g)!.join('\r\n ')
const fechaIcs = (iso: string) => iso.replace(/-/g, '')
const siguiente = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  if (!(await validarToken(params.token))) return new Response('Link vencido', { status: 404 })
  const pubs = await publicacionesCompartidas()
  const ahora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clasi Click//Calendario de marketing//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Clasi Click · Publicaciones', 'X-WR-TIMEZONE:America/La_Paz']
  for (const p of pubs) {
    const red = REDES_LANZAMIENTO.find((r) => r.id === p.red)
    const estado = p.estado === 'publicada' ? '✓ ' : ''
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${p.id}@clasiclick.com`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${fechaIcs(p.fecha)}`,
      `DTEND;VALUE=DATE:${fechaIcs(siguiente(p.fecha))}`,
      plegar(`SUMMARY:${esc(`${estado}${red?.icono || ''} ${red?.label || p.red}: ${p.titulo}`)}`),
      plegar(`DESCRIPTION:${esc(`${p.idea ? `Qué grabar: ${p.idea}\n\n` : ''}Texto:\n${p.texto}`)}`),
      ...(p.link ? [plegar(`URL:${p.link}`)] : []),
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')
  return new Response(lineas.join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } })
}
