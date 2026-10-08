import { NextResponse } from 'next/server'
import { cargarCiudadesServidor } from '@/lib/ciudadesServer'

export const dynamic = 'force-dynamic'

// Ciudades (con su estado: abierta / en prueba / cerrada) y países. Las
// "en prueba" solo se le muestran a las cuentas de prueba (eso lo filtra
// el navegador: no son secretas). El admin las edita en
// /api/admin/ciudades (Admin → Inicio → Ciudades).
export async function GET() {
  const { ciudades, paises } = await cargarCiudadesServidor()
  return NextResponse.json(
    {
      ciudades: ciudades.map((c) => ({ ...c, activa: c.estado === 'abierta', prueba: c.estado === 'prueba' })),
      paises: paises.map((p) => ({ id: p.id, nombre: p.nombre, bandera: p.bandera, moneda: p.moneda, simboloMoneda: p.simboloMoneda, prefijoTel: p.prefijoTel, digitosTel: p.digitosTel, zonaHoraria: p.zonaHoraria })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600' } },
  )
}
