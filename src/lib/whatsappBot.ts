import { getDb } from '@/lib/firebaseAdmin'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { CATEGORIAS_PRODUCTOS_BASE } from '@/data/categoriasProductos'
import { analizarFotoProducto, leerPrecio } from '@/lib/fotoProductoIA'
import { etiquetasParaProducto } from '@/lib/etiquetasProducto'
import { evaluarConIA } from '@/lib/moderacionIA'
import { formatoMoneda, paisDeCiudad } from '@/lib/mercado'
import { guiaIdioma, v } from '@/lib/estiloRegional'
import { SITE_URL } from '@/lib/sitio'
import { bajarMedia, enviarBotones, enviarTexto, esAdminWhatsapp, registrarEstadoBot, soloDigitos, subirAImgbb } from '@/lib/whatsappApi'

// Bot de WhatsApp de Clasi Click: el vendedor (o el admin) le escribe al
// número del bot y se cargan o cambian productos en su tienda.
//   📷 Foto + texto ("Remera oversize 15000 talles S M L stock 5") → producto nuevo
//   ✍️ "precio buzo 14000", "sin stock jean", "ocultar remera", "oferta campera 20%"
//   📋 "lista" → sus productos · "ayuda" → cómo se usa
//   🛠️ Admin: "tienda Creaciones Liz" elige en qué tienda trabaja
// Nada se guarda sin confirmar: el bot muestra el resumen y espera ✅ Sí.
// Estado de cada conversación: whatsappSesiones/{número}.

type Producto = { id: string; nombre: string; precio: number; precioOriginal?: number | null; stock?: number | null; estado?: string; rubro?: string; descripcionCorta?: string; talles?: string[]; colores?: string[] }
type Nuevo = { nombre: string; precio: number | null; precioOriginal: number | null; stock: number | null; talles: string[]; colores: string[]; descripcionCorta: string; publico: string; rubro: string; imagenUrl: string; thumbUrl: string }
type Cambios = Partial<Pick<Producto, 'nombre' | 'precio' | 'precioOriginal' | 'stock' | 'descripcionCorta' | 'talles' | 'colores'>> & { estado?: 'activo' | 'oculto' }
type Pendiente = { tipo: 'crear'; datos: Nuevo } | { tipo: 'modificar'; productoId: string; nombre: string; cambios: Cambios }
type Sesion = { tiendaId?: string; pendiente?: Pendiente | null }
type Tienda = { id: string; nombreNegocio?: string; ciudad?: string; email?: string; logoUrl?: string; tiposVenta?: any; envioPropio?: any; visibleEn?: string[] }

// Confirmaciones: el mensaje entero tiene que ser "sí", "ok", "dale"…
// (así "publicar remera" es un pedido nuevo y no un "sí" a lo pendiente).
const limpiar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
const SIS = new Set(['si', 'sii', 'siii', 'si si', 'ok', 'okay', 'dale', 'listo', 'confirmo', 'confirmar', 'guardar', 'guardalo', 'publicalo', 'publicar', 'yes', 'si dale', 'si guardalo', 'si publicalo'])
const NOS = new Set(['no', 'nop', 'cancelar', 'cancela', 'descartar', 'nada', 'no gracias', 'mejor no'])
const esSi = (t: string) => SIS.has(limpiar(t)) || /^(✅|👍)\s*$/u.test(t.trim())
const esNo = (t: string) => NOS.has(limpiar(t)) || /^❌\s*$/u.test(t.trim())

const db = () => getDb()
const sesionRef = (numero: string) => db().collection('whatsappSesiones').doc(numero)

async function leerSesion(numero: string): Promise<Sesion> {
  return ((await sesionRef(numero).get()).data() || {}) as Sesion
}
async function guardarSesion(numero: string, s: Partial<Sesion>) {
  await sesionRef(numero).set({ ...s, updatedAt: new Date().toISOString() }, { merge: true })
}

