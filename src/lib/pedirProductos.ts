// "📦 Pedir productos y precios" (Admin → Captar tiendas y Usuarios):
// mensaje de WhatsApp para pedirle a una tienda (o a un cliente) su lista
// de productos con precios, con una plantilla fácil de completar desde el
// celular. La IA lo adapta al rubro y a lo que pida el admin; esto es la
// versión sin IA (y la base).

export type PedidoProductos = { mensaje: string; plantilla: string; consejos: string[] }

export type DatosPedido = {
  nombre?: string
  contacto?: string
  rubro?: string
  ciudad?: string
  requerimiento?: string
  // tienda: que nos pase su catálogo para subirlo · cliente: cotizar lo que pide un comprador
  tipo?: 'tienda' | 'cliente'
}

// Campos que conviene pedir según el rubro.
export function camposPorRubro(rubro = ''): string[] {
  const r = rubro.toLowerCase()
  if (/ropa|moda|boutique|calzado|zapat|textil|sastr|telas/.test(r)) return ['Producto', 'Precio (Bs)', 'Talles', 'Colores', 'Cantidad disponible']
  if (/celular|electr|comput|tecno|electrodom/.test(r)) return ['Producto y modelo', 'Precio (Bs)', 'Nuevo o usado', 'Garantía', 'Cantidad disponible']
  if (/comida|restaur|pana|paste|dulce|cafe|heladería|bebida|licor/.test(r)) return ['Producto', 'Precio (Bs)', 'Tamaño / porción', 'Días y horario que lo tenés']
  if (/ferret|repuesto|llanta|auto|moto/.test(r)) return ['Producto', 'Marca / medida', 'Precio (Bs)', 'Cantidad disponible']
  if (/cosm|belleza|perfum|farmac/.test(r)) return ['Producto', 'Marca', 'Presentación (ml / g)', 'Precio (Bs)', 'Cantidad disponible']
  return ['Producto', 'Precio (Bs)', 'Detalle (tamaño, color, modelo)', 'Cantidad disponible']
}

export function plantillaBase(campos: string[], filas = 3) {
  return Array.from({ length: filas }, (_, i) => `*${i + 1}.*\n` + campos.map((c) => `${c}: `).join('\n')).join('\n\n')
}

// Sin IA: lo que escribió el admin se traduce a campos de la plantilla
// (no se pega tal cual, porque es una instrucción para nosotros).
function camposSegunRequerimiento(campos: string[], req: string): string[] {
  const r = req.toLowerCase()
  const out = [...campos]
  const sumar = (c: string) => { if (!out.includes(c)) out.push(c) }
  if (/mayor/.test(r)) {
    const i = out.findIndex((c) => c.startsWith('Precio'))
    out.splice(i >= 0 ? i : 1, i >= 0 ? 1 : 0, 'Precio por menor (Bs)', 'Precio por mayor (Bs) y desde cuántas unidades')
  }
  if (/stock|cantidad|disponib/.test(r)) sumar('Cantidad disponible')
  if (/talle|talla/.test(r)) sumar('Talles')
  if (/color/.test(r)) sumar('Colores')
  if (/marca/.test(r)) sumar('Marca')
  if (/env[ií]o|entrega/.test(r)) sumar('¿Hacés envíos? ¿A qué zonas?')
  return out
}

export function pedidoBase(d: DatosPedido): PedidoProductos {
  const req = (d.requerimiento || '').trim()
  const campos = camposSegunRequerimiento(camposPorRubro(d.rubro), req)
  const plantilla = plantillaBase(campos)
  const saludo = d.contacto ? `¡Hola ${d.contacto}! 👋` : `¡Hola${d.nombre ? `, ${d.nombre}` : ''}! 👋`
  const cuantos = req.match(/\b(\d{1,3})\s*(productos|artículos|items|modelos)/i)?.[1]
  const mensaje =
    d.tipo === 'cliente'
      ? `${saludo}\nPara pasarte precios y disponibilidad, contame qué necesitás con este formato 👇\n\n${plantilla}\n\nSi tenés una foto o referencia de lo que buscás, mandala también 📸`
      : `${saludo}\nPara armar tu tienda en *Clasi Click* necesitamos tus productos con su precio${cuantos ? ` (con ${cuantos} para empezar alcanza)` : ''}.\n\nCopiá este mensaje, completalo y mandámelo 👇\n\n${plantilla}\n\n📸 Mandá *1 o 2 fotos por producto* (con buena luz y fondo claro).\nSi tenés más productos, seguí con el 4, 5… o mandame tu lista o catálogo como lo tengas, nosotros lo ordenamos 🙌`
  return {
    mensaje,
    plantilla,
    consejos: [
      'Pedí primero 5 a 10 productos: es más fácil que te respondan.',
      'Si te manda una foto de su lista de precios o un audio, también sirve: lo cargamos nosotros.',
      'Cuando te responda, cargá sus productos desde Admin → Usuarios → 🛍️ Cargar productos (formulario o Excel).',
    ],
  }
}
