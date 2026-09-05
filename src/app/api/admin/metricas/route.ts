import { NextRequest, NextResponse } from 'next/server'
import { getDb, contarUsuarios } from '@/lib/firebaseAdmin'

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

    const [usuariosTotal, productosSnap, profesionalesSnap, pedidosSnap] = await Promise.all([
      contarUsuarios().catch(() => null), // null si Firebase Auth no está accesible por algún motivo
      db.collection('productos').get(),
      db.collection('profesionales').get(),
      db.collection('pedidos').get(),
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

    const productosMasVistos = [...productos]
      .filter((p) => (p.vistas || 0) > 0)
      .sort((a, b) => (b.vistas || 0) - (a.vistas || 0))
      .slice(0, 5)
      .map((p) => ({ id: p.id, nombre: p.nombre, vistas: p.vistas || 0 }))

    return NextResponse.json({
      usuariosTotal,
      productos: { total: productos.length, porEstado: productosPorEstado, premium: productosPremium },
      profesionales: { total: profesionales.length, porEstado: profesionalesPorEstado, totalResenas },
      pedidos: { total: pedidos.length, porEstado: pedidosPorEstado, totalFacturado },
      productosMasVistos,
    })
  } catch (err) {
    console.error('GET /api/admin/metricas', err)
    return NextResponse.json({ error: 'No se pudieron cargar las métricas.' }, { status: 500 })
  }
}
