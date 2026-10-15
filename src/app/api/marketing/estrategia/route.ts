import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { diaBolivia } from '@/lib/fechaBolivia'
import { esPremiumVigente } from '@/lib/planPremium'
import { leerDiasUsuario } from '@/lib/estadisticasUsuario'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { construirArbolCategoriasProductos } from '@/lib/categoriasProductosServer'
import { estrategiaMarketingIA } from '@/lib/moderacionIA'
import { buscarCiudad, ciudadDe } from '@/data/ciudades'
import { RUBRO_DE_GRUPO } from '@/data/categoriasProductos'
import {
  DIAS_ENTRE_ESTRATEGIAS_GRATIS, OBJETIVOS_ESTRATEGIA, proximasFechas,
  type DiaEstrategia, type Estrategia, type FechaAdmin, type FechaEspecial, type ObjetivoEstrategia,
} from '@/lib/fechasEspeciales'

export const dynamic = 'force-dynamic'

// Vender → Marketing → "🎯 Estrategia con IA".
//   GET  → la última estrategia guardada, las fechas especiales que se
//          vienen y si puede armar una nueva (gratis: 1 cada 7 días).
//   POST { objetivo, fechaId?, pedido? } → arma una nueva con los números
//          de los últimos 30 días de sus productos.
//   POST { accion: 'hecho', dia, hecho } → marca un día del plan como hecho.
// Se guarda en estrategiasMarketing/{uid}.

const REDES = ['whatsapp', 'facebook', 'instagram', 'tiktok']
const TONOS = ['cercano', 'oferta', 'elegante']
const ESTADOS_SIN_VENTA = new Set(['cancelado', 'rechazado'])

const sumarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function contexto(uid: string) {
  const db = getDb()
  await cargarCiudadesServidor().catch(() => null)
  const [vendedorDoc, estrategiaDoc, fechasSnap] = await Promise.all([
    db.collection('vendedores').doc(uid).get(),
    db.collection('estrategiasMarketing').doc(uid).get(),
    db.collection('fechasMarketing').get().catch(() => null),
  ])
  const vendedor = (vendedorDoc.data() || {}) as any
  const ciudad = ciudadDe(vendedor)
  const hoy = diaBolivia()
  const extras = (fechasSnap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as any) })) as FechaAdmin[]
  const fechas = proximasFechas(buscarCiudad(ciudad).pais, ciudad, hoy, extras)
  const guardado = (estrategiaDoc.data() || {}) as any
  const premium = esPremiumVigente(vendedor)
  // Solo cuentan las armadas con IA (si la IA falló, no gasta la semanal).
  const ultimaIA = String(guardado.ultimaIAAt || '')
  const proximaGratis = ultimaIA ? new Date(Date.parse(ultimaIA) + DIAS_ENTRE_ESTRATEGIAS_GRATIS * 86400_000).toISOString() : null
  const puedeGenerar = premium || !proximaGratis || Date.parse(proximaGratis) <= Date.now()
  return { db, vendedor, ciudad, hoy, fechas, guardado, premium, puedeGenerar, proximaGratis }
}

export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const c = await contexto(usuario.uid)
    return NextResponse.json({
      estrategia: c.guardado.ultima || null,
      fechas: c.fechas,
      premium: c.premium,
      puedeGenerar: c.puedeGenerar,
      proximaGratis: c.puedeGenerar ? null : c.proximaGratis,
    })
  } catch (err) {
    console.error('GET /api/marketing/estrategia', err)
    return NextResponse.json({ error: 'No se pudo cargar.' }, { status: 500 })
  }
}

type ProductoNumeros = {
  id: string; nombre: string; precio: number; precioOriginal: number | null; stock: number | null
  categoria: string; vistas: number; carrito: number; vendidas: number; createdAt: string
}

