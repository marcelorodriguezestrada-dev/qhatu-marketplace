'use client'

import { useEffect, useState } from 'react'

// Admin → Números → "🔋 Consumo de la base": qué páginas/APIs gastan las
// lecturas de Firestore (50.000 gratis por día), y botones para pausar una
// ruta o activar el modo ahorro. Ver src/lib/consumoFirestore.ts.

type Ruta = { ruta: string; lecturas: number }
type Dia = { dia: string; total: number; horas: Record<string, number>; rutas: Ruta[]; actualizado: string | null }
type Datos = { limite: number; hoy: string; dias: Dia[]; pausadas: string[]; ahorro: boolean; sinPausa: string[]; error?: string }

// Nombre entendible de cada ruta (lo que no está acá se muestra tal cual).
const NOMBRES: Record<string, string> = {
  'api/productos': 'Lista de todos los productos (inicio, tiendas, producto, categorías)',
  'api/pedidos': 'Pedidos (entrar al admin, Mis pedidos, Vender, checkout)',
  'api/pedidos/[id]': 'Seguimiento de un pedido (se actualiza solo)',
  'api/pedidos/novedades': 'Alarma de pedidos del admin (cada 20 s)',
  'api/notificaciones': 'Campanita de notificaciones (cada 2 min)',
  'api/anuncios': 'Lista de anuncios',
  'api/profesionales': 'Lista de servicios profesionales',
  'api/whatsapp': 'Bot de WhatsApp',
  'api/productos/[id]/resenas': 'Reseñas de un producto (al abrirlo)',
  'api/usuarios/estado': 'Estado de la cuenta (cada carga con sesión iniciada)',
  'api/configuracion/pagos': 'Datos de cobro (QR/cuenta) del checkout',
  'api/portada': 'Secciones de la portada (inicio)',
  'api/banners': 'Banners de la portada',
  'api/admin/metricas': 'Admin → Métricas',
  'api/admin/finanzas': 'Admin → Finanzas',
  'api/admin/vendedores': 'Admin → lista de tiendas',
  'api/admin/usuarios': 'Admin → Usuarios',
  'api/admin/consumo': 'Este tablero',
  'sitemap.xml': 'Sitemap (lo lee Google)',
  'feed/google.xml': 'Catálogo para Google Shopping',
  'feed/meta.csv': 'Catálogo para Facebook/Instagram',
  'producto/[id]': 'Página de un producto (servidor)',
  'tienda/[id]': 'Página de una tienda (servidor)',
  '[ciudad]': 'Página de ciudad (SEO)',
  '[ciudad]/[tipo]/[slug]': 'Páginas de categoría por ciudad (SEO, las recorre Google)',
  otro: 'Otros (no se pudo identificar)',
}

const num = (n: number) => Math.round(n).toLocaleString('es-BO')

// Hora de Bolivia de una hora "del Pacífico" (las del medidor).
function horaBolivia(horaPacifico: number) {
  const ahora = new Date()
  const h = (tz: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(ahora))
  return (horaPacifico + h('America/La_Paz') - h('America/Los_Angeles') + 24) % 24
}

// Hora actual "del Pacífico" en horas con decimales (ej. 7.5 = 07:30).
function horaPacificoAhora() {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number)
  return h + m / 60
}

// Proyección del día: al ritmo de las últimas ~3 horas, cuánto se va a
// gastar hasta que se reinicie la cuota, y a qué hora se llegaría al límite.
function proyectar(total: number, horas: Record<string, number>, limite: number) {
  const ahora = horaPacificoAhora()
  const h = Math.floor(ahora)
  const desde = Math.max(0, h - 2)
  let reciente = 0
  for (let i = desde; i <= h; i++) reciente += Number(horas[String(i).padStart(2, '0')] || 0)
  const ventana = Math.max(0.25, ahora - desde) // horas que cubre "reciente"
  const porHora = ahora < 1 ? total / Math.max(0.25, ahora) : reciente / ventana
  const fin = Math.round(total + porHora * (24 - ahora))
  let llegaA: string | null = null
  if (total >= limite) llegaA = 'ya'
  else if (fin > limite && porHora > 0) {
    const cuando = new Date(Date.now() + ((limite - total) / porHora) * 3_600_000)
    llegaA = cuando.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })
  }
  return { porHora: Math.round(porHora), fin, llegaA }
}

