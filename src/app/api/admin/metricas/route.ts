import { NextRequest, NextResponse } from 'next/server'
import { getDb, contarUsuarios } from '@/lib/firebaseAdmin'
import { construirSerieDiaria, reagruparPor, agruparPorDiaSemana, compararSemanas, ultimosDiasContinuos } from '@/lib/serieTiempo'

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

    const [usuariosTotal, productosSnap, profesionalesSnap, pedidosSnap, categoriasSnap, metricasDiariasSnap] = await Promise.all([
      contarUsuarios().catch(() => null), // null si Firebase Auth no está accesible por algún motivo
      db.collection('productos').get(),
      db.collection('profesionales').get(),
      db.collection('pedidos').get(),
      db.collection('analitica_categorias').get(),
      db.collection('metricas_diarias').get(),
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
