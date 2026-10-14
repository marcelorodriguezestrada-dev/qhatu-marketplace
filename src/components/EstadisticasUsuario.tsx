'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { GraficoBarras } from '@/components/GraficoBarras'
import { buscarPaisMercado, formatoMoneda } from '@/lib/mercado'
import {
  INICIO_ESTADISTICAS, PERIODOS_ESTADISTICAS,
  type ItemEstadistica, type PuntoEstadistica, type RespuestaEstadisticas, type SeccionEstadisticas,
} from '@/lib/estadisticas'

// "📊 Mis estadísticas": cuánta gente vio, contactó, agregó al carrito y
// compró cada producto / servicio / anuncio del usuario. Se usa en
// /mis-estadisticas (las tres pestañas) y en /vender → Estadísticas
// (arranca en productos). Sin Premium: totales de 7 días. Con Premium:
// 30 / 90 días, el día a día y el detalle por producto.

export type PestanaEstadisticas = 'productos' | 'servicios' | 'anuncios'

const PESTANAS: { id: PestanaEstadisticas; label: string }[] = [
  { id: 'productos', label: '🛍️ Productos' },
  { id: 'servicios', label: '🧰 Servicios' },
  { id: 'anuncios', label: '📢 Anuncios' },
]

const METRICAS: { id: keyof Omit<PuntoEstadistica, 'fecha'>; label: string; color: string; solo?: PestanaEstadisticas[] }[] = [
  { id: 'vistas', label: 'Vistas', color: 'var(--color-teal, #1a7f6e)' },
  { id: 'contactos', label: 'Contactos', color: '#16a34a', solo: ['productos', 'servicios'] },
  { id: 'carrito', label: 'Al carrito', color: '#d97706', solo: ['productos'] },
  { id: 'pedidos', label: 'Pedidos', color: '#7c2d3a', solo: ['productos'] },
]

const LINK_PREMIUM: Record<PestanaEstadisticas, string> = {
  productos: '/vender#premium',
  servicios: '/mi-perfil',
  anuncios: '/vender#premium',
}

function fechaCorta(f: string) {
  const [, m, d] = f.split('-')
  return `${Number(d)}/${Number(m)}`
}

function porcentaje(a: number, b: number) {
  if (!b) return null
  return Math.round((a / b) * 100)
}

function Tile({ label, valor, ayuda }: { label: string; valor: string | number; ayuda?: string }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-3">
      <div className="font-body text-[11px] text-inksoft mb-0.5">{label}</div>
      <div className="font-display text-2xl font-bold text-ink leading-tight">{valor}</div>
      {ayuda && <div className="font-body text-[10px] text-inksoft mt-0.5">{ayuda}</div>}
    </div>
  )
}

// Consejos automáticos a partir de los números de cada producto.
function consejos(pestana: PestanaEstadisticas, s: SeccionEstadisticas): string[] {
  if (!s.premium) return []
  const lista: string[] = []
  const conVistas = s.items.filter((i) => (i.vistas || 0) >= 10)
  if (pestana === 'productos') {
    const sinCarrito = conVistas.find((i) => !i.carrito && !i.contactos)
    if (sinCarrito) lista.push(`“${sinCarrito.nombre}” tuvo ${sinCarrito.vistas} vistas pero nadie lo agregó al carrito ni te escribió: probá con mejores fotos, una descripción más clara o revisá el precio.`)
    const carritoSinVenta = s.items.find((i) => (i.carrito || 0) >= 3 && !i.unidades)
    if (carritoSinVenta) lista.push(`“${carritoSinVenta.nombre}” lo agregaron ${carritoSinVenta.carrito} veces al carrito y no se vendió: puede que el envío o el precio final los frene.`)
  }
  const activos = s.items.filter((i) => !i.estado || ['activo', 'aprobado'].includes(i.estado))
  const sinVistas = activos.filter((i) => !i.vistas)
  if (sinVistas.length && activos.length > 1) {
    lista.push(`${sinVistas.length === 1 ? `“${sinVistas[0].nombre}” no tuvo` : `${sinVistas.length} publicaciones no tuvieron`} vistas en este período: compartí el link en tus redes o en tus estados de WhatsApp.`)
  }
  const top = s.items[0]
  if (top && (top.vistas || 0) > 0) lista.push(`Lo más mirado: “${top.nombre}” (${top.vistas} vistas). Destacalo en tus redes, es lo que más interesa.`)
  return lista.slice(0, 3)
}

