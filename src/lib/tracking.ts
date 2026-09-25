'use client'

// track('agregar_carrito', { productoId, precio, categoria }) desde
// cualquier botón. No hace nada si el registro está apagado (se pregunta
// una vez por sesión a /api/eventos), y junta los eventos para mandarlos
// en tandas: cada 15 s, al llegar a 20, o al cerrar/ocultar la pestaña.
// Nunca rompe nada: si algo falla, el evento se pierde y listo.

import type { NombreEvento } from '@/lib/trackingConfig'

type Evento = { n: NombreEvento; p?: Record<string, unknown>; t: number }

const CLAVE_ESTADO = 'cc_tracking_estado'
const CLAVE_SESION = 'cc_tracking_sid'
const CLAVE_ANON = 'cc_tracking_aid'

let cola: Evento[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let estado: { activo: boolean; eventos: string[]; hasta: number } | null = null
let consultando: Promise<void> | null = null
let escuchando = false

function idAleatorio() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function ids() {
  let sid = '', aid = ''
  try {
    sid = sessionStorage.getItem(CLAVE_SESION) || ''
    if (!sid) { sid = idAleatorio(); sessionStorage.setItem(CLAVE_SESION, sid) }
    aid = localStorage.getItem(CLAVE_ANON) || ''
    if (!aid) { aid = idAleatorio(); localStorage.setItem(CLAVE_ANON, aid) }
  } catch {}
  return { sid, aid }
}

async function cargarEstado() {
  if (estado && estado.hasta > Date.now()) return
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_ESTADO) || 'null')
    if (guardado && guardado.hasta > Date.now()) { estado = guardado; return }
  } catch {}
  if (!consultando) {
    consultando = fetch('/api/eventos')
      .then((r) => r.json())
      .then((d) => {
        // Se vuelve a preguntar cada 10 min (por si el admin lo prendió,
        // apagó, o empezó el horario / la campaña).
        estado = { activo: !!d.activo, eventos: d.eventos || [], hasta: Date.now() + 10 * 60_000 }
        try { sessionStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)) } catch {}
      })
      .catch(() => { estado = { activo: false, eventos: [], hasta: Date.now() + 10 * 60_000 } })
      .finally(() => { consultando = null })
  }
  await consultando
}

function enviar(usarBeacon = false) {
  if (timer) { clearTimeout(timer); timer = null }
  if (cola.length === 0) return
  const lote = cola.splice(0, 50)
  const cuerpo = JSON.stringify({ eventos: lote, ...ids() })
  try {
    if (usarBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/eventos', new Blob([cuerpo], { type: 'application/json' }))
    } else {
      fetch('/api/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true })
        .then((r) => r.json())
        .then((d) => {
          // El servidor dice que está pausado (tope diario, fuera de
          // horario...): dejamos de mandar en esta sesión hasta la
          // próxima consulta.
          if (d?.pausado) {
            estado = { activo: false, eventos: [], hasta: Date.now() + 10 * 60_000 }
            try { sessionStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)) } catch {}
            cola = []
          }
        })
        .catch(() => {})
    }
  } catch {}
  if (cola.length > 0) programar()
}

function programar() {
  if (!timer) timer = setTimeout(() => enviar(), 15_000)
}

// Mismo evento con los mismos parámetros dentro de 2 s = duplicado
// (doble toque, o React repitiendo un efecto): se cuenta una sola vez.
const recientes = new Map<string, number>()

export function track(nombre: NombreEvento, parametros?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const t = Date.now()
  const firma = nombre + JSON.stringify(parametros || {})
  if (t - (recientes.get(firma) || 0) < 2000) return
  recientes.set(firma, t)
  if (recientes.size > 50) recientes.clear()
  cargarEstado()
    .then(() => {
      if (!estado?.activo || !estado.eventos.includes(nombre)) return
      cola.push({ n: nombre, p: parametros, t })
      if (!escuchando) {
        escuchando = true
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviar(true) })
        window.addEventListener('pagehide', () => enviar(true))
      }
      if (cola.length >= 20) enviar()
      else programar()
    })
    .catch(() => {})
}
