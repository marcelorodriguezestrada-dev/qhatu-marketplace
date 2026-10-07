// Datos que el comprador ya usó en compras anteriores (nombre, WhatsApp
// y direcciones completas) para SUGERIRLOS mientras escribe en el
// checkout, en vez de dejar el formulario precargado. Viven en este
// navegador (por usuario), más los últimos datos guardados en su cuenta.

export type DireccionUsada = { direccion: string; zona: string; entreCalles: string; referencia: string }
export type DatosUsados = { nombres: string[]; whatsapps: string[]; direcciones: DireccionUsada[] }

const clave = (uid: string) => `clasiclick_datos_usados_${uid}`
const vacio = (): DatosUsados => ({ nombres: [], whatsapps: [], direcciones: [] })
const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export function leerDatosUsados(uid: string): DatosUsados {
  try {
    const d = JSON.parse(localStorage.getItem(clave(uid)) || 'null')
    return d ? { ...vacio(), ...d } : vacio()
  } catch {
    return vacio()
  }
}

const alFrente = <T,>(lista: T[], nuevo: T, igual: (a: T, b: T) => boolean, max = 5) => [nuevo, ...lista.filter((x) => !igual(x, nuevo))].slice(0, max)

// Se llama al confirmar una compra.
export function recordarDatos(uid: string, d: { nombre?: string; whatsapp?: string } & Partial<DireccionUsada>) {
  const actual = leerDatosUsados(uid)
  if (d.nombre?.trim()) actual.nombres = alFrente(actual.nombres, d.nombre.trim(), (a, b) => norm(a) === norm(b))
  if (d.whatsapp?.trim()) actual.whatsapps = alFrente(actual.whatsapps, d.whatsapp.trim(), (a, b) => a.replace(/\D/g, '') === b.replace(/\D/g, ''))
  if (d.direccion?.trim()) {
    const dir = { direccion: d.direccion.trim(), zona: d.zona || '', entreCalles: d.entreCalles || '', referencia: d.referencia || '' }
    actual.direcciones = alFrente(actual.direcciones, dir, (a, b) => norm(a.direccion) === norm(b.direccion))
  }
  try { localStorage.setItem(clave(uid), JSON.stringify(actual)) } catch {}
}

// Junta lo del navegador con lo guardado en la cuenta (sin repetir).
export function mezclarConCuenta(d: DatosUsados, cuenta: any): DatosUsados {
  if (!cuenta) return d
  const out = { ...d }
  if (cuenta.nombreComprador && !out.nombres.some((n) => norm(n) === norm(cuenta.nombreComprador))) out.nombres = [...out.nombres, cuenta.nombreComprador]
  if (cuenta.whatsappComprador && !out.whatsapps.some((n) => n.replace(/\D/g, '') === String(cuenta.whatsappComprador).replace(/\D/g, ''))) out.whatsapps = [...out.whatsapps, cuenta.whatsappComprador]
  if (cuenta.direccion && !out.direcciones.some((x) => norm(x.direccion) === norm(cuenta.direccion))) {
    out.direcciones = [...out.direcciones, { direccion: cuenta.direccion, zona: cuenta.zonaEntrega || '', entreCalles: cuenta.entreCalles || '', referencia: cuenta.referenciaAdicional || '' }]
  }
  return out
}

// ¿La opción sirve para lo que lleva escrito? ("m" → "Marcelo Rodríguez",
// "rodr" → "Marcelo Rodríguez", "748" → "74859641").
export function coincideInicio(opcion: string, escrito: string) {
  const q = norm(escrito)
  const o = norm(opcion)
  if (!q || o === q) return false
  if (/^\d/.test(q)) return o.replace(/\D/g, '').startsWith(q.replace(/\D/g, ''))
  return o.startsWith(q) || o.split(' ').some((w) => w.startsWith(q))
}
