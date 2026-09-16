// Mercados conocidos de la ciudad de Potosí, con su ubicación real —
// para que un vendedor que tiene un puesto ADENTRO de uno de estos
// mercados (muy común acá) no dependa de que el GPS del celular acierte
// justo el punto exacto dentro de un edificio grande y con mala señal.
// Si escribe el nombre del mercado, se lo reconoce y se usa esta
// coordenada ya confirmada en vez de tener que compartir ubicación.
export type MercadoPotosi = {
  nombre: string
  // Otras formas en que la gente lo nombra/escribe, para que el
  // reconocimiento no dependa de tipear el nombre exacto.
  alias: string[]
  lat: number
  lng: number
}

export const MERCADOS_POTOSI: MercadoPotosi[] = [
  { nombre: 'Mercado Central', alias: ['mercado central', 'central'], lat: -19.587539, lng: -65.755032 },
  { nombre: 'Mercado Gremial', alias: ['mercado gremial', 'gremial', 'gremiales'], lat: -19.587465, lng: -65.754765 },
  { nombre: 'Mercado Artesanal', alias: ['mercado artesanal', 'artesanal', 'artesanías'], lat: -19.585143, lng: -65.752096 },
  { nombre: 'Mercado Chino (Barrio Chino)', alias: ['mercado chino', 'barrio chino', 'chino'], lat: -19.582968, lng: -65.751308 },
  { nombre: 'Mercado Campesino', alias: ['mercado campesino', 'campesino'], lat: -19.590555, lng: -65.744698 },
  { nombre: 'Mercado Uyuni', alias: ['mercado uyuni', 'uyuni'], lat: -19.578339, lng: -65.753006 },
]

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca tildes, para que "gremial" matchee con "grémial" o como sea que lo escriban
    .trim()
}

// Reconoce mercados a partir de lo que el vendedor va escribiendo —
// alcanza con las primeras palabras ("mercado gre..."), no hace falta
// el nombre completo ni exacto. Si escribe solo "mercado" a secas,
// coincide con todos (útil para ver la lista completa de opciones).
export function buscarMercados(texto: string): MercadoPotosi[] {
  const q = normalizar(texto)
  if (!q) return []
  return MERCADOS_POTOSI.filter(
    (m) => normalizar(m.nombre).includes(q) || m.alias.some((a) => normalizar(a).includes(q) || q.includes(normalizar(a)))
  )
}