// Tiendas cuyo WhatsApp (o el celular de la cuenta) es este número.
async function tiendasDelNumero(numero: string): Promise<Tienda[]> {
  const n = soloDigitos(numero)
  const variantes = Array.from(new Set([n, n.replace(/^591/, ''), n.replace(/^549/, '54')]))
  const ids = new Set<string>()
  const [porTienda, porUsuario, porCelular] = await Promise.all([
    db().collection('vendedores').where('whatsapp', 'in', variantes).get(),
    db().collection('usuarios').where('whatsapp', 'in', variantes).get(),
    db().collection('usuarios').where('celular', 'in', variantes).get(),
  ])
  porTienda.docs.forEach((d) => ids.add(d.id))
  ;[...porUsuario.docs, ...porCelular.docs].forEach((d) => ids.add(d.id))
  const docs = await Promise.all(Array.from(ids).slice(0, 10).map((id) => db().collection('vendedores').doc(id).get()))
  return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() as any) }))
}

async function productosDe(tiendaId: string): Promise<Producto[]> {
  const snap = await db().collection('productos').where('vendedorId', '==', tiendaId).get()
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => p.estado !== 'rechazado')
}

const normal = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// "creaciones liz" → la tienda cuyo nombre más se parece.
async function buscarTienda(texto: string): Promise<Tienda | null> {
  const q = normal(texto)
  if (!q) return null
  const snap = await db().collection('vendedores').get()
  const tiendas = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tienda[]
  const puntaje = (t: Tienda) => {
    const n = normal(t.nombreNegocio || t.email || '')
    if (!n) return 0
    if (n === q) return 100
    if (n.includes(q) || q.includes(n)) return 60
    return q.split(' ').filter((w) => w.length > 2 && n.includes(w)).length * 10
  }
  const mejor = tiendas.map((t) => ({ t, p: puntaje(t) })).sort((a, b) => b.p - a.p)[0]
  return mejor && mejor.p >= 10 ? mejor.t : null
}

// ── IA: entiende el mensaje ──

async function groqJSON(prompt: string, max = 1500): Promise<any | null> {
  if (!process.env.GROQ_API_KEY) return null
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', max_completion_tokens: max, reasoning_effort: 'low', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) return null
    const d = await r.json()
    return JSON.parse(String(d.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}

// "8000", "$ 8.000", "ARS 8,000.00", "15,50" → número (0 vale: "sin stock" = 0).
const numero = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  if (/^\s*0+([.,]0+)?\s*$/.test(String(v ?? ''))) return 0
  return leerPrecio(v)
}
const lista = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 30) : typeof v === 'string' ? v.split(/[,/]+/).map((x) => x.trim()).filter(Boolean) : [])

// Datos de un producto nuevo a partir del texto que acompaña la foto.
async function leerProductoNuevo(texto: string, ciudadId: string): Promise<Partial<Nuevo>> {
  const r = await groqJSON(
    'Un vendedor de un marketplace manda por WhatsApp los datos de un producto para publicar. Extraé solo lo que dice, sin inventar. ' +
      `Texto: """${texto.slice(0, 800)}"""\n` +
      'Respondé SOLO JSON: {"nombre": "nombre comercial corto, con mayúscula inicial", "precio": número o null, "precioAntes": número tachado/anterior o null, ' +
      '"stock": número o null, "talles": ["…"], "colores": ["…"], "descripcion": "1-2 frases con lo que dijo (material, medidas, etc.) o vacío"}. ' +
      'Precios: "15.000" o "15 mil" = 15000; "15,50" = 15.5.' + guiaIdioma(ciudadId),
    800,
  )
  if (!r) {
    // Sin IA: el número más grande es el precio y el resto es el nombre.
    const precio = Math.max(0, ...(texto.match(/\d[\d.,]*/g) || []).map((x) => numero(x) || 0))
    return { nombre: texto.replace(/\$?\s*\d[\d.,]*/g, '').replace(/\s+/g, ' ').trim().slice(0, 80), precio: precio || null }
  }
  return {
    nombre: String(r.nombre || '').trim().slice(0, 100),
    precio: numero(r.precio),
    precioOriginal: numero(r.precioAntes),
    stock: r.stock == null ? null : Math.round(numero(r.stock) ?? 0),
    talles: lista(r.talles),
    colores: lista(r.colores),
    descripcionCorta: String(r.descripcion || '').trim().slice(0, 300),
  }
}

