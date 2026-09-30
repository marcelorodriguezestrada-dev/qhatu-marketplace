'use client'

// Campaña de marketing por la que llegó este navegador (?c=CODIGO en el
// link). Se guarda 30 días; lo leen el registro, la tienda, el alta de
// profesional, los anuncios y el checkout para sumar a esa campaña.
const CLAVE = 'clasiclick_campana'
const DIAS = 30

export function capturarCampana() {
  try {
    const c = new URLSearchParams(window.location.search).get('c')
    if (!c || !/^[a-z0-9-]{3,40}$/.test(c)) return
    localStorage.setItem(CLAVE, JSON.stringify({ codigo: c, at: Date.now() }))
    // Una visita por sesión y campaña.
    const clave = `cc_campana_visita_${c}`
    if (sessionStorage.getItem(clave)) return
    sessionStorage.setItem(clave, '1')
    fetch('/api/campanas/visita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: c }) }).catch(() => {})
  } catch {}
}

export function leerCampana(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (!v?.codigo || Date.now() - v.at > DIAS * 86400_000) return null
    return v.codigo
  } catch {
    return null
  }
}
