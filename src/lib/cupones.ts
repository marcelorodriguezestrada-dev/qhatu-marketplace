// Cupones de descuento / campañas (ej. "ENVIOGRATIS", "POTOSI10").
// Las reglas viven acá para que el checkout (mostrar el descuento) y el
// servidor (/api/cupones/validar y /api/pedidos, que vuelven a chequear
// todo) calculen exactamente lo mismo.
//
// Quién paga el descuento: lo absorbe Clasi Click — al vendedor se le
// liquida igual que siempre. Por eso cada pedido guarda el detalle del
// cupón (ver /api/pedidos), para que el admin lo tenga en cuenta.

export type TipoCupon = 'envio_gratis' | 'porcentaje' | 'monto'

export const TIPOS_CUPON: { id: TipoCupon; label: string }[] = [
  { id: 'envio_gratis', label: 'Envío gratis' },
  { id: 'porcentaje', label: 'Descuento en %' },
  { id: 'monto', label: 'Descuento en Bs' },
]

export type Cupon = {
  id: string
  codigo: string
  campana: string
  tipo: TipoCupon
  // % (1-100) para 'porcentaje', Bs para 'monto'. Sin uso en envío gratis.
  valor: number
  // Tope en Bs del descuento en % (opcional, 0 = sin tope).
  descuentoMaximo: number
  compraMinima: number
  // Fechas ISO (YYYY-MM-DD) inclusive, en hora de Bolivia. '' = sin límite.
  desde: string
  hasta: string
  // 0 = sin límite.
  limiteUsos: number
  unaVezPorUsuario: boolean
  // Solo envío gratis: si también cubre el extra del envío express.
  incluyeExpress: boolean
  // Se muestra como banner público (portada y productos) — hasta a la
  // gente sin sesión, para invitarla a entrar y usarlo.
  destacado: boolean
  activo: boolean
  usosCount: number
  createdAt: string
}

export function normalizarCodigo(codigo: unknown): string {
  return String(codigo || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
}

// Fecha de hoy en Bolivia (UTC-4, sin horario de verano) como YYYY-MM-DD.
export function hoyBolivia(ahora = Date.now()): string {
  return new Date(ahora - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function describirCupon(c: Pick<Cupon, 'tipo' | 'valor' | 'compraMinima' | 'descuentoMaximo'>): string {
  const base =
    c.tipo === 'envio_gratis' ? 'Envío gratis' : c.tipo === 'porcentaje' ? `${c.valor}% de descuento` : `Bs ${c.valor} de descuento`
  const tope = c.tipo === 'porcentaje' && c.descuentoMaximo > 0 ? ` (hasta Bs ${c.descuentoMaximo})` : ''
  const minimo = c.compraMinima > 0 ? ` en compras desde Bs ${c.compraMinima}` : ''
  return base + tope + minimo
}

export type ContextoCompra = {
  subtotal: number
  // Costo de envío total sin cupón (0 si es retiro), y cuánto de eso es
  // el extra del express.
  costoEnvio: number
  extraExpress: number
  metodoEntrega: 'envio' | 'retiro'
}

export type ResultadoCupon =
  | { ok: true; descuentoProductos: number; descuentoEnvio: number; descripcion: string }
  | { ok: false; error: string }

// Reglas del cupón sin mirar los usos (eso lo chequea el servidor, que
// es el único que sabe cuántas veces se usó y por quién).
export function evaluarCupon(c: Cupon, compra: ContextoCompra, ahora = Date.now()): ResultadoCupon {
  if (!c.activo) return { ok: false, error: 'Este cupón está pausado.' }
  const hoy = hoyBolivia(ahora)
  if (c.desde && hoy < c.desde) return { ok: false, error: 'Este cupón todavía no está vigente.' }
  if (c.hasta && hoy > c.hasta) return { ok: false, error: 'Este cupón ya venció.' }
  if (c.limiteUsos > 0 && (c.usosCount || 0) >= c.limiteUsos) return { ok: false, error: 'Este cupón ya alcanzó su límite de usos.' }
  if (c.compraMinima > 0 && compra.subtotal < c.compraMinima) {
    return { ok: false, error: `Este cupón es para compras desde Bs ${c.compraMinima}.` }
  }

  let descuentoProductos = 0
  let descuentoEnvio = 0
  if (c.tipo === 'envio_gratis') {
    if (compra.metodoEntrega !== 'envio') return { ok: false, error: 'Este cupón es de envío gratis: elegí envío a domicilio para usarlo.' }
    descuentoEnvio = c.incluyeExpress ? compra.costoEnvio : Math.max(0, compra.costoEnvio - compra.extraExpress)
  } else if (c.tipo === 'porcentaje') {
    descuentoProductos = Math.round((compra.subtotal * c.valor) / 100)
    if (c.descuentoMaximo > 0) descuentoProductos = Math.min(descuentoProductos, c.descuentoMaximo)
  } else {
    descuentoProductos = c.valor
  }
  descuentoProductos = Math.max(0, Math.min(descuentoProductos, compra.subtotal))
  descuentoEnvio = Math.max(0, Math.min(descuentoEnvio, compra.costoEnvio))
  return { ok: true, descuentoProductos, descuentoEnvio, descripcion: describirCupon(c) }
}

// Saneo de lo que manda el admin al crear/editar un cupón.
export function sanearCupon(body: any): { datos?: Omit<Cupon, 'id' | 'usosCount' | 'createdAt'>; error?: string } {
  const codigo = normalizarCodigo(body?.codigo)
  if (codigo.length < 3) return { error: 'El código tiene que tener al menos 3 letras o números.' }
  const tipo: TipoCupon = TIPOS_CUPON.some((t) => t.id === body?.tipo) ? body.tipo : 'envio_gratis'
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
  }
  const valor = tipo === 'envio_gratis' ? 0 : num(body?.valor)
  if (tipo === 'porcentaje' && (valor <= 0 || valor > 100)) return { error: 'El porcentaje tiene que estar entre 1 y 100.' }
  if (tipo === 'monto' && valor <= 0) return { error: 'Poné el monto del descuento en Bs.' }
  const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
  const desde = fecha(body?.desde)
  const hasta = fecha(body?.hasta)
  if (desde && hasta && hasta < desde) return { error: 'La fecha de fin es anterior a la de inicio.' }
  return {
    datos: {
      codigo,
      campana: String(body?.campana || '').trim().slice(0, 80),
      tipo,
      valor,
      descuentoMaximo: tipo === 'porcentaje' ? num(body?.descuentoMaximo) : 0,
      compraMinima: num(body?.compraMinima),
      desde,
      hasta,
      limiteUsos: Math.floor(num(body?.limiteUsos)),
      unaVezPorUsuario: !!body?.unaVezPorUsuario,
      incluyeExpress: tipo === 'envio_gratis' && !!body?.incluyeExpress,
      destacado: !!body?.destacado,
      activo: body?.activo !== false,
    },
  }
}

// Cupón que alguien eligió desde el banner (o que quedó pendiente
// mientras iniciaba sesión): el checkout lo aplica solo al entrar.
export const CLAVE_CUPON_PENDIENTE = 'clasiclick_cupon_pendiente'

export function guardarCuponPendiente(codigo: string) {
  try { localStorage.setItem(CLAVE_CUPON_PENDIENTE, normalizarCodigo(codigo)) } catch {}
}

export function tomarCuponPendiente(): string {
  try {
    const c = localStorage.getItem(CLAVE_CUPON_PENDIENTE) || ''
    localStorage.removeItem(CLAVE_CUPON_PENDIENTE)
    return normalizarCodigo(c)
  } catch {
    return ''
  }
}