type Intencion =
  | { accion: 'modificar'; productoId: string; cambios: Cambios }
  | { accion: 'crear'; datos: Partial<Nuevo> }
  | { accion: 'corregir'; cambios: Partial<Nuevo> }
  | { accion: 'listar' | 'ayuda' }
  | { accion: 'otro'; respuesta?: string }

async function interpretar(texto: string, productos: Producto[], pendiente: Pendiente | null | undefined, ciudadId: string): Promise<Intencion> {
  const catalogo = productos.slice(0, 200).map((p) => `${p.id} | ${p.nombre} | precio ${p.precio}${p.precioOriginal ? ` (antes ${p.precioOriginal})` : ''} | stock ${p.stock ?? '-'} | ${p.estado === 'oculto' ? 'oculto' : 'publicado'}`).join('\n')
  const r = await groqJSON(
    'Sos el asistente de WhatsApp de una tienda en Clasi Click (marketplace). El vendedor te escribe para cambiar sus productos. ' +
      'Productos de la tienda (id | nombre | datos):\n' + (catalogo || '(sin productos)') + '\n\n' +
      (pendiente?.tipo === 'crear' ? `Hay un producto NUEVO esperando confirmación: ${JSON.stringify(pendiente.datos)}. Si el mensaje corrige ese producto (precio, nombre, talles…), la acción es "corregir".\n` : '') +
      `Mensaje: """${texto.slice(0, 800)}"""\n\n` +
      'Acciones posibles:\n' +
      '- "modificar": cambiar UN producto existente. "productoId" EXACTO de la lista (el que mejor coincide con lo que nombra) y "cambios" con solo lo que pide: ' +
      '{"precio": número, "precioOriginal": número (precio tachado; si pide "oferta X%" poné el precio actual como precioOriginal y el nuevo precio con el descuento), "stock": número ("sin stock" = 0), "estado": "oculto" | "activo" (ocultar/pausar = oculto; publicar/mostrar = activo), "nombre", "descripcionCorta", "talles": [], "colores": []}\n' +
      '- "crear": publicar un producto nuevo sin foto ("datos": {"nombre","precio","precioAntes","stock","talles","colores","descripcion"})\n' +
      '- "corregir": corrige el producto nuevo pendiente ("cambios" con los mismos campos que "datos")\n' +
      '- "listar": quiere ver sus productos · "ayuda": pregunta cómo se usa\n' +
      '- "otro": cualquier otra cosa; poné en "respuesta" una respuesta corta y amable.\n' +
      'Precios: "15.000" o "15 mil" = 15000. Respondé SOLO JSON: {"accion": "...", "productoId": "...", "cambios": {...}, "datos": {...}, "respuesta": "..."}' +
      guiaIdioma(ciudadId),
  )
  if (!r) return { accion: 'otro', respuesta: 'Ahora no puedo entender mensajes (la IA no responde). Probá en un rato.' }
  if (r.accion === 'modificar' && productos.some((p) => p.id === r.productoId)) return { accion: 'modificar', productoId: r.productoId, cambios: sanearCambios(r.cambios) }
  if (r.accion === 'crear') return { accion: 'crear', datos: { ...r.datos, precio: numero(r.datos?.precio), precioOriginal: numero(r.datos?.precioAntes), talles: lista(r.datos?.talles), colores: lista(r.datos?.colores), descripcionCorta: String(r.datos?.descripcion || '') } }
  if (r.accion === 'corregir' && pendiente?.tipo === 'crear') return { accion: 'corregir', cambios: { ...sanearCambios(r.cambios), ...(r.cambios?.precioAntes != null ? { precioOriginal: numero(r.cambios.precioAntes) } : {}) } as Partial<Nuevo> }
  if (r.accion === 'listar' || r.accion === 'ayuda') return { accion: r.accion }
  return { accion: 'otro', respuesta: typeof r.respuesta === 'string' ? r.respuesta.slice(0, 500) : undefined }
}

