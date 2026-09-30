'use client'

import { useEffect } from 'react'
import { capturarCampana } from '@/lib/campana'

// No renderiza nada — solo avisa una vez por pestaña/sesión que
// alguien entró al sitio (para la métrica "visitas" de /admin). Usa
// sessionStorage para no contar cada navegación interna entre páginas
// como una visita nueva, solo la primera de esa sesión del navegador.
export default function RegistrarVisita() {
  useEffect(() => {
    // Link de campaña de marketing (?c=): se anota antes que nada.
    capturarCampana()
    try {
      if (sessionStorage.getItem('cc_visita_registrada')) return
      sessionStorage.setItem('cc_visita_registrada', '1')
    } catch {
      // Si el navegador bloquea sessionStorage (modo privado estricto,
      // etc.), simplemente no contamos esta sesión — no es crítico.
      return
    }
    fetch('/api/analitica/visita', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