// Cuánto falta para que Firebase reinicie la cuota (medianoche del Pacífico).
function faltaReinicio() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const [h, m] = p.split(':').map(Number)
  const min = 24 * 60 - (h * 60 + m)
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export default function ConsumoBase({ password }: { password: string }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    fetch('/api/admin/consumo', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else { setDatos(d); setError('') }
      })
      .catch(() => setError('No se pudo cargar el consumo.'))

  useEffect(() => {
    if (!password) return
    cargar()
    const t = setInterval(() => { if (!document.hidden) cargar() }, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  async function guardar(cambios: { pausadas?: string[]; ahorro?: boolean }) {
    setGuardando(true)
    try {
      const r = await fetch('/api/admin/consumo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify(cambios) })
      const d = await r.json()
      if (d.error) setError(d.error)
      else setDatos((x) => (x ? { ...x, ...cambios } : x))
    } finally {
      setGuardando(false)
    }
  }

  const pausar = (ruta: string, si: boolean) => {
    if (!datos) return
    if (si && !confirm(`¿Pausar "${NOMBRES[ruta] || ruta}"?\n\nMientras esté pausada, esa parte del sitio no va a mostrar datos (da error) pero no gasta lecturas. Se reanuda con el mismo botón.`)) return
    guardar({ pausadas: si ? [...datos.pausadas, ruta] : datos.pausadas.filter((r) => r !== ruta) })
  }

  const hoy = datos?.dias[0]
  const total = hoy?.total || 0
  const limite = datos?.limite || 50_000
  const pct = Math.min(100, (total / limite) * 100)
  const nivel = pct >= 90 ? { txt: 'Casi sin cuota', color: 'bg-maroon', icono: '⛔' } : pct >= 60 ? { txt: 'Consumo alto', color: 'bg-amber-500', icono: '⚠️' } : { txt: 'Normal', color: 'bg-teal', icono: '✅' }
  const horas = Array.from({ length: 24 }, (_, h) => ({ h, n: Number(hoy?.horas?.[String(h).padStart(2, '0')] || 0) }))
  const maxHora = Math.max(1, ...horas.map((x) => x.n))
  const proy = datos && hoy ? proyectar(total, hoy.horas || {}, limite) : null
  const rutas = hoy?.rutas || []
  // Las pausadas siempre se ven, aunque hoy no hayan leído nada.
  const pausadasSinUso = (datos?.pausadas || []).filter((r) => !rutas.some((x) => x.ruta === r)).map((ruta) => ({ ruta, lecturas: 0 }))

  return (
    <div className="bg-panel border border-line rounded-xl p-5 mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <div className="font-display text-lg font-bold text-ink">🔋 Consumo de la base de datos</div>
          <div className="font-body text-xs text-inksoft">
            Lecturas de Firestore de hoy. El plan gratis da {num(limite)} por día; se reinicia a la medianoche de EE.UU. (03:00–04:00 en Bolivia) — faltan {faltaReinicio()}.
          </div>
        </div>
        <button onClick={cargar} className="font-body text-xs px-3 py-1.5 rounded-lg border border-line bg-panelalt text-ink">↻ Actualizar</button>
      </div>

      {error && <div className="font-body text-sm text-maroon bg-panelalt border border-line rounded-lg p-3 my-3">{error}</div>}
      {!datos && !error && <div className="font-body text-sm text-inksoft my-3">Cargando…</div>}

      {datos && (
        <>
          <div className="my-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-3xl font-bold text-ink tabular-nums">{num(total)}</span>
              <span className="font-body text-sm text-inksoft">de {num(limite)} lecturas ({Math.round(pct)}%)</span>
              <span className="font-body text-xs font-semibold text-ink ml-1">{nivel.icono} {nivel.txt}</span>
            </div>
            <div className="h-2.5 rounded-full bg-panelalt border border-line mt-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={total} aria-label="Lecturas usadas hoy">
              <div className={`h-full rounded-full ${nivel.color}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="font-body text-[11px] text-inksoft mt-1.5">
              Aproximado (lo cuenta el sitio). El número exacto está en{' '}
              <a className="underline" href="https://console.firebase.google.com/project/_/firestore/usage" target="_blank" rel="noreferrer">Firebase → Firestore → Uso</a>.
              {hoy?.actualizado && <> Último dato: {new Date(hoy.actualizado).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}.</>}
            </div>
          </div>

          {proy && (
            <div className={`font-body text-sm rounded-lg border p-3 mb-4 ${proy.llegaA ? 'border-maroon bg-panelalt' : proy.fin > limite * 0.6 ? 'border-amber-200 bg-amber-50' : 'border-line bg-panelalt'}`}>
              <div className="font-semibold text-ink">
                {proy.llegaA ? '⛔' : proy.fin > limite * 0.6 ? '⚠️' : '✅'} Proyección del día: ~{num(proy.fin)} lecturas ({Math.round((proy.fin / limite) * 100)}% del límite)
              </div>
              <div className="text-xs text-inksoft mt-0.5">
                Ritmo de las últimas horas: ~{num(proy.porHora)} por hora.{' '}
                {proy.llegaA === 'ya'
                  ? 'Ya se llegó al límite de hoy.'
                  : proy.llegaA
                    ? <>A este ritmo se llega al límite cerca de las <b>{proy.llegaA}</b> (hora de Bolivia). {datos.ahorro ? 'El modo ahorro ya está activo: conviene pasar a Blaze en Firebase.' : 'Activá el modo ahorro.'}</>
                    : proy.fin > limite * 0.6
                      ? datos.ahorro ? 'Va alto aun con modo ahorro: si se repite varios días, pasá a Blaze.' : 'Va alto: si se repite, activá el modo ahorro.'
                      : 'Tranquilo: a este ritmo no se llega al límite.'}
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 bg-panelalt border border-line rounded-lg p-3 mb-4 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={datos.ahorro} disabled={guardando} onChange={(e) => guardar({ ahorro: e.target.checked })} />
            <span className="font-body text-sm text-ink">
              <b>Modo ahorro</b>
              <span className="block text-xs text-inksoft">Las listas de productos, anuncios y servicios se guardan 10 minutos en vez de 1 (un producto nuevo tarda más en aparecer, pero se gasta mucho menos).</span>
            </span>
          </label>

          <div className="font-body text-sm font-semibold text-ink mb-2">Qué está gastando hoy</div>
          {rutas.length + pausadasSinUso.length === 0 ? (
            <div className="font-body text-sm text-inksoft mb-4">Todavía no hay datos de hoy (se guardan cada ~30 segundos).</div>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-inksoft border-b border-line">
                    <th className="py-1.5 pr-2 font-medium">Parte del sitio</th>
                    <th className="py-1.5 px-2 font-medium text-right">Lecturas</th>
                    <th className="py-1.5 px-2 font-medium text-right">%</th>
                    <th className="py-1.5 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...rutas, ...pausadasSinUso].map((r) => {
                    const pausada = datos.pausadas.includes(r.ruta)
                    const fija = datos.sinPausa.includes(r.ruta)
                    return (
                      <tr key={r.ruta} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2">
                          <div className="text-ink">{NOMBRES[r.ruta] || r.ruta}</div>
                          <div className="text-[11px] text-inksoft">/{r.ruta}{pausada && <span className="ml-1.5 font-semibold text-maroon">⏸ pausada</span>}</div>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-ink">{num(r.lecturas)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-inksoft">{total ? Math.round((r.lecturas / total) * 100) : 0}%</td>
                        <td className="py-2 pl-2 text-right">
                          {fija ? (
                            <span className="text-[11px] text-inksoft" title="Sin esto no se puede comprar ni entrar al admin">no se pausa</span>
                          ) : (
                            <button
                              disabled={guardando}
                              onClick={() => pausar(r.ruta, !pausada)}
                              className={`text-xs px-2.5 py-1 rounded-md border ${pausada ? 'border-teal text-teal bg-tealsoft' : 'border-line text-ink bg-panel'}`}
                            >
                              {pausada ? '▶ Reanudar' : '⏸ Pausar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="font-body text-sm font-semibold text-ink mb-2">Lecturas por hora (hora de Bolivia)</div>
          <div className="flex items-end gap-[2px] h-24 mb-1" aria-label="Lecturas por hora de hoy">
            {horas.map((x) => (
              <div key={x.h} className="flex-1 h-full flex items-end group relative" title={`${String(horaBolivia(x.h)).padStart(2, '0')}:00 — ${num(x.n)} lecturas`}>
                <div className="w-full bg-teal rounded-t-[4px]" style={{ height: `${(x.n / maxHora) * 100}%`, minHeight: x.n ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between font-body text-[10px] text-inksoft mb-4">
            {[0, 6, 12, 18, 23].map((h) => <span key={h}>{String(horaBolivia(h)).padStart(2, '0')}:00</span>)}
          </div>

          <div className="font-body text-sm font-semibold text-ink mb-2">Últimos 7 días</div>
          <table className="w-full font-body text-sm mb-1">
            <tbody>
              {datos.dias.map((d) => (
                <tr key={d.dia} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-2 text-inksoft">{d.dia === datos.hoy ? 'Hoy' : d.dia}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-ink">{d.total ? num(d.total) : '—'}</td>
                  <td className="py-1.5 pl-2 text-[11px] text-inksoft">{d.rutas[0] ? `más: ${NOMBRES[d.rutas[0].ruta] || d.rutas[0].ruta}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
