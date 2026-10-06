'use client'

import { useEffect, useState } from 'react'
import type { CompraFueraHorario } from '@/lib/fueraHorario'

// Admin → Pedidos: quienes quisieron comprar fuera de horario (20 a 8 h).
// A cada uno le llega solo el aviso a la campanita a las 8:00; desde acá
// ves si lo leyó, si volvió y compró, y le podés escribir por WhatsApp.

type Fila = CompraFueraHorario & { avisoLeido: boolean }

const hora = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 4 * 3600_000)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const wa = (n: string) => {
  const d = n.replace(/\D/g, '')
  return d.length === 8 ? `591${d}` : d
}

export default function AdminFueraHorario({ password }: { password: string }) {
  const [compras, setCompras] = useState<Fila[]>([])
  const [abierto, setAbierto] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'todas'>('pendientes')

  async function cargar() {
    const d = await fetch('/api/admin/fuera-horario', { headers: { 'x-admin-password': password } }).then((r) => r.json()).catch(() => ({}))
    setCompras(d.compras || [])
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarContactado(c: Fila) {
    setCompras((prev) => prev.map((x) => (x.id === c.id ? { ...x, contactadoAt: new Date().toISOString() } : x)))
    fetch('/api/admin/fuera-horario', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ id: c.id, contactado: true }) }).catch(() => {})
  }

  const ahora = new Date().toISOString()
  const pendientes = compras.filter((c) => !c.convertido)
  const lista = filtro === 'pendientes' ? pendientes : compras
  const convertidos = compras.filter((c) => c.convertido).length
  const totalPend = pendientes.reduce((s, c) => s + (c.total || 0), 0)
  if (!compras.length) return null

  return (
    <div className="bg-panel border border-indigo-200 rounded-xl p-3.5 mb-5">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="w-full flex flex-wrap items-center gap-2 bg-transparent border-none p-0 text-left">
        <span className="font-body text-sm font-semibold text-ink">🌙 Quisieron comprar fuera de horario</span>
        <span className="font-body text-xs text-inksoft">{pendientes.length} sin comprar (Bs {Math.round(totalPend)}) · {convertidos} volvieron y compraron</span>
        <span className="flex-1" />
        <span className="font-body text-xs text-teal underline">{abierto ? 'Ocultar' : 'Ver lista'}</span>
      </button>
      {abierto && (
        <div className="mt-3">
          <div className="flex gap-1.5 mb-2">
            {(['pendientes', 'todas'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFiltro(f)} className={`px-2.5 py-1 rounded-full border font-body text-[11px] ${filtro === f ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line'}`}>{f === 'pendientes' ? `Sin comprar (${pendientes.length})` : `Todas (${compras.length})`}</button>
            ))}
            <span className="font-body text-[11px] text-inksoft self-center ml-1">A todos les llega solo un aviso en la 🔔 campanita a las 8:00.</span>
          </div>
          <div className="grid gap-1.5">
            {lista.map((c) => {
              const productos = c.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ''}${i.nombre}${i.talla ? ` (T${i.talla})` : ''}`).join(', ')
              const texto = `¡Hola ${c.nombre || ''}! 👋 Soy de Clasi Click. Quisiste comprar ${c.items[0]?.nombre || 'en nuestra tienda'}${c.items.length > 1 ? ' y más' : ''} cuando ya habíamos cerrado. ¡Ya estamos abiertos! Tu carrito te espera 👉 https://clasiclick.ezeti.pro${c.tienda ? `/checkout?tienda=${c.tienda}` : '/checkout'}`
              const estadoAviso = c.convertido ? '✅ Volvió y compró' : c.avisoEn > ahora ? `⏰ Aviso programado ${hora(c.avisoEn)}` : c.avisoLeido ? '👀 Vio el aviso, no compró' : '🔔 Aviso enviado, sin abrir'
              return (
                <div key={c.id} className={`flex flex-wrap items-center gap-2 border rounded-lg px-3 py-2 ${c.convertido ? 'border-emerald-200 bg-emerald-50/50' : 'border-line'}`}>
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-body text-sm text-ink"><b>{c.nombre || c.email}</b> <span className="text-[11px] text-inksoft">· {hora(c.ultimoIntento)}{c.intentos > 1 ? ` · ${c.intentos} intentos` : ''} · {c.ciudad === 'la-paz' ? 'La Paz' : 'Potosí'}</span></div>
                    <div className="font-body text-[11px] text-inksoft truncate" title={productos}>{productos} · <b className="text-ink">Bs {Math.round(c.total)}</b></div>
                    <div className="font-body text-[11px] text-indigo-700">{estadoAviso}{c.contactadoAt ? ' · 💬 le escribiste' : ''}</div>
                  </div>
                  {c.whatsapp && !c.convertido && (
                    <a href={`https://wa.me/${wa(c.whatsapp)}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" onClick={() => marcarContactado(c)} className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white font-body text-xs font-semibold no-underline">💬 WhatsApp</a>
                  )}
                  {!c.whatsapp && <span className="font-body text-[11px] text-inksoft">{c.email}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