// Los productos activos de la tienda con sus números de 30 días.
async function productosConNumeros(db: FirebaseFirestore.Firestore, uid: string, hoy: string): Promise<ProductoNumeros[]> {
  const desde = sumarDias(hoy, -29)
  const [prodSnap, dias, pedidosSnap, arbol] = await Promise.all([
    db.collection('productos').where('vendedorId', '==', uid).get(),
    leerDiasUsuario(uid, desde),
    db.collection('pedidos').where('vendedorId', '==', uid).get(),
    construirArbolCategoriasProductos().catch(() => null),
  ])
  const rutas = new Map<string, string>(((arbol as any)?.rubrosFlat || []).map((r: any) => [r.id, [r.categoriaLabel, r.grupo, /^otros?$/i.test(r.label) ? '' : r.label].filter(Boolean).join(' > ')]))
  const vistas = new Map<string, { vistas: number; carrito: number }>()
  for (const d of dias) {
    for (const [clave, v] of Object.entries(d.items)) {
      if (!clave.startsWith('p_')) continue
      const x = vistas.get(clave.slice(2)) || { vistas: 0, carrito: 0 }
      x.vistas += Number(v?.vistas || 0)
      x.carrito += Number(v?.carrito || 0)
      vistas.set(clave.slice(2), x)
    }
  }
  const vendidas = new Map<string, number>()
  for (const doc of pedidosSnap.docs) {
    const p = doc.data() as any
    if (!p.createdAt || p.esPrueba || ESTADOS_SIN_VENTA.has(p.estado) || diaBolivia(p.createdAt) < desde) continue
    for (const it of Array.isArray(p.items) ? p.items : []) vendidas.set(String(it?.id || ''), (vendidas.get(String(it?.id || '')) || 0) + (Number(it?.cantidad) || 0))
  }
  return prodSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p) => !p.estado || p.estado === 'activo')
    .map((p) => ({
      id: p.id,
      nombre: String(p.nombre || 'Producto'),
      precio: Number(p.precio || 0),
      precioOriginal: Number(p.precioOriginal) > Number(p.precio) ? Number(p.precioOriginal) : null,
      stock: typeof p.stock === 'number' ? p.stock : null,
      categoria: rutas.get(RUBRO_DE_GRUPO[p.rubro] || p.rubro) || '',
      vistas: vistas.get(p.id)?.vistas || 0,
      carrito: vistas.get(p.id)?.carrito || 0,
      vendidas: vendidas.get(p.id) || 0,
      createdAt: String(p.createdAt || ''),
    }))
}

// Los que se le pasan a la IA según el objetivo (los más relevantes primero).
function candidatos(productos: ProductoNumeros[], objetivo: ObjetivoEstrategia) {
  const interes = (p: ProductoNumeros) => p.vistas + 3 * p.carrito
  const lista = [...productos]
  if (objetivo === 'mas-vistos') lista.sort((a, b) => interes(b) - interes(a) || b.vendidas - a.vendidas)
  else if (objetivo === 'sin-ventas') {
    // Primero los que miran y no compran; después los que nadie vio (los más viejos).
    const sinVenta = lista.filter((p) => p.vendidas === 0)
    return (sinVenta.length ? sinVenta : lista).sort((a, b) => interes(b) - interes(a) || a.createdAt.localeCompare(b.createdAt)).slice(0, 30)
  } else if (objetivo === 'liquidar') {
    const urgentes = (p: ProductoNumeros) => Number(p.stock != null && p.stock > 0 && p.stock <= 3) * 2 + Number(!!p.precioOriginal)
    lista.sort((a, b) => urgentes(b) - urgentes(a) || a.createdAt.localeCompare(b.createdAt))
  } else lista.sort((a, b) => interes(b) - interes(a))
  return lista.slice(0, objetivo === 'fecha' || objetivo === 'libre' ? 60 : 30)
}

