import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { diaBolivia } from '@/lib/fechaBolivia'
import { esPremiumVigente } from '@/lib/planPremium'
import { leerDiasUsuario } from '@/lib/estadisticasUsuario'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { paisDeCiudad } from '@/lib/mercado'
import { ciudadDe } from '@/data/ciudades'
import {
  PERIODOS_ESTADISTICAS, PERIODO_GRATIS,
  type CampoEstadistica, type ItemEstadistica, type PuntoEstadistica, type RespuestaEstadisticas,
  type ResumenEstadistica, type SeccionEstadisticas, type TipoItemEstadistica,
} from '@/lib/estadisticas'

export const dynamic = 'force-dynamic'

// GET /api/mis-estadisticas?dias=7|30|90 — las estadísticas del usuario
// logueado: sus productos (como vendedor), sus servicios (perfil de
// profesional) y sus anuncios. Sin Premium: solo los totales de los
// últimos 7 días (y el total de vistas de cada uno). Con Premium: el
// período que elija, el día a día y el detalle por producto.
const ESTADOS_SIN_VENTA = new Set(['cancelado', 'rechazado'])

function restarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

function resumenVacio(): ResumenEstadistica {
  return { vistas: 0, contactos: 0, carrito: 0, pedidos: 0, unidades: 0, vendido: 0 }
}

