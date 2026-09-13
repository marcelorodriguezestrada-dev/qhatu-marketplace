'use client'

import { ZONAS_POTOSI, ZonaPotosi } from '@/data/zonasPotosi'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

// Mapa esquemático (no un mapa real con calles) — ubica cada zona según
// su latitud/longitud real, proyectada a un rectángulo simple. No hace
// falta ninguna librería de mapas ni API key para esto: alcanza con
// convertir lat/lng a un x/y relativo dentro del SVG.
export function MapaZonasPotosi({ zonaSeleccionada }: { zonaSeleccionada?: string }) {
  const lats = ZONAS_POTOSI.map((z) => z.lat)
  const lngs = ZONAS_POTOSI.map((z) => z.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const ANCHO = 320
  const ALTO = 220
  const MARGEN = 26

  function proyectar(z: ZonaPotosi) {
    // La latitud crece hacia el norte pero la coordenada Y de pantalla
    // crece hacia abajo — por eso se invierte acá.
    const x = MARGEN + ((z.lng - minLng) / (maxLng - minLng || 1)) * (ANCHO - MARGEN * 2)
    const y = MARGEN + (1 - (z.lat - minLat) / (maxLat - minLat || 1)) * (ALTO - MARGEN * 2)
    return { x, y }
  }

  function colorPorPrecio(costo: number) {
    if (costo <= 5) return '#1a7f6e' // teal — barato/cerca
    if (costo <= 10) return '#c17f2b' // ocre — medio
    return '#7A2E2E' // maroon — caro/lejos
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-3">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto" role="img" aria-label="Mapa de zonas de reparto en Potosí">
        {ZONAS_POTOSI.map((z) => {
          const { x, y } = proyectar(z)
          const esSeleccionada = z.nombre === zonaSeleccionada
          return (
            <g key={z.nombre}>
              <circle
                cx={x}
                cy={y}
                r={esSeleccionada ? 7 : 4.5}
                fill={colorPorPrecio(z.costoEnvio)}
                stroke={esSeleccionada ? '#2B211D' : 'none'}
                strokeWidth={esSeleccionada ? 1.5 : 0}
              />
              {esSeleccionada && (
                <text x={x} y={y - 11} textAnchor="middle" fontSize="9" fontWeight="700" fill="#2B211D">
                  {z.nombre.length > 22 ? z.nombre.slice(0, 20) + '…' : z.nombre}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 justify-center mt-1 font-body text-[10px] text-inksoft">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1a7f6e' }} />{bs(5)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#c17f2b' }} />{bs(10)}</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#7A2E2E' }} />{bs(15)}</div>
      </div>
    </div>
  )
}