// Sin IA (o si respondió algo inválido): un plan simple con las mismas reglas.
function planBase(lista: ProductoNumeros[], objetivo: ObjetivoEstrategia, dias: number, fecha: FechaEspecial | null) {
  const elegidos = lista.slice(0, Math.min(4, lista.length))
  const redes = ['whatsapp', 'facebook', 'instagram', 'whatsapp', 'facebook', 'tiktok', 'whatsapp']
  const titulo = fecha ? `${fecha.emoji} Campaña ${fecha.nombre}` : OBJETIVOS_ESTRATEGIA.find((o) => o.id === objetivo)?.label.replace(/^\S+\s/, '') || 'Tu estrategia'
  return {
    titulo,
    resumen: 'Publicá un poco cada día con tus productos elegidos, siempre con su link para medir qué funciona. Al final de la semana mirá en "Tus publicaciones" cuál trajo más visitas y repetí esa.',
    productos: elegidos.map((p) => ({
      id: p.id,
      porque: p.vistas ? `Tuvo ${p.vistas} vistas y ${p.vendidas} vendidas en 30 días.` : 'Casi nadie lo vio todavía: hay que mostrarlo.',
      accion: p.vistas > 10 && p.vendidas === 0 ? 'Probá un descuento chico o una foto mejor.' : 'Publicalo con foto y precio bien visibles.',
    })),
    oferta: objetivo === 'liquidar' || objetivo === 'sin-ventas' ? 'Podés probar un 10% de descuento por pocos días (cargalo como "precio antes" en el producto).' : 'Podés ofrecer envío gratis o un regalo chico por compras de esta semana.',
    dias: Array.from({ length: dias }, (_, i) => ({
      dia: i + 1,
      red: redes[i % redes.length],
      hora: i % 2 ? '12:30' : '19:30',
      idea: i === dias - 1 && fecha ? `¡Último día antes de ${fecha.nombre}! Recordá que pagan con QR y les llega a casa.` : `Mostrá ${elegidos[i % Math.max(1, elegidos.length)]?.nombre || 'tu producto'} con su precio y el link.`,
      productoIds: elegidos.length ? [elegidos[i % elegidos.length].id] : [],
      tono: i === dias - 1 ? 'oferta' : 'cercano',
    })),
    consejos: ['Respondé rápido los mensajes: la mayoría compra al que contesta primero.', 'Usá fotos claras con buena luz y fondo limpio.', 'Compartí en 2 o 3 grupos de compra-venta de tu ciudad, no en todos el mismo día.'],
  }
}

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Deja solo lo válido de la respuesta de la IA (ids reales, redes y tonos conocidos).
function validar(ia: any, ids: Set<string>, dias: number) {
  if (!ia || typeof ia !== 'object') return null
  const productos = (Array.isArray(ia.productos) ? ia.productos : [])
    .filter((p: any) => ids.has(String(p?.id)))
    .slice(0, 5)
    .map((p: any) => ({ id: String(p.id), porque: texto(p.porque, 300), accion: texto(p.accion, 300) }))
  const plan = (Array.isArray(ia.dias) ? ia.dias : [])
    .slice(0, dias)
    .map((d: any, i: number) => ({
      dia: i + 1,
      red: REDES.includes(d?.red) ? d.red : 'whatsapp',
      hora: /^\d{1,2}:\d{2}$/.test(String(d?.hora)) ? String(d.hora) : '19:30',
      idea: texto(d?.idea, 400),
      productoIds: (Array.isArray(d?.productoIds) ? d.productoIds : []).map(String).filter((x: string) => ids.has(x)).slice(0, 3),
      tono: TONOS.includes(d?.tono) ? d.tono : 'cercano',
    }))
    .filter((d: any) => d.idea)
  if (!productos.length || !plan.length) return null
  return {
    titulo: texto(ia.titulo, 70) || 'Tu estrategia',
    resumen: texto(ia.resumen, 600),
    productos,
    oferta: texto(ia.oferta, 500),
    dias: plan,
    consejos: (Array.isArray(ia.consejos) ? ia.consejos : []).map((c: unknown) => texto(c, 300)).filter(Boolean).slice(0, 5),
  }
}

