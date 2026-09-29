'use client'

import { useEffect, useRef, useState } from 'react'

// Navegación de la "Central de vendedores" (/vender), al estilo Mercado
// Libre: en computadora, menú lateral fijo con la sección a la derecha;
// en el celular, primero la lista de opciones (como el menú "Más" de la
// app) y al tocar una se abre la sección con "‹ Volver". La sección va en
// el hash (#publicar, #preguntas...) así el botón atrás del celular
// vuelve al menú y los links de la campanita (/vender#preguntas) abren
// directo donde corresponde.

export type SeccionVendedor = 'resumen' | 'publicar' | 'publicaciones' | 'preguntas' | 'marketing' | 'ventas' | 'tienda' | 'premium' | 'cuenta'

export const SECCIONES: { id: SeccionVendedor; icono: string; label: string; ayuda: string }[] = [
  { id: 'resumen', icono: '🏠', label: 'Resumen', ayuda: 'Cómo va tu tienda hoy' },
  { id: 'publicar', icono: '➕', label: 'Publicar', ayuda: 'Un producto o muchos con Excel' },
  { id: 'publicaciones', icono: '📦', label: 'Publicaciones', ayuda: 'Tus productos, precios y stock' },
  { id: 'preguntas', icono: '💬', label: 'Preguntas', ayuda: 'Respondé a los compradores' },
  { id: 'marketing', icono: '📣', label: 'Marketing', ayuda: 'Publicaciones para tus redes' },
  { id: 'ventas', icono: '🧾', label: 'Ventas', ayuda: 'Pedidos para confirmar y entregar' },
  { id: 'tienda', icono: '🏪', label: 'Mi tienda', ayuda: 'Nombre, WhatsApp, QR, dirección' },
  { id: 'premium', icono: '⭐', label: 'Premium', ayuda: 'Más fotos y más visibilidad' },
  { id: 'cuenta', icono: '👤', label: 'Mi cuenta', ayuda: 'Email, contraseña y datos' },
]

const IDS = SECCIONES.map((s) => s.id) as string[]

function leerHash(): SeccionVendedor | null {
  const h = window.location.hash.replace('#', '')
  return IDS.includes(h) ? (h as SeccionVendedor) : null
}

// null = en el celular se ve el menú; en computadora equivale a 'resumen'.
export function useSeccionVendedor() {
  const [seccion, setSeccion] = useState<SeccionVendedor | null>(null)
  const empujada = useRef(false)

  useEffect(() => {
    setSeccion(leerHash())
    const alCambiar = () => setSeccion(leerHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  function irA(s: SeccionVendedor) {
    if (leerHash() === s) return
    empujada.current = true
    window.location.hash = s
    window.scrollTo({ top: 0 })
  }

  function volver() {
    if (empujada.current && window.history.length > 1) {
      empujada.current = false
      window.history.back()
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setSeccion(null)
    }
    window.scrollTo({ top: 0 })
  }

  return { seccion, activa: (seccion ?? 'resumen') as SeccionVendedor, irA, volver }
}

// Clases de cada bloque: visible si es la sección activa. Sin sección
// elegida, en el celular no se ve ninguna (está el menú) y en
// computadora se ve el resumen.
export function claseSeccion(id: SeccionVendedor, seccion: SeccionVendedor | null) {
  const activa = seccion ?? 'resumen'
  if (activa !== id) return 'hidden'
  return seccion ? 'block' : 'hidden md:block'
}

type Badges = Partial<Record<SeccionVendedor, number | string>>

function Badge({ v }: { v?: number | string }) {
  if (!v) return null
  return <span className="ml-auto whitespace-nowrap bg-maroon text-white font-body text-[11px] font-bold min-w-[20px] h-5 px-1.5 rounded-full inline-flex items-center justify-center">{v}</span>
}

export function SidebarVendedor({ activa, irA, badges }: { activa: SeccionVendedor; irA: (s: SeccionVendedor) => void; badges: Badges }) {
  return (
    <nav className="hidden md:block w-60 shrink-0">
      <div className="sticky top-4 bg-panel border border-line rounded-xl py-2">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => irA(s.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 font-body text-sm text-left border-l-[3px] ${
              activa === s.id ? 'border-maroon bg-maroon/5 text-ink font-semibold' : 'border-transparent text-inksoft hover:bg-panelalt'
            }`}
          >
            <span className="w-5 text-center">{s.icono}</span>
            {s.label}
            <Badge v={badges[s.id]} />
          </button>
        ))}
      </div>
    </nav>
  )
}

export function MenuVendedorCelular({
  visible,
  irA,
  badges,
  tienda,
  email,
}: {
  visible: boolean
  irA: (s: SeccionVendedor) => void
  badges: Badges
  tienda: string
  email: string
}) {
  if (!visible) return null
  const iniciales = (tienda || email).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '🛍️'
  return (
    <div className="md:hidden -mx-5 -mt-6">
      <button type="button" onClick={() => irA('cuenta')} className="w-full flex items-center gap-4 bg-ochre/90 px-5 py-5 text-left">
        <span className="w-14 h-14 rounded-full bg-white border-2 border-white shadow flex items-center justify-center font-display text-lg font-bold text-maroon shrink-0">{iniciales}</span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold text-ink truncate">{tienda || 'Mi tienda'}</span>
          <span className="block font-body text-sm text-ink/80 truncate">{email}</span>
          <span className="block font-body text-sm text-ink font-semibold">Mi perfil ›</span>
        </span>
      </button>
      <div className="bg-panel">
        {SECCIONES.filter((s) => s.id !== 'cuenta').map((s) => (
          <button key={s.id} type="button" onClick={() => irA(s.id)} className="w-full flex items-center gap-4 px-5 py-4 border-b border-line text-left active:bg-panelalt">
            <span className="text-2xl w-8 text-center">{s.icono}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-base text-ink">{s.label}</span>
              <span className="block font-body text-xs text-inksoft truncate">{s.ayuda}</span>
            </span>
            <Badge v={badges[s.id]} />
            <span className="text-inksoft text-lg">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function VolverCelular({ seccion, volver }: { seccion: SeccionVendedor | null; volver: () => void }) {
  if (!seccion) return null
  const s = SECCIONES.find((x) => x.id === seccion)
  return (
    <div className="md:hidden flex items-center gap-2 mb-4 -mt-2">
      <button type="button" onClick={volver} className="font-body text-sm text-teal font-semibold py-2 pr-3">‹ Volver</button>
      <span className="font-display text-base font-bold text-ink">{s?.icono} {s?.label}</span>
    </div>
  )
}