function sanearCambios(c: any): Cambios {
  const out: Cambios = {}
  if (!c || typeof c !== 'object') return out
  if (c.precio != null && numero(c.precio)) out.precio = numero(c.precio)!
  if (c.precioOriginal !== undefined) out.precioOriginal = c.precioOriginal === null ? null : numero(c.precioOriginal)
  if (c.stock != null && numero(c.stock) != null) out.stock = Math.round(numero(c.stock)!)
  if (c.estado === 'oculto' || c.estado === 'activo') out.estado = c.estado
  if (typeof c.nombre === 'string' && c.nombre.trim()) out.nombre = c.nombre.trim().slice(0, 120)
  if (typeof c.descripcionCorta === 'string') out.descripcionCorta = c.descripcionCorta.trim().slice(0, 300)
  if (c.talles !== undefined) out.talles = lista(c.talles)
  if (c.colores !== undefined) out.colores = lista(c.colores)
  return out
}

// ── Textos ──

const plata = (n: number | null | undefined, ciudadId: string) => formatoMoneda(Number(n || 0), paisDeCiudad(ciudadId))

function resumenNuevo(d: Nuevo, ciudadId: string, rubroLabel: string) {
  return [
    `🛍️ *${d.nombre || 'Sin nombre'}*`,
    `💰 ${d.precio ? plata(d.precio, ciudadId) : '⚠️ falta el precio'}${d.precioOriginal && d.precio && d.precioOriginal > d.precio ? ` (antes ${plata(d.precioOriginal, ciudadId)})` : ''}`,
    d.talles.length ? `📏 ${v(ciudadId, 'Tallas', 'Talles')}: ${d.talles.join(', ')}` : '',
    d.colores.length ? `🎨 Colores: ${d.colores.join(', ')}` : '',
    d.stock != null ? `📦 Stock: ${d.stock}` : '',
    `🏷️ Categoría: ${rubroLabel || 'sin definir (queda pendiente de revisión)'}`,
    d.descripcionCorta ? `📝 ${d.descripcionCorta}` : '',
  ].filter(Boolean).join('\n')
}

function resumenCambios(p: Producto, c: Cambios, ciudadId: string) {
  const l: string[] = []
  if (c.nombre) l.push(`Nombre: ${p.nombre} → *${c.nombre}*`)
  if (c.precio != null) l.push(`Precio: ${plata(p.precio, ciudadId)} → *${plata(c.precio, ciudadId)}*`)
  if (c.precioOriginal !== undefined) l.push(c.precioOriginal ? `Precio tachado: *${plata(c.precioOriginal, ciudadId)}*` : 'Sin precio tachado')
  if (c.stock != null) l.push(`Stock: ${p.stock ?? 'sin control'} → *${c.stock}*`)
  if (c.estado) l.push(c.estado === 'oculto' ? '*Ocultar* (no se ve en la tienda)' : '*Publicar* (se ve en la tienda)')
  if (c.descripcionCorta !== undefined) l.push(`Descripción: _${c.descripcionCorta || '(vacía)'}_`)
  if (c.talles) l.push(`Talles: *${c.talles.join(', ') || '(ninguno)'}*`)
  if (c.colores) l.push(`Colores: *${c.colores.join(', ') || '(ninguno)'}*`)
  return l.join('\n')
}