export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const c = await contexto(usuario.uid)
    const ref = c.db.collection('estrategiasMarketing').doc(usuario.uid)

    if (body.accion === 'hecho') {
      const ultima = c.guardado.ultima as Estrategia | undefined
      if (!ultima) return NextResponse.json({ error: 'No hay estrategia.' }, { status: 404 })
      const dias = ultima.dias.map((d) => (d.dia === Number(body.dia) ? { ...d, hecho: !!body.hecho } : d))
      await ref.set({ ultima: { ...ultima, dias } }, { merge: true })
      return NextResponse.json({ ok: true })
    }

    const objetivo = (OBJETIVOS_ESTRATEGIA.some((o) => o.id === body.objetivo) ? body.objetivo : 'mas-vistos') as ObjetivoEstrategia
    const fecha = objetivo === 'fecha' ? c.fechas.find((f) => f.id === body.fechaId) || null : null
    if (objetivo === 'fecha' && !fecha) return NextResponse.json({ error: 'Elegí una fecha.' }, { status: 400 })
    const pedido = texto(body.pedido, 400)
    if (objetivo === 'libre' && pedido.length < 5) return NextResponse.json({ error: 'Contanos qué querés lograr.' }, { status: 400 })
    if (!c.puedeGenerar) {
      return NextResponse.json({ error: 'Ya usaste tu estrategia gratis de esta semana.', proximaGratis: c.proximaGratis }, { status: 429 })
    }

    const productos = await productosConNumeros(c.db, usuario.uid, c.hoy)
    if (!productos.length) return NextResponse.json({ error: 'Primero publicá algún producto.' }, { status: 400 })
    const lista = candidatos(productos, objetivo)
    // Para una fecha: los 7 días anteriores (si falta más, el plan arranca
    // una semana antes; si falta menos, desde hoy hasta el día anterior).
    const dias = fecha ? Math.max(1, Math.min(7, fecha.faltan)) : 7
    const inicio = fecha && fecha.faltan > 7 ? sumarDias(fecha.fecha, -7) : c.hoy
    const ciudad = buscarCiudad(c.ciudad)
    const moneda = ciudad.pais === 'AR' ? '$' : 'Bs'

    const objetivoTexto =
      objetivo === 'fecha' && fecha ? `Campaña para ${fecha.nombre} (${fecha.fecha}, faltan ${fecha.faltan} días). Suele venderse: ${fecha.idea}. Elegí los productos que sirvan como regalo o encajen con la fecha; si ninguno encaja bien, decilo y proponé cómo presentarlos igual.`
      : objetivo === 'libre' ? `Lo que quiere el vendedor: "${pedido}"`
      : `${OBJETIVOS_ESTRATEGIA.find((o) => o.id === objetivo)!.label}: ${OBJETIVOS_ESTRATEGIA.find((o) => o.id === objetivo)!.ayuda}`
    const datos = [
      `Tienda: ${c.vendedor.nombreNegocio || 'sin nombre'} en ${ciudad.nombre} (${ciudad.pais === 'AR' ? 'Argentina' : 'Bolivia'}). Hoy: ${c.hoy}. El plan empieza el ${inicio}.`,
      `Objetivo: ${objetivoTexto}`,
      ...(pedido && objetivo !== 'libre' ? [`Además el vendedor pide: "${pedido}"`] : []),
      `Plan de ${dias} día(s). Productos (id | nombre | precio | precio antes | stock | categoría | vistas 30d | al carrito 30d | vendidas 30d):`,
      ...lista.map((p) => [p.id, p.nombre, `${moneda} ${p.precio}`, p.precioOriginal ? `${moneda} ${p.precioOriginal}` : '-', p.stock ?? '-', p.categoria || '-', p.vistas, p.carrito, p.vendidas].join(' | ')),
    ].join('\n')

    const ids = new Set(lista.map((p) => p.id))
    const deIA = validar(await estrategiaMarketingIA(datos, dias, c.ciudad), ids, dias)
    const plan = deIA || planBase(lista, objetivo, dias, fecha)
    const ahora = new Date().toISOString()
    const estrategia: Estrategia = {
      objetivo,
      fechaEspecial: fecha ? { id: fecha.id, nombre: fecha.nombre, emoji: fecha.emoji, fecha: fecha.fecha } : null,
      ...(pedido ? { pedido } : {}),
      ...plan,
      dias: plan.dias.map((d: any): DiaEstrategia => ({ ...d, fecha: sumarDias(inicio, d.dia - 1) })),
      conIA: !!deIA,
      creadaAt: ahora,
    }
    await ref.set({ ultima: estrategia, ...(deIA ? { ultimaIAAt: ahora } : {}), updatedAt: ahora }, { merge: true })
    const proximaGratis = deIA && !c.premium ? new Date(Date.now() + DIAS_ENTRE_ESTRATEGIAS_GRATIS * 86400_000).toISOString() : c.puedeGenerar ? null : c.proximaGratis
    return NextResponse.json({ estrategia, puedeGenerar: c.premium || !deIA, proximaGratis: c.premium ? null : proximaGratis })
  } catch (err) {
    console.error('POST /api/marketing/estrategia', err)
    return NextResponse.json({ error: 'No se pudo armar la estrategia.' }, { status: 500 })
  }
}
