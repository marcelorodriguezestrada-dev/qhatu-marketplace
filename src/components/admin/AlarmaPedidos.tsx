'use client'

import { useEffect, useRef, useState } from 'react'

// Alarma de pedidos para /admin: cada 20 s pregunta qué pedidos se
// crearon o cambiaron desde la última vez (/api/pedidos/novedades — solo
// lo que cambió, ~1 lectura por consulta) y, si entró uno nuevo (o alguien avisó que ya pagó, si está
// tildado), suena una sirena fuerte, aparece un cartel con quién pidió y
// —si diste permiso— una notificación del navegador.
//
// Los navegadores no dejan sonar nada hasta que la persona toca algo en
// la página: por eso hay que tocar "Activar alarma" una vez (se recuerda,
// pero después de recargar hay que volver a tocar cualquier botón).

type Pedido = { id: string; estado?: string; nombreComprador?: string; comprador?: string; total?: number; vendedorNombre?: string; esPrueba?: boolean }

const CLAVE = 'clasiclick_alarma_pedidos'

function bs(n?: number) {
  return 'Bs ' + (n || 0).toLocaleString('es-BO')
}

export default function AlarmaPedidos({
  password,
  pedidosIniciales,
  onCambios,
}: {
  password: string
  // Los pedidos que ya cargó el admin: sirven para saber cuáles ya
  // existían (esos no hacen sonar la alarma como "nuevos").
  pedidosIniciales: Pedido[]
  onCambios: (cambiados: any[]) => void
}) {
  const [activa, setActiva] = useState(false)
  const [conPago, setConPago] = useState(true)
  const [avisos, setAvisos] = useState<{ id: string; texto: string; tipo: 'nuevo' | 'pago' }[]>([])
  const conocidos = useRef<Map<string, string> | null>(null)
  const desdeRef = useRef<string>('')
  const audioRef = useRef<AudioContext | null>(null)
  const sonandoRef = useRef(false)
  const tituloOriginal = useRef('')

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) || 'null')
      if (g) { setActiva(!!g.activa); setConPago(g.conPago !== false) }
    } catch {}
    // Cualquier toque en la página desbloquea el audio (requisito del navegador).
    const desbloquear = () => { if (!audioRef.current) try { audioRef.current = new AudioContext() } catch {} ; audioRef.current?.resume() }
    window.addEventListener('pointerdown', desbloquear)
    return () => window.removeEventListener('pointerdown', desbloquear)
  }, [])

  function guardarPref(a: boolean, p: boolean) {
    try { localStorage.setItem(CLAVE, JSON.stringify({ activa: a, conPago: p })) } catch {}
  }

  // Sirena: alterna dos tonos fuertes durante ~4 segundos.
  function sonar() {
    if (sonandoRef.current) return
    try {
      if (!audioRef.current) audioRef.current = new AudioContext()
      const ctx = audioRef.current
      ctx.resume()
      sonandoRef.current = true
      const inicio = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.value = 0.9
      gain.connect(ctx.destination)
      for (let i = 0; i < 16; i++) {
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = i % 2 === 0 ? 1046 : 784
        osc.connect(gain)
        osc.start(inicio + i * 0.25)
        osc.stop(inicio + i * 0.25 + 0.22)
      }
      setTimeout(() => { sonandoRef.current = false }, 4200)
    } catch {
      sonandoRef.current = false
    }
    try { navigator.vibrate?.([400, 150, 400, 150, 400]) } catch {}
  }

  function notificar(titulo: string, cuerpo: string) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(titulo, { body: cuerpo, tag: 'pedido-' + Date.now() })
    } catch {}
    if (!tituloOriginal.current) tituloOriginal.current = document.title
    document.title = `🔔 ${titulo}`
  }

  // Punto de partida: los pedidos que ya estaban cargados.
  useEffect(() => {
    if (conocidos.current || !password) return
    conocidos.current = new Map(pedidosIniciales.map((p) => [p.id, p.estado || '']))
    desdeRef.current = new Date().toISOString()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosIniciales, password])

  useEffect(() => {
    if (!password) return
    let cancelado = false
    async function revisar() {
      try {
        if (!conocidos.current) return
        const r = await fetch(`/api/pedidos/novedades?desde=${encodeURIComponent(desdeRef.current)}`, { headers: { 'x-admin-password': password } })
        if (!r.ok) return
        const data = await r.json()
        if (cancelado) return
        const cambiados: Pedido[] = data.pedidos || []
        if (data.ahora) desdeRef.current = cambiados.length === 50 ? (cambiados[49] as any).updatedAt : data.ahora
        if (cambiados.length === 0) return
        onCambios(cambiados)
        // Nuevo = no estaba en la lista; pago = recién pasó a "informado_pago".
        const previos = conocidos.current
        const nuevos = cambiados.filter((p) => !previos.has(p.id))
        const pagos = conPago ? cambiados.filter((p) => p.estado === 'informado_pago' && previos.get(p.id) !== 'informado_pago') : []
        for (const p of cambiados) previos.set(p.id, p.estado || '')
        if (!activa || (nuevos.length === 0 && pagos.length === 0)) return
        const quien = (p: Pedido) => p.nombreComprador || p.comprador || 'Alguien'
        const nuevosAvisos = [
          ...nuevos.map((p) => ({ id: p.id, tipo: 'nuevo' as const, texto: `🛒 Nuevo pedido de ${quien(p)} — ${bs(p.total)}${p.vendedorNombre ? ` · ${p.vendedorNombre}` : ''}${p.esPrueba ? ' (prueba)' : ''}` })),
          ...pagos.map((p) => ({ id: p.id + '-pago', tipo: 'pago' as const, texto: `💸 ${quien(p)} avisó que pagó — ${bs(p.total)}. Revisá el comprobante.` })),
        ]
        setAvisos((a) => [...nuevosAvisos, ...a].slice(0, 10))
        sonar()
        notificar(nuevos.length ? `Nuevo pedido de ${quien(nuevos[0])}` : `${quien(pagos[0])} avisó que pagó`, nuevosAvisos.map((x) => x.texto).join('\n'))
      } catch {}
    }
    const t = setInterval(revisar, 20_000)
    return () => { cancelado = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, activa, conPago])

  function activar() {
    try { if (!audioRef.current) audioRef.current = new AudioContext(); audioRef.current.resume() } catch {}
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch {}
    setActiva(true)
    guardarPref(true, conPago)
  }

  function entendido() {
    setAvisos([])
    if (tituloOriginal.current) { document.title = tituloOriginal.current; tituloOriginal.current = '' }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 bg-panel border border-line rounded-xl px-3.5 py-2.5 mb-4">
        <span className="font-body text-sm font-semibold text-ink">🚨 Alarma de pedidos</span>
        {activa ? (
          <>
            <span className="border border-teal bg-tealsoft text-teal rounded-full px-2 py-0.5 font-body text-[11px] font-semibold">Activada</span>
            <label className="flex items-center gap-1.5 font-body text-xs text-ink cursor-pointer">
              <input type="checkbox" checked={conPago} onChange={(e) => { setConPago(e.target.checked); guardarPref(true, e.target.checked) }} className="accent-teal" />
              También cuando avisan que pagaron
            </label>
            <button type="button" onClick={sonar} className="font-body text-xs text-teal underline">Probar sonido</button>
            <button type="button" onClick={() => { setActiva(false); guardarPref(false, conPago) }} className="font-body text-xs text-inksoft underline ml-auto">Desactivar</button>
          </>
        ) : (
          <>
            <span className="font-body text-xs text-inksoft">Suena fuerte cuando entra un pedido. Dejá esta pestaña abierta.</span>
            <button type="button" onClick={activar} className="ml-auto px-3 py-1.5 rounded-lg border-none bg-maroon text-white font-body text-xs font-semibold">
              Activar alarma
            </button>
          </>
        )}
      </div>

      {avisos.length > 0 && (
        <div className="fixed top-3 left-3 right-3 sm:left-auto sm:w-[420px] z-[60] bg-maroon text-white rounded-xl shadow-2xl p-4 animate-pulse">
          <div className="font-display text-lg font-bold mb-1.5">🔔 ¡Atención!</div>
          <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto">
            {avisos.map((a) => (
              <div key={a.id} className="font-body text-sm">{a.texto}</div>
            ))}
          </div>
          <button type="button" onClick={entendido} className="w-full py-2 rounded-lg border-none bg-white text-maroon font-body text-sm font-bold">
            Entendido
          </button>
        </div>
      )}
    </>
  )
}