export async function GET(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 })

  try {
    const db = getDb()
    await cargarCiudadesServidor().catch(() => null)
    const [vendedorDoc, productosSnap, profesionalesSnap, anunciosSnap] = await Promise.all([
      db.collection('vendedores').doc(usuario.uid).get(),
      db.collection('productos').where('vendedorId', '==', usuario.uid).get(),
      db.collection('profesionales').where('solicitanteUid', '==', usuario.uid).get(),
      db.collection('anuncios').where('autorUid', '==', usuario.uid).get(),
    ])
    const vendedor = (vendedorDoc.data() || {}) as any
    const productos = productosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    const profesionales = profesionalesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    const anuncios = anunciosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))

    const premiumVendedor = esPremiumVigente(vendedor)
    const premiumProfesional = profesionales.some((p) => esPremiumVigente(p))
    const algunPremium = premiumVendedor || premiumProfesional

    const pedido = Number(req.nextUrl.searchParams.get('dias')) || PERIODO_GRATIS
    const diasPedidos = (PERIODOS_ESTADISTICAS as readonly number[]).includes(pedido) ? pedido : PERIODO_GRATIS
    // El período más largo es para Premium (de cualquiera de los dos planes).
    const dias = algunPremium ? diasPedidos : PERIODO_GRATIS
    const hasta = diaBolivia()
    const desde = restarDias(hasta, dias - 1)
    const fechas = Array.from({ length: dias }, (_, i) => restarDias(hasta, dias - 1 - i))

    const diasGuardados = await leerDiasUsuario(usuario.uid, desde)

    // Suma por ítem y por día de un tipo (p / s / a).
    function contadores(tipo: TipoItemEstadistica) {
      const porItem = new Map<string, Record<CampoEstadistica, number>>()
      const porDia = new Map<string, Record<CampoEstadistica, number>>()
      for (const d of diasGuardados) {
        if (d.fecha > hasta) continue
        for (const [clave, valores] of Object.entries(d.items)) {
          if (!clave.startsWith(`${tipo}_`)) continue
          const id = clave.slice(2)
          const item = porItem.get(id) || { vistas: 0, contactos: 0, carrito: 0 }
          const dia = porDia.get(d.fecha) || { vistas: 0, contactos: 0, carrito: 0 }
          for (const campo of ['vistas', 'contactos', 'carrito'] as const) {
            const n = Number(valores?.[campo] || 0)
            item[campo] += n
            dia[campo] += n
          }
          porItem.set(id, item)
          porDia.set(d.fecha, dia)
        }
      }
      return { porItem, porDia }
    }

    function armarSeccion(
      tipo: TipoItemEstadistica,
      premium: boolean,
      base: ItemEstadistica[],
      ventas?: { porItem: Map<string, { unidades: number; vendido: number }>; porDia: Map<string, number>; pedidos: number }
    ): SeccionEstadisticas {
      const { porItem, porDia } = contadores(tipo)
      const resumen = resumenVacio()
      for (const v of porItem.values()) {
        resumen.vistas += v.vistas
        resumen.contactos += v.contactos
        resumen.carrito += v.carrito
      }
      if (ventas) {
        resumen.pedidos = ventas.pedidos
        for (const v of ventas.porItem.values()) {
          resumen.unidades += v.unidades
          resumen.vendido += v.vendido
        }
      }
      const items = base.map((it) => {
        if (!premium) return it
        const c = porItem.get(it.id)
        const v = ventas?.porItem.get(it.id)
        return {
          ...it,
          vistas: c?.vistas || 0,
          contactos: c?.contactos || 0,
          carrito: c?.carrito || 0,
          ...(ventas ? { unidades: v?.unidades || 0, vendido: Math.round((v?.vendido || 0) * 100) / 100 } : {}),
        }
      })
      items.sort((a, b) => (b.vistas ?? b.vistasTotal) - (a.vistas ?? a.vistasTotal) || b.vistasTotal - a.vistasTotal)
      const seccion: SeccionEstadisticas = { premium, resumen: { ...resumen, vendido: Math.round(resumen.vendido * 100) / 100 }, items }
      if (premium) {
        seccion.serie = fechas.map((fecha): PuntoEstadistica => {
          const c = porDia.get(fecha)
          return { fecha, vistas: c?.vistas || 0, contactos: c?.contactos || 0, carrito: c?.carrito || 0, pedidos: ventas?.porDia.get(fecha) || 0 }
        })
      }
      return seccion
    }

    const respuesta: RespuestaEstadisticas = {
      dias,
      desde,
      hasta,
      pais: paisDeCiudad(ciudadDe(vendedor.ciudad ? vendedor : productos[0] || profesionales[0] || {})).id,
    }

    if (productos.length) {
      // Ventas: pedidos de su tienda en el período (sin cancelados ni pruebas).
      const pedidosSnap = await db.collection('pedidos').where('vendedorId', '==', usuario.uid).get()
      const ids = new Set(productos.map((p) => p.id))
      const ventas = { porItem: new Map<string, { unidades: number; vendido: number }>(), porDia: new Map<string, number>(), pedidos: 0 }
      for (const doc of pedidosSnap.docs) {
        const p = doc.data() as any
        if (!p.createdAt || p.esPrueba || ESTADOS_SIN_VENTA.has(p.estado)) continue
        const fecha = diaBolivia(p.createdAt)
        if (fecha < desde || fecha > hasta) continue
        ventas.pedidos += 1
        ventas.porDia.set(fecha, (ventas.porDia.get(fecha) || 0) + 1)
        for (const item of Array.isArray(p.items) ? p.items : []) {
          const id = String(item?.id || '')
          if (!ids.has(id)) continue
          const v = ventas.porItem.get(id) || { unidades: 0, vendido: 0 }
          const cantidad = Number(item.cantidad) || 0
          v.unidades += cantidad
          v.vendido += cantidad * (Number(item.precio) || 0)
          ventas.porItem.set(id, v)
        }
      }
      respuesta.productos = armarSeccion(
        'p',
        premiumVendedor,
        productos.map((p) => ({
          id: p.id,
          nombre: p.nombre || 'Producto',
          imagen: p.thumbUrl || p.imagenUrl || '',
          href: `/producto/${p.id}`,
          estado: p.estado,
          vistasTotal: Number(p.vistas || 0),
        })),
        ventas
      )
    }

    if (profesionales.length) {
      respuesta.servicios = armarSeccion(
        's',
        premiumProfesional,
        profesionales.map((p) => ({
          id: p.id,
          nombre: p.nombre || 'Mi perfil',
          imagen: p.imagenUrl || '',
          href: `/servicios/${p.id}`,
          estado: p.estado,
          vistasTotal: Number(p.vistas || 0),
          contactosTotal: Number(p.clicsWhatsapp || 0),
        }))
      )
    }

    if (anuncios.length) {
      respuesta.anuncios = armarSeccion(
        'a',
        algunPremium,
        anuncios.map((a) => ({
          id: a.id,
          nombre: a.titulo || 'Anuncio',
          imagen: a.imagenUrl || '',
          href: `/anuncios/${a.id}`,
          estado: a.estado,
          vistasTotal: Number(a.vistas || 0),
        }))
      )
    }

    return NextResponse.json(respuesta)
  } catch (err) {
    console.error('GET /api/mis-estadisticas', err)
    return NextResponse.json({ error: 'No se pudieron cargar tus estadísticas.' }, { status: 500 })
  }
}
