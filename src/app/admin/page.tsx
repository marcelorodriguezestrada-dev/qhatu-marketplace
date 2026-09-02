'use client'

import { useEffect, useState } from 'react'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

const ESTADOS_LABEL: Record<string, { texto: string; color: string }> = {
  pendiente_pago: { texto: 'Esperando que pague', color: 'text-inksoft' },
  informado_pago: { texto: 'Dice que ya pagó — revisar', color: 'text-ochre' },
  pagado: { texto: 'Pagado', color: 'text-teal' },
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? localStorage.getItem('qhatu_admin_pw') : null
    if (guardada) {
      setPassword(guardada)
      cargarPedidos(guardada)
    }
  }, [])

  function cargarPedidos(pw: string) {
    setCargando(true)
    fetch('/api/pedidos', { headers: { 'x-admin-password': pw } })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Contraseña incorrecta.')
        return r.json()
      })
      .then((data) => {
        setPedidos(data.pedidos || [])
        setAutenticado(true)
        setError('')
        localStorage.setItem('qhatu_admin_pw', pw)
      })
      .catch((e) => {
        setError(e.message)
        setAutenticado(false)
      })
      .finally(() => setCargando(false))
  }

  function confirmarPago(id: string) {
    fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado: 'pagado' }),
    }).then(() => cargarPedidos(password))
  }

  if (!autenticado) {
    return (
      <div className="max-w-[360px] mx-auto px-5 py-20">
        <div className="font-display text-xl font-bold text-ink mb-4">Panel de pedidos</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          onKeyDown={(e) => e.key === 'Enter' && cargarPedidos(password)}
        />
        <button
          onClick={() => cargarPedidos(password)}
          disabled={cargando}
          className="w-full py-2.5 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <div className="font-body text-xs text-maroon mt-3">{error}</div>}
      </div>
    )
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="font-display text-xl font-bold text-ink mb-5">Pedidos</div>
      {pedidos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay pedidos.</div>}
      {pedidos.map((p) => {
        const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
        return (
          <div key={p.id} className="bg-panel border border-line rounded-lg p-4 mb-3 flex items-center justify-between">
            <div>
              <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
              <div className="font-body text-xs text-inksoft">{p.items?.length || 0} producto(s) · {bs(p.total)}</div>
              <div className={`font-body text-xs font-semibold ${estado.color}`}>{estado.texto}</div>
            </div>
            {p.estado !== 'pagado' && (
              <button
                onClick={() => confirmarPago(p.id)}
                className="px-3.5 py-2 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
              >
                Confirmar pago
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
