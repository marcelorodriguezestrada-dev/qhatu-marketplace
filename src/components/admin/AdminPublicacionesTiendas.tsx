'use client'

import { useEffect, useMemo, useState } from 'react'
import { SITE_URL } from '@/lib/sitio'

// Admin → Marketing → Campañas: "🏪 Publicaciones de las tiendas". Lo que
// cada tienda compartió desde Vender → Marketing (cada publicación es una
// campaña con su link ?c= + UTM) y lo que trajo: visitas, pedidos y ventas.

const ICONO_RED: Record<string, string> = { facebook: '📘', instagram: '📸', whatsapp: '💬', tiktok: '🎵' }
const bs = (n: number) => `Bs ${Math.round(n).toLocaleString('es-BO')}`

export default function AdminPublicacionesTiendas({ password }: { password: string }) {
  const [lista, setLista] = useState<any[] | null>(null)
  const [red, setRed] = useState('')
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    fetch('/api/admin/campanas?origen=tiendas', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d) => setLista(d.publicaciones || []))
      .catch(() => setLista([]))
  }, [password])

  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (lista || []).filter((p) => (!red || p.red === red) && (!q || String(p.tiendaNombre).toLowerCase().includes(q) || (p.productos || []).some((x: any) => String(x.nombre).toLowerCase().includes(q))))
  }, [lista, red, buscar])

  const porTienda = useMemo(() => {
    const m = new Map<string, { tienda: string; vendedorId: string; n: number; visitas: number; pedidos: number; ventas: number }>()
    for (const p of filtradas) {
      const t = m.get(p.vendedorId) || { tienda: p.tiendaNombre || 'Tienda', vendedorId: p.vendedorId, n: 0, visitas: 0, pedidos: 0, ventas: 0 }
      t.n += 1; t.visitas += p.visitas || 0; t.pedidos += p.pedidos || 0; t.ventas += p.ventasBs || 0
      m.set(p.vendedorId, t)
    }
    return [...m.values()].sort((a, b) => b.visitas - a.visitas || b.n - a.n)
  }, [filtradas])

  const tot = filtradas.reduce((t, p) => ({ n: t.n + 1, visitas: t.visitas + (p.visitas || 0), pedidos: t.pedidos + (p.pedidos || 0), ventas: t.ventas + (p.ventasBs || 0) }), { n: 0, visitas: 0, pedidos: 0, ventas: 0 })

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">🏪 Publicaciones de las tiendas</div>
      <div className="font-body text-[12px] text-inksoft mb-3">
        Lo que las tiendas compartieron en sus redes desde Vender → Marketing. Cada publicación tiene su link con código (?c=) y UTM: acá ves cuánta gente entró y cuántos pedidos de esa tienda trajo.
      </div>
      {!lista ? (
        <div className="font-body text-xs text-inksoft">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="font-body text-xs text-inksoft bg-panelalt rounded-lg px-3 py-3">Todavía ninguna tienda compartió una publicación.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[['📣 Publicaciones', tot.n], ['👀 Visitas', tot.visitas], ['🧾 Pedidos', tot.pedidos], ['💰 Vendido', bs(tot.ventas)]].map(([l, v]) => (
              <div key={String(l)} className="bg-panelalt rounded-lg p-2.5">
                <div className="font-body text-[11px] text-inksoft">{l}</div>
                <div className="font-display text-lg font-bold text-ink">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Tienda o producto" className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs" />
            <select value={red} onChange={(e) => setRed(e.target.value)} className="px-2 py-1.5 rounded-lg border border-line bg-panel font-body text-xs" aria-label="Red">
              <option value="">Todas las redes</option>
              {Object.keys(ICONO_RED).map((r) => <option key={r} value={r}>{ICONO_RED[r]} {r}</option>)}
            </select>
          </div>

          <div className="font-body text-xs font-semibold text-ink mb-1.5">Por tienda</div>
          <div className="border border-line rounded-lg overflow-hidden mb-4">
            {porTienda.map((t) => (
              <div key={t.vendedorId} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0 font-body text-xs">
                <a href={`${SITE_URL}/tienda/${t.vendedorId}`} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-ink font-semibold hover:underline">{t.tienda}</a>
                <span className="text-inksoft shrink-0">{t.n} publ.</span>
                <span className="shrink-0">👀 {t.visitas}</span>
                <span className="shrink-0">🧾 {t.pedidos}</span>
                <span className="shrink-0 font-semibold w-20 text-right">{bs(t.ventas)}</span>
              </div>
            ))}
          </div>

          <div className="font-body text-xs font-semibold text-ink mb-1.5">Cada publicación</div>
          <div className="border border-line rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
            {filtradas.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0">
                <span className="text-lg shrink-0">{ICONO_RED[p.red] || '📣'}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-body text-xs text-ink truncate"><b>{p.tiendaNombre || 'Tienda'}</b> · {(p.productos || []).map((x: any) => x.nombre).join(', ')}</div>
                  <div className="font-body text-[10px] text-inksoft">
                    {new Date(p.publicadaAt).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })} · código <span className="font-mono">{p.id}</span>
                  </div>
                </div>
                <div className="flex gap-3 font-body text-xs shrink-0">
                  <span>👀 {p.visitas || 0}</span>
                  <span>🧾 {p.pedidos || 0}</span>
                  <span className="hidden sm:inline font-semibold">{bs(p.ventasBs || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