export default function EstadisticasUsuario({ inicial, solo }: { inicial?: PestanaEstadisticas; solo?: PestanaEstadisticas }) {
  const { usuario, obtenerToken } = useAuth()
  const [dias, setDias] = useState<number>(7)
  const [datos, setDatos] = useState<RespuestaEstadisticas | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState<PestanaEstadisticas | null>(solo || inicial || null)
  const [metrica, setMetrica] = useState<(typeof METRICAS)[number]['id']>('vistas')
  // Publicaciones en redes (Vender → Marketing), con su link rastreado.
  const [redes, setRedes] = useState<{ n: number; visitas: number; pedidos: number; ventas: number } | null>(null)
  useEffect(() => {
    if (!usuario) return
    obtenerToken()
      .then((token) => fetch('/api/marketing/publicaciones', { headers: { Authorization: `Bearer ${token}` } }))
      .then((r) => r.json())
      .then((d) => {
        const l: any[] = d.publicaciones || []
        setRedes({ n: l.length, visitas: l.reduce((s, p) => s + (p.visitas || 0), 0), pedidos: l.reduce((s, p) => s + (p.pedidos || 0), 0), ventas: l.reduce((s, p) => s + (p.ventasBs || 0), 0) })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    let vigente = true
    ;(async () => {
      setError('')
      try {
        const token = await obtenerToken()
        const res = await fetch(`/api/mis-estadisticas?dias=${dias}`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || 'No se pudieron cargar tus estadísticas.')
        if (vigente) setDatos(d)
      } catch (e: any) {
        if (vigente) {
          setError(e?.message || 'No se pudieron cargar tus estadísticas.')
          setDatos(null)
        }
      }
    })()
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dias])

  if (datos === undefined) return <div className="font-body text-sm text-inksoft py-10 text-center">Cargando estadísticas...</div>
  if (!datos) return <div className="bg-maroon/10 border border-maroon rounded-lg p-3 font-body text-xs text-maroon">{error}</div>

  const disponibles = PESTANAS.filter((p) => (solo ? p.id === solo : true) && datos[p.id])
  const actual = (pestana && datos[pestana] ? pestana : disponibles[0]?.id) || null
  const seccion = actual ? datos[actual] : undefined
  const pais = buscarPaisMercado(datos.pais)

  if (!actual || !seccion) {
    return (
      <div className="bg-panel border border-line rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">📊</div>
        <div className="font-display text-base font-bold text-ink mb-1">Todavía no tenés nada publicado</div>
        <p className="font-body text-xs text-inksoft mb-4">Cuando publiques, acá vas a ver cuánta gente lo mira, te escribe y te compra.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {(!solo || solo === 'productos') && <Link href="/vender#publicar" className="px-3 py-2 rounded-lg bg-maroon text-white font-body text-xs font-semibold">Publicar un producto</Link>}
          {(!solo || solo === 'servicios') && <Link href="/publicar-servicio" className="px-3 py-2 rounded-lg border border-line bg-panel text-ink font-body text-xs font-semibold">Ofrecer un servicio</Link>}
          {(!solo || solo === 'anuncios') && <Link href="/publicar-anuncio" className="px-3 py-2 rounded-lg border border-line bg-panel text-ink font-body text-xs font-semibold">Publicar un anuncio</Link>}
        </div>
      </div>
    )
  }

  const r = seccion.resumen
  const metricas = METRICAS.filter((m) => !m.solo || m.solo.includes(actual))
  const metricaActual = metricas.find((m) => m.id === metrica) || metricas[0]
  const tips = consejos(actual, seccion)
  const contactoPct = porcentaje(r.contactos + r.carrito, r.vistas)

  return (
    <div>
      {disponibles.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {disponibles.map((p) => (
            <button key={p.id} type="button" onClick={() => setPestana(p.id)} className={`px-3 py-1.5 rounded-full border font-body text-xs font-semibold whitespace-nowrap ${actual === p.id ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="font-body text-xs text-inksoft mr-1">Período:</span>
        {PERIODOS_ESTADISTICAS.map((n) => {
          const bloqueado = !seccion.premium && n !== 7
          return (
            <button
              key={n}
              type="button"
              disabled={bloqueado}
              onClick={() => setDias(n)}
              title={bloqueado ? 'Con Premium' : undefined}
              className={`px-2.5 py-1 rounded-md border font-body text-xs ${datos.dias === n ? 'bg-teal text-white border-teal font-semibold' : 'bg-panel text-ink border-line'} disabled:opacity-50`}
            >
              {n} días{bloqueado ? ' 🔒' : ''}
            </button>
          )
        })}
        <span className="font-body text-[11px] text-inksoft ml-auto">{fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)}</span>
      </div>

      {datos.desde < INICIO_ESTADISTICAS && (
        <div className="font-body text-[11px] text-inksoft bg-panelalt rounded-lg px-3 py-2 mb-3">
          ℹ️ Contamos día por día desde el {fechaCorta(INICIO_ESTADISTICAS)}. Lo anterior solo está en el total de vistas de cada publicación.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <Tile label="👀 Vistas" valor={r.vistas} />
        {actual !== 'anuncios' && <Tile label="💬 Te escribieron" valor={r.contactos} ayuda="Tocaron WhatsApp / Contactar" />}
        {actual === 'productos' && (
          <>
            <Tile label="🛒 Al carrito" valor={r.carrito} />
            <Tile label="🧾 Pedidos" valor={r.pedidos} ayuda="Sin cancelados" />
            <Tile label="📦 Unidades" valor={r.unidades} />
            <Tile label="💰 Vendido" valor={formatoMoneda(r.vendido, pais)} />
          </>
        )}
      </div>

      {actual === 'productos' && redes && redes.n > 0 && (
        <Link href="/vender#marketing" className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 mb-3 no-underline">
          <span className="text-xl">📣</span>
          <span className="flex-1 min-w-0 font-body text-xs text-ink">
            <b>{redes.n} {redes.n === 1 ? 'publicación' : 'publicaciones'} en redes</b> trajeron {redes.visitas} visitas y {redes.pedidos} {redes.pedidos === 1 ? 'pedido' : 'pedidos'} ({formatoMoneda(redes.ventas, pais)}).
          </span>
          <span className="font-body text-xs text-indigo-700 font-semibold shrink-0">Ver ›</span>
        </Link>
      )}

      {actual !== 'anuncios' && contactoPct !== null && (
        <div className="font-body text-xs text-ink mb-3">
          De cada 100 personas que miraron, <b>{Math.min(100, contactoPct)}</b> {actual === 'productos' ? 'te escribieron o lo agregaron al carrito' : 'te escribieron'}.
        </div>
      )}

      {seccion.premium && seccion.serie ? (
        <div className="bg-panel border border-line rounded-xl p-3 mb-3">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {metricas.map((m) => (
              <button key={m.id} type="button" onClick={() => setMetrica(m.id)} className={`px-2.5 py-1 rounded-md font-body text-[11px] font-semibold border ${metricaActual.id === m.id ? 'text-white border-transparent' : 'bg-panel text-inksoft border-line'}`} style={metricaActual.id === m.id ? { backgroundColor: m.color } : undefined}>
                {m.label}
              </button>
            ))}
          </div>
          <GraficoBarras datos={seccion.serie.map((p) => ({ clave: p.fecha, valor: p[metricaActual.id] }))} formatoEtiqueta={fechaCorta} color={metricaActual.color} />
        </div>
      ) : (
        <div className="bg-ochre/10 border border-ochre/40 rounded-xl p-3 mb-3">
          <div className="font-body text-sm font-semibold text-ink mb-1">⭐ Mirá más con Premium</div>
          <ul className="font-body text-xs text-ink list-disc pl-4 mb-2 space-y-0.5">
            <li>Gráfico día por día y períodos de 30 y 90 días</li>
            <li>Vistas, contactos{actual === 'productos' ? ', carrito y ventas' : ''} de cada publicación</li>
            <li>Consejos para vender más según tus números</li>
          </ul>
          <Link href={LINK_PREMIUM[actual]} className="inline-block px-3 py-1.5 rounded-lg bg-ochre text-white font-body text-xs font-semibold">Ver Premium</Link>
        </div>
      )}

      {tips.length > 0 && (
        <div className="bg-tealsoft border border-teal/30 rounded-xl p-3 mb-3">
          <div className="font-body text-xs font-semibold text-teal mb-1">💡 Consejos</div>
          <ul className="font-body text-xs text-ink space-y-1">
            {tips.map((t) => <li key={t}>• {t}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-line font-body text-xs font-semibold text-ink">
          {actual === 'productos' ? 'Tus productos' : actual === 'servicios' ? 'Tus perfiles' : 'Tus anuncios'}
          {seccion.premium && <span className="font-normal text-inksoft"> · del más mirado al menos mirado</span>}
        </div>
        {seccion.items.map((it) => <FilaItem key={it.id} it={it} premium={seccion.premium} pestana={actual} pais={pais} />)}
      </div>
    </div>
  )
}

function FilaItem({ it, premium, pestana, pais }: { it: ItemEstadistica; premium: boolean; pestana: PestanaEstadisticas; pais: ReturnType<typeof buscarPaisMercado> }) {
  const pausado = it.estado && !['activo', 'aprobado'].includes(it.estado)
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-b-0">
      <div className="w-11 h-11 rounded-lg bg-panelalt overflow-hidden shrink-0 flex items-center justify-center text-lg">
        {it.imagen ? <img src={it.imagen} alt="" className="w-full h-full object-cover" /> : pestana === 'servicios' ? '🧰' : pestana === 'anuncios' ? '📢' : '🛍️'}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={it.href} className="block font-body text-sm text-ink font-semibold truncate hover:underline">{it.nombre}</Link>
        {premium ? (
          <div className="font-body text-[11px] text-inksoft flex flex-wrap gap-x-2.5">
            <span>👀 {it.vistas || 0}</span>
            {pestana !== 'anuncios' && <span>💬 {it.contactos || 0}</span>}
            {pestana === 'productos' && <span>🛒 {it.carrito || 0}</span>}
            {pestana === 'productos' && <span>📦 {it.unidades || 0} · {formatoMoneda(it.vendido || 0, pais)}</span>}
          </div>
        ) : null}
        <div className="font-body text-[10px] text-inksoft">
          Total: {it.vistasTotal} vistas{it.contactosTotal != null ? ` · ${it.contactosTotal} contactos` : ''}
          {pausado && <span className="ml-1.5 text-ochre">· {it.estado === 'pendiente_revision' ? 'en revisión' : 'no publicado'}</span>}
        </div>
      </div>
    </div>
  )
}