const ayuda = (ciudadId: string, admin: boolean) =>
  [
    '👋 Soy el asistente de *Clasi Click*. Puedo cargar y cambiar productos de tu tienda:',
    '',
    `📷 *Producto nuevo:* ${v(ciudadId, 'manda una foto con el texto', 'mandá una foto con el texto')}, ej: _Remera oversize 15000 talles S M L stock 5_`,
    '💰 *Precio:* _precio buzo canguro 14000_',
    '🔥 *Oferta:* _oferta campera 20%_',
    '📦 *Stock:* _stock jean mom 3_ o _sin stock jean mom_',
    '🙈 *Ocultar / publicar:* _ocultar remera_ · _publicar remera_',
    '📋 *Ver tus productos:* _lista_',
    admin ? '🛠️ *Admin:* _tienda Creaciones Liz_ para elegir en qué tienda trabajás' : '',
    '',
    'Siempre te muestro el cambio y espero tu ✅ antes de guardar.',
  ].filter((x) => x !== '').join('\n')

// ── Guardar ──

async function crearProducto(t: Tienda, d: Nuevo, numeroWa: string): Promise<string> {
  const ahora = new Date().toISOString()
  const ciudad = ciudadDe(t)
  const moderacionIA = await evaluarConIA(`Producto: ${d.nombre}\nRubro: ${d.rubro}\nPrecio: ${d.precio}`).catch(() => null)
  const ref = await db().collection('productos').add({
    nombre: d.nombre,
    rubro: d.rubro,
    publico: d.publico || 'unisex',
    precio: d.precio,
    precioOriginal: d.precioOriginal && d.precio && d.precioOriginal > d.precio ? d.precioOriginal : null,
    icono: 'shoe',
    imagenUrl: d.imagenUrl,
    imagenViewerUrl: '',
    thumbUrl: d.thumbUrl || d.imagenUrl,
    descripcionCorta: d.descripcionCorta,
    descripcionLarga: '',
    talles: d.talles,
    colores: d.colores,
    materiales: '',
    compraMinima: 1,
    stock: d.stock,
    fotosAdicionales: [],
    vendedorId: t.id,
    vendedor: t.email || '',
    cargadoPorWhatsapp: soloDigitos(numeroWa),
    tiendaNombre: t.nombreNegocio || '',
    tiendaLogoUrl: t.logoUrl || '',
    ciudad,
    enviaATodoBolivia: !!t.tiposVenta?.haceEnvios && t.envioPropio?.alcance === 'bolivia',
    ...(Array.isArray(t.visibleEn) && t.visibleEn.length ? { visibleEn: t.visibleEn } : {}),
    plan: 'basico',
    // Sin categoría no se puede mostrar bien: queda para revisar.
    estado: d.rubro ? 'activo' : 'pendiente',
    moderacionIA,
    createdAt: ahora,
    updatedAt: ahora,
  })
  const etiquetasBusqueda = await etiquetasParaProducto({ nombre: d.nombre, rubro: d.rubro, publico: d.publico, descripcionCorta: d.descripcionCorta, colores: d.colores }).catch(() => [])
  if (etiquetasBusqueda.length) await ref.update({ etiquetasBusqueda }).catch(() => {})
  return ref.id
}

async function modificarProducto(id: string, c: Cambios) {
  const ref = db().collection('productos').doc(id)
  const actual = (await ref.get()).data() || {}
  const cambios: Record<string, unknown> = { ...c, updatedAt: new Date().toISOString() }
  // Un precio tachado menor o igual al precio no es oferta.
  const precio = (c.precio ?? actual.precio) as number
  if ('precioOriginal' in c && c.precioOriginal != null && !(c.precioOriginal > precio)) cambios.precioOriginal = null
  if (c.nombre || c.descripcionCorta !== undefined) {
    const etiquetas = await etiquetasParaProducto({ ...actual, ...cambios }).catch(() => [])
    if (etiquetas.length) cambios.etiquetasBusqueda = etiquetas
  }
  await ref.update(cambios)
}

// ── El mensaje ──

export type MensajeWhatsapp = {
  id: string
  from: string
  type: string
  text?: { body?: string }
  image?: { id: string; caption?: string }
  interactive?: { button_reply?: { id: string; title: string } }
  button?: { text?: string; payload?: string }
}

