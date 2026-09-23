'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

function Tanda({ titulo, tanda }: { titulo: string; tanda: any[] }) {
  return (
    <div className="mb-6">
      <div className="font-display text-base font-bold text-ink mb-2.5">{titulo}</div>
      {tanda.length === 0 && <div className="font-body text-xs text-inksoft">No hay pedidos para esta salida.</div>}
      {tanda.map((p, i) => (
        <div key={p.id} className="bg-panel border border-line rounded-lg p-3 mb-2 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-maroonsoft text-maroon font-body text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body text-[13px] font-medium text-ink">
              {p.direccion || 'Sin dirección cargada'} · {p.zonaEntrega}
              {p.entreCalles && ` (${p.entreCalles})`}
              {p.referenciaAdicional && ` — ${p.referenciaAdicional}`}
            </div>
            <div className="font-body text-[11px] text-inksoft">
              {p.nombreComprador || p.comprador || 'Sin nombre'} · {bs(p.total)}
              {(p.lat == null || p.lng == null) && <span className="text-maroon"> · sin ubicación GPS, confirmar dirección a mano</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RepartoHoyContenido() {
  const searchParams = useSearchParams()
  const clave = searchParams.get('clave') || ''

  const [datos, setDatos] = useState<{ salida8: any[]; salida14: any[] } | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!clave) {
      setError('Falta la clave en el link.')
      setCargando(false)
      return
    }
    fetch(`/api/reparto-hoy?clave=${encodeURIComponent(clave)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setDatos(data)
      })
      .catch(() => setError('No se pudo cargar el reparto.'))
      .finally(() => setCargando(false))
  }, [clave])

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="font-display text-xl font-bold text-ink mb-1">Reparto de hoy</div>
      <div className="font-body text-xs text-inksoft mb-5">
        Se actualiza solo — volvé a abrir este mismo link más tarde para ver los pedidos nuevos.
      </div>

      {cargando && <div className="font-body text-sm text-inksoft">Cargando...</div>}
      {error && <div className="font-body text-sm text-maroon">{error}</div>}

      {datos && (
        <>
          <Tanda titulo="Salida 08:00" tanda={datos.salida8} />
          <Tanda titulo="Salida 14:00" tanda={datos.salida14} />
        </>
      )}
    </div>
  )
}
