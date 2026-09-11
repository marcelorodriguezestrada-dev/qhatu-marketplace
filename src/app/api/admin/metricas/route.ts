import { NextRequest, NextResponse } from 'next/server'
import { getDb, contarUsuarios } from '@/lib/firebaseAdmin'
import { construirSerieDiaria, reagruparPor, agruparPorDiaSemana, compararSemanas, ultimosDiasContinuos } from '@/lib/serieTiempo'
import { esPremiumVigente, PRECIO_PREMIUM_BS } from '@/lib/planPremium'

export const dynamic = 'force-dynamic'

// Todas las métricas de acá salen de datos reales ya existentes en
// Firestore/Firebase Auth — no hay ningún número inventado ni
// estimado. Si un dato no se puede calcular de forma honesta (por
// ejemplo, "usuarios activos esta semana", que necesitaría trackear
// sesiones y no lo hacemos), directamente no se muestra.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })
  }

  try {
    const db = getDb()

    const [usuariosTotal, productosSnap, profesionalesSnap, pedidosSnap, categoriasSnap, metricasDiariasSnap, pagosPremiumSnap] = await Promise.all([
      contarUsuarios().catch(() => null), // null si Firebase Auth no está accesible por algún motivo
      db.collection('productos').get(),
      db.collection('profesionales').get(),
      db.collection('pedidos').get(),
      db.collection('analitica_categorias').get(),
      db.collection('metricas_diarias').get(),
      db.collection('pagos_premium').get(),
    ])

    const productos = productosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const profesionales = profesionalesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
    const pedidos = pedidosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

    const productosPorEstado = {
      activo: productos.filter((p) => !p.estado || p.estado === 'activo').length,
      pendiente: productos.filter((p) => p.estado === 'pendiente').length,
      rechazado: productos.filter((p) => p.estado === 'rechazado').length,
      oculto: productos.filter((p) => p.estado === 'oculto').length,
    }
    const productosPremium = productos.filter((p) => p.plan === 'premium').length

    const profesionalesPorEstado = {
      aprobado: profesionales.filter((p) => !p.estado || p.estado === 'aprobado').length,
      pendiente_revision: profesionales.filter((p) => p.estado === 'pendiente_revision').length,
      rechazado: profesionales.filter((p) => p.estado === 'rechazado').length,
    }

    const pedidosPorEstado: Record<string, number> = {}
    let totalFacturado = 0
    for (const p of pedidos) {
      const estado = p.estado || 'desconocido'
      pedidosPorEstado[estado] = (pedidosPorEstado[estado] || 0) + 1
      if (['pagado', 'en_preparacion', 'en_entrega', 'entregado'].includes(estado)) {
        totalFacturado += Number(p.total) || 0
      }
    }

    const totalResenas = profesionales.reduce((s, p) => s + (p.cantidadResenas || 0), 0)
    const totalVistasProfesionales = profesionales.reduce((s, p) => s + (p.vistas || 0), 0)
    const totalClicsWhatsapp = profesionales.reduce((s, p) => s + (p.clicsWhatsapp || 0), 0)

    // ── Flujo de caja (Premium de profesionales — es el único ingreso
    // real y verificado que recibe la plataforma; los pedidos del
    // marketplace se cobran directo al vendedor por su propio QR, no
    // pasan por acá). "pagos_premium" es el registro de cada vez que
    // el admin confirmó un pago; se empezó a llevar recién, así que el
    // histórico solo cuenta desde que se activó esto.
    const pagosPremium = pagosPremiumSnap.docs.map((d) => d.data() as any)
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)
    const pagosPremiumEsteMes = pagosPremium.filter((p) => p.fecha && new Date(p.fecha) >= inicioMes)

    const premiumVigentes = profesionales.filter((p) => esPremiumVigente(p))
    const en7Dias = new Date()
    en7Dias.setDate(en7Dias.getDate() + 7)
    const premiumVenciendoPronto = premiumVigentes.filter(
      (p) => p.planVigenciaHasta && new Date(p.planVigenciaHasta) <= en7Dias
    )
    const premiumPagoPorConfirmar = profesionales.filter((p) => p.planEstadoPago === 'informado_pago')

    const flujoCaja = {
      pagosConfirmadosHistorico: pagosPremium.length,
      facturadoHistorico: pagosPremium.reduce((s, p) => s + (Number(p.monto) || 0), 0),
      pagosEsteMes: pagosPremiumEsteMes.length,
      facturadoEsteMes: pagosPremiumEsteMes.reduce((s, p) => s + (Number(p.monto) || 0), 0),
      premiumVigentesAhora: premiumVigentes.length,
      porConfirmar: premiumPagoPorConfirmar.length,
      venciendoEn7Dias: premiumVenciendoPronto.length,
      proyeccionProximos30Dias: premiumVigentes.length * PRECIO_PREMIUM_BS,
      precioPremiumBs: PRECIO_PREMIUM_BS,
    }

    const productosMasVistos = [...productos]
      .filter((p) => (p.vistas || 0) > 0)
      .sort((a, b) => (b.vistas || 0) - (a.vistas || 0))
      .slice(0, 5)
      .map((p) => ({ id: p.id, nombre: p.nombre, vistas: p.vistas || 0 }))

    const profesionalesMasClicWhatsapp = [...profesionales]
      .filter((p) => (p.clicsWhatsapp || 0) > 0)
      .sort((a, b) => (b.clicsWhatsapp || 0) - (a.clicsWhatsapp || 0))
      .slice(0, 5)
      .map((p) => ({ id: p.id, nombre: p.nombre, vistas: p.vistas || 0, clicsWhatsapp: p.clicsWhatsapp || 0 }))

    const categoriasMasBuscadas = categoriasSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (b.clics || 0) - (a.clics || 0))
      .slice(0, 8)
      .map((c) => ({ tipo: c.tipo, valor: c.valor, clics: c.clics || 0 }))

    // Línea de tiempo: día a día (últimos 90 días, para no mandar un
    // payload gigante si el sitio ya lleva años), reagrupada también
    // por mes, por año, y por día de la semana — para responder
    // "¿qué día se mueve más?" con toda la historia disponible, no
    // solo los últimos 90 días.
    const metricasDiariasDocs = metricasDiariasSnap.docs.map((d) => ({ id: d.id, data: d.data() }))
    const serieDiariaCompleta = construirSerieDiaria({
      metricasDiariasDocs,
      pedidos: pedidos.map((p) => ({ createdAt: p.createdAt, total: p.total })),
      productos: productos.map((p) => ({ createdAt: p.createdAt })),
      profesionales: profesionales.map((p) => ({ createdAt: p.createdAt })),
    })
    const serieDiaria = ultimosDiasContinuos(serieDiariaCompleta, 90)
    const serieMensual = reagruparPor(serieDiariaCompleta, 'mes')
    const serieAnual = reagruparPor(serieDiariaCompleta, 'anio')
    const porDiaSemana = agruparPorDiaSemana(serieDiariaCompleta)
    const comparativaSemanal = compararSemanas(serieDiariaCompleta)

    return NextResponse.json({
      usuariosTotal,
      productos: { total: productos.length, porEstado: productosPorEstado, premium: productosPremium },
      profesionales: {
        total: profesionales.length,
        porEstado: profesionalesPorEstado,
        totalResenas,
        totalVistas: totalVistasProfesionales,
        totalClicsWhatsapp,
      },
      pedidos: { total: pedidos.length, porEstado: pedidosPorEstado, totalFacturado },
      flujoCaja,
      productosMasVistos,
      profesionalesMasClicWhatsapp,
      categoriasMasBuscadas,
      serieDiaria,
      serieMensual,
      serieAnual,
      porDiaSemana,
      comparativaSemanal,
    })
  } catch (err) {
    console.error('GET /api/admin/metricas', err)
    return NextResponse.json({ error: 'No se pudieron cargar las métricas.' }, { status: 500 })
  }
}
