import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioDesdeRequest } from '@/lib/firebaseAdmin'
import { evaluarCupon } from '@/lib/cupones'
import { buscarCuponPorCodigo, yaUsoCupon } from '@/lib/cuponesServer'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'
import { sanearCiudad } from '@/data/ciudades'
import { paisDeCiudad } from '@/lib/mercado'

export const dynamic = 'force-dynamic'

// POST { codigo, subtotal, costoEnvio, extraExpress, metodoEntrega } —
// lo llama el checkout al tocar "Aplicar". Devuelve el descuento y las
// reglas del cupón para que el checkout recalcule solo si cambia el
// carrito o la zona. /api/pedidos vuelve a validar todo al comprar.
export async function POST(req: NextRequest) {
  const usuario = await getUsuarioDesdeRequest(req)
  if (!usuario) return NextResponse.json({ error: 'Iniciá sesión para usar un cupón.' }, { status: 401 })
  try {
    const body = await req.json()
    await cargarCiudadesServidor().catch(() => null)
    const pais = paisDeCiudad(sanearCiudad(body.ciudadCompra))
    const cupon = await buscarCuponPorCodigo(body.codigo)
    if (!cupon) return NextResponse.json({ error: 'Ese cupón no existe. Revisá que esté bien escrito.' }, { status: 404 })

    const resultado = evaluarCupon(cupon, {
      subtotal: Number(body.subtotal) || 0,
      pais: pais.id,
      costoEnvio: Number(body.costoEnvio) || 0,
      extraExpress: Number(body.extraExpress) || 0,
      metodoEntrega: body.metodoEntrega === 'retiro' ? 'retiro' : 'envio',
    })
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 })
    if (cupon.unaVezPorUsuario && (await yaUsoCupon(cupon.id, usuario.uid))) {
      return NextResponse.json({ error: 'Ya usaste este cupón en otra compra.' }, { status: 400 })
    }

    // Solo las reglas que el checkout necesita para recalcular.
    const { codigo, tipo, valor, descuentoMaximo, compraMinima, desde, hasta, limiteUsos, unaVezPorUsuario, incluyeExpress, activo, usosCount, campana, pais: paisCupon } = cupon
    return NextResponse.json({
      ...resultado,
      cupon: { id: cupon.id, codigo, tipo, valor, descuentoMaximo, compraMinima, desde, hasta, limiteUsos, unaVezPorUsuario, incluyeExpress, activo, usosCount, campana, pais: paisCupon || '' },
    })
  } catch (err) {
    console.error('POST /api/cupones/validar', err)
    return NextResponse.json({ error: 'No se pudo validar el cupón.' }, { status: 500 })
  }
}