export async function procesarMensaje(m: MensajeWhatsapp) {
  const de = soloDigitos(m.from)
  // Meta reintenta si tarda: cada mensaje se procesa una sola vez.
  try {
    await db().collection('whatsappMensajes').doc(m.id).create({ de, tipo: m.type, at: new Date().toISOString() })
  } catch {
    return
  }
  await cargarCiudadesServidor().catch(() => null)
  const admin = esAdminWhatsapp(de)
  const texto = String(m.text?.body || m.image?.caption || m.interactive?.button_reply?.id || m.button?.payload || m.button?.text || '').trim()
  const sesion = await leerSesion(de)

  // ¿En qué tienda trabaja?
  let tienda: Tienda | null = null
  const propias = await tiendasDelNumero(de)
  const pideTienda = texto.match(/^tienda\s*:?\s+(.+)$/i)
  if (admin && pideTienda) {
    const t = await buscarTienda(pideTienda[1])
    if (!t) return enviarTexto(de, `No encontré la tienda “${pideTienda[1]}”. Escribí el nombre como figura en Clasi Click.`)
    await guardarSesion(de, { tiendaId: t.id, pendiente: null })
    const n = (await productosDe(t.id)).length
    return enviarTexto(de, `🏪 Listo, trabajás en *${t.nombreNegocio || t.email}* (${buscarCiudad(ciudadDe(t)).nombre}, ${n} productos).\nMandá una foto con su texto o escribí lo que querés cambiar.`)
  }
  if (sesion.tiendaId && (admin || propias.some((t) => t.id === sesion.tiendaId))) {
    const d = await db().collection('vendedores').doc(sesion.tiendaId).get()
    if (d.exists) tienda = { id: d.id, ...(d.data() as any) }
  }
  if (!tienda && propias.length === 1) tienda = propias[0]
  if (!tienda) {
    if (admin) return enviarTexto(de, '🛠️ Sos admin: primero elegí la tienda, ej: *tienda Creaciones Liz*')
    if (propias.length > 1) {
      // Varias tiendas con el mismo número: se elige escribiendo su nombre.
      const elegida = propias.find((t) => texto && normal(t.nombreNegocio || '').includes(normal(texto)))
      if (elegida) {
        await guardarSesion(de, { tiendaId: elegida.id, pendiente: null })
        return enviarTexto(de, `🏪 Listo: *${elegida.nombreNegocio}*. Mandá una foto con su texto o escribí lo que querés cambiar.`)
      }
      return enviarTexto(de, `Tenés varias tiendas: ${propias.map((t) => `*${t.nombreNegocio || t.id}*`).join(', ')}. Escribí el nombre de la que querés usar.`)
    }
    return enviarTexto(de, `Este número no está registrado en ninguna tienda de Clasi Click. Cargá tu WhatsApp en ${SITE_URL}/vender → Mi tienda, o pedile al administrador que te dé de alta.`)
  }

  const ciudadId = ciudadDe(tienda)
  const pendiente = sesion.pendiente || null

  // ✅ / ❌ de lo que estaba esperando.
  if (pendiente && esSi(texto)) {
    await guardarSesion(de, { pendiente: null })
    if (pendiente.tipo === 'crear') {
      if (!pendiente.datos.nombre || !pendiente.datos.precio) {
        await guardarSesion(de, { pendiente })
        return enviarTexto(de, !pendiente.datos.nombre ? '⚠️ Falta el nombre. Escribilo, ej: *Conjunto de keten frizado*' : '⚠️ Falta el precio. Escribilo, ej: *15000*')
      }
      const id = await crearProducto(tienda, pendiente.datos, de)
      return enviarTexto(de, `✅ ${pendiente.datos.rubro ? 'Publicado' : 'Guardado (pendiente: falta la categoría, la elegís en la web)'}: *${pendiente.datos.nombre}*\n${SITE_URL}/producto/${id}`)
    }
    await modificarProducto(pendiente.productoId, pendiente.cambios)
    return enviarTexto(de, `✅ Listo, actualicé *${pendiente.nombre}*.\n${SITE_URL}/producto/${pendiente.productoId}`)
  }
  if (pendiente && esNo(texto)) {
    await guardarSesion(de, { pendiente: null })
    return enviarTexto(de, '👌 Descartado, no guardé nada.')
  }

  const arbol = await construirArbolCategoriasProductos().catch(() => null)
  const categorias = (arbol as any)?.categorias || CATEGORIAS_PRODUCTOS_BASE
  const etiquetaRubro = (id: string) => {
    const r = ((arbol as any)?.rubrosFlat || []).find((x: any) => x.id === id)
    return r ? [r.categoriaLabel, r.grupo, /^otros?$/i.test(r.label) ? '' : r.label].filter(Boolean).join(' › ') : ''
  }
  const pedirConfirmacion = async (p: Pendiente, cuerpo: string) => {
    await guardarSesion(de, { pendiente: p })
    // A un producto nuevo sin nombre o sin precio se le pide lo que falta antes de ofrecer guardarlo.
    if (p.tipo === 'crear' && !p.datos.nombre) return enviarTexto(de, `${cuerpo}\n\n✍️ ¿Cómo se llama el producto? ${v(ciudadId, 'Escríbelo', 'Escribilo')}, ej: *Conjunto de keten frizado*`)
    if (p.tipo === 'crear' && !p.datos.precio) return enviarTexto(de, `${cuerpo}\n\n💰 ¿Cuánto cuesta? ${v(ciudadId, 'Responde', 'Respondé')} solo con el precio, ej: *8000*`)
    return enviarBotones(de, `${cuerpo}\n\n¿Lo guardo?`, [{ id: 'si', titulo: '✅ Sí' }, { id: 'no', titulo: '❌ No' }])
  }

  // 📷 Foto → producto nuevo.
  if (m.type === 'image' && m.image?.id) {
    await enviarTexto(de, '📷 Recibí la foto, la estoy preparando…')
    let foto: { url: string; thumbUrl: string }
    try {
      const { buf } = await bajarMedia(m.image.id)
      foto = await subirAImgbb(buf)
    } catch (err: any) {
      await registrarEstadoBot({ ultimoErrorProceso: { at: new Date().toISOString(), de, texto: `Foto: ${err?.message || 'error'}` } })
      return enviarTexto(de, `No pude guardar la foto: ${err?.message || 'error'}. Probá de nuevo.`)
    }
    const leido = texto ? await leerProductoNuevo(texto, ciudadId) : {}
    // Categoría, público y colores: la IA mira la foto (o el nombre si no puede).
    const ia = await analizarFotoProducto(foto.url, categorias, leido.nombre || texto || undefined).catch(() => null)
    const datos: Nuevo = {
      nombre: leido.nombre || ia?.nombre || '',
      precio: leido.precio ?? null,
      precioOriginal: leido.precioOriginal ?? null,
      stock: leido.stock ?? null,
      talles: leido.talles || [],
      colores: leido.colores?.length ? leido.colores : ia?.colores || [],
      descripcionCorta: leido.descripcionCorta || ia?.descripcion || '',
      publico: ia?.publico || 'unisex',
      rubro: ia?.rubroId || '',
      imagenUrl: foto.url,
      thumbUrl: foto.thumbUrl,
    }
    const resumen = `Producto nuevo en *${tienda.nombreNegocio || 'tu tienda'}*:\n\n${resumenNuevo(datos, ciudadId, etiquetaRubro(datos.rubro))}`
    // Sin precio (ej. un producto reenviado del catálogo: el precio no viene en la foto) lo pide primero.
    return pedirConfirmacion({ tipo: 'crear', datos }, resumen)
  }

  if (!texto) return enviarTexto(de, ayuda(ciudadId, admin))
  if (/^(hola|buenas|ayuda|help|menu|menú|\?)\b/i.test(texto)) return enviarTexto(de, ayuda(ciudadId, admin))

  const productos = await productosDe(tienda.id)
  if (/^(lista|mis productos|productos|ver productos)\b/i.test(texto)) return enviarTexto(de, listaProductos(tienda, productos, ciudadId))

  // Solo un número con un producto nuevo pendiente = su precio (sin gastar IA).
  if (pendiente?.tipo === 'crear' && /^\s*(bs\.?|ars|\$)?\s*\d[\d.,]*\s*(bs|ars|pesos|\$)?\s*$/i.test(texto)) {
    const precio = numero(texto.replace(/[^\d.,]/g, ''))
    if (precio) {
      const datos = { ...pendiente.datos, precio }
      return pedirConfirmacion({ tipo: 'crear', datos }, `Producto nuevo en *${tienda.nombreNegocio || 'tu tienda'}*:\n\n${resumenNuevo(datos, ciudadId, etiquetaRubro(datos.rubro))}`)
    }
  }
  const r = await interpretar(texto, productos, pendiente, ciudadId)
  if (r.accion === 'ayuda') return enviarTexto(de, ayuda(ciudadId, admin))
  if (r.accion === 'listar') return enviarTexto(de, listaProductos(tienda, productos, ciudadId))
  if (r.accion === 'corregir' && pendiente?.tipo === 'crear') {
    const datos = { ...pendiente.datos, ...Object.fromEntries(Object.entries(r.cambios).filter(([, x]) => x !== undefined)) } as Nuevo
    return pedirConfirmacion({ tipo: 'crear', datos }, `Corregido:\n\n${resumenNuevo(datos, ciudadId, etiquetaRubro(datos.rubro))}`)
  }
  if (r.accion === 'modificar') {
    const p = productos.find((x) => x.id === r.productoId)!
    if (!Object.keys(r.cambios).length) return enviarTexto(de, `¿Qué querés cambiar de *${p.nombre}*? Ej: _precio ${p.nombre.toLowerCase()} 14000_`)
    return pedirConfirmacion({ tipo: 'modificar', productoId: p.id, nombre: p.nombre, cambios: r.cambios }, `✏️ *${p.nombre}*\n${resumenCambios(p, r.cambios, ciudadId)}`)
  }
  if (r.accion === 'crear') {
    const leido = r.datos
    const ia = leido.nombre ? await analizarFotoProducto('', categorias, leido.nombre).catch(() => null) : null
    const datos: Nuevo = {
      nombre: String(leido.nombre || '').trim().slice(0, 100),
      precio: leido.precio ?? null,
      precioOriginal: leido.precioOriginal ?? null,
      stock: leido.stock ?? null,
      talles: leido.talles || [],
      colores: leido.colores || [],
      descripcionCorta: String(leido.descripcionCorta || '').slice(0, 300),
      publico: ia?.publico || 'unisex',
      rubro: ia?.rubroId || '',
      imagenUrl: '',
      thumbUrl: '',
    }
    if (!datos.nombre) return enviarTexto(de, ayuda(ciudadId, admin))
    return pedirConfirmacion({ tipo: 'crear', datos }, `Producto nuevo (sin foto: ${v(ciudadId, 'mándala', 'mandala')} después y lo cargamos de nuevo con foto, o agregala en la web):\n\n${resumenNuevo(datos, ciudadId, etiquetaRubro(datos.rubro))}`)
  }
  return enviarTexto(de, (r.accion === 'otro' && r.respuesta) || ayuda(ciudadId, admin))
}

function listaProductos(tienda: Tienda, productos: Producto[], ciudadId: string) {
  if (!productos.length) return 'Tu tienda todavía no tiene productos. Mandá una foto con su nombre y precio para cargar el primero.'
  const filas = productos.slice(0, 40).map((p) => `• ${p.nombre} — ${plata(p.precio, ciudadId)}${p.stock != null ? ` · stock ${p.stock}` : ''}${p.estado === 'oculto' ? ' · 🙈 oculto' : p.estado === 'pendiente' ? ' · ⏳ pendiente' : ''}`)
  return `📋 *${tienda.nombreNegocio || 'Tu tienda'}* (${productos.length}):\n${filas.join('\n')}${productos.length > 40 ? `\n…y ${productos.length - 40} más` : ''}`
}
