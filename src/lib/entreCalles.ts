// "Entre calles" del checkout: con el punto de la casa (dirección, GPS o
// mapa) y las calles de OpenStreetMap de alrededor, sabemos en qué calle
// está y cuáles son las dos esquinas de esa cuadra. Sirve para:
// - sugerirle al comprador "Entre Bolívar y Chayanta" (un toque);
// - avisarle si las que escribió no cruzan su calle cerca de su casa.
// La consulta a OSM (Overpass) vive en /api/entre-calles; acá está la
// lógica pura (para poder probarla sin red).

export type CalleOSM = { nombre: string; puntos: { lat: number; lon: number }[] }
export type EntreCallesInfo = {
  // Calle de la casa según el mapa.
  calle: string | null
  // Las dos esquinas de la cuadra (la más cercana a cada lado).
  sugeridas: string[]
  // Esquinas de su cuadra según el mapa (lo escrito tiene que ser una de estas).
  cruces: string[]
  // Calles con nombre a ≤ 300 m (sin la de la casa), de la más cercana a la más lejana.
  cercanas: string[]
}

const PREFIJOS = /^(calle|c\/|c\.|avenida|av\.?|avda\.?|pasaje|pje\.?|psje\.?|jiron|jr\.?|plaza|plazuela)\s+/

export function normCalle(t: string) {
  let s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[#º°]/g, ' ')
  s = s.replace(/\b(s\/n|sn|nro\.?|n\.?)\b/g, ' ').replace(/\d+/g, ' ').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 2; i++) s = s.replace(PREFIJOS, '')
  return s.trim()
}

function distLev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e'])
const palabras = (t: string) => normCalle(t).split(' ').filter((w) => w.length >= 3 && !VACIAS.has(w))

// ¿Lo escrito ("bolivar", "Av. Villazón", "gumiel") es esta calle de OSM?
export function mismaCalle(escrita: string, osm: string): boolean {
  const a = normCalle(escrita)
  const b = normCalle(osm)
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 4 && (b.includes(a) || a.includes(b))) return true
  const tol = (n: number) => (n >= 8 ? 2 : n >= 5 ? 1 : 0)
  if (distLev(a, b) <= tol(Math.min(a.length, b.length))) return true
  // Por una palabra fuerte: "gumiel" ↔ "Fortunato Gumiel", "sucre" ↔ "Antonio José de Sucre".
  const pa = palabras(a)
  const pb = palabras(b)
  const igual = (w: string, x: string) => x === w || (w.length >= 5 && distLev(w, x) <= tol(w.length))
  if (pa.length > 0 && pa.every((w) => w.length >= 4 && pb.some((x) => igual(w, x)))) return true
  // Al revés, para nombres abreviados en el mapa: "Victor Flores" ↔ "V. Flores".
  return pb.length > 0 && pb.every((w) => w.length >= 5 && pa.some((x) => igual(w, x)))
}

// "Bolívar y Chayanta", "bolivar / chayanta", "entre bolivar e hoyos", "esq. Sucre"
export function separarEntreCalles(texto: string): string[] {
  return String(texto || '')
    .replace(/^\s*entre\s+/i, '')
    .split(/\s+y\s+|\s+e\s+|\s*[,/;&]\s*|\s+-\s+|\besq(?:uina)?\.?\s*/i)
    .map((x) => x.trim())
    .filter((x) => normCalle(x).length >= 3)
}

// "Calle Bolívar" → "Bolívar" (para mostrar); las avenidas quedan con "Av.".
export const sinCalle = (n: string) => n.replace(/^calle\s+/i, '').replace(/^avenida\s+/i, 'Av. ')

// Distancias en metros sobre un plano local (alcanza para unos cientos de metros).
function plano(lat0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110540
  return (p: { lat: number; lon: number }, o: { lat: number; lon: number }) => ({ x: (p.lon - o.lon) * kx, y: (p.lat - o.lat) * ky })
}

export function analizarEntreCalles(calles: CalleOSM[], punto: { lat: number; lng: number }, calleEscrita: string): EntreCallesInfo {
  const o = { lat: punto.lat, lon: punto.lng }
  const xy = plano(punto.lat)
  const conNombre = calles.filter((c) => c.nombre && c.puntos.length >= 2)
  const cercanas = Array.from(new Set(conNombre.map((c) => c.nombre)))
  if (!conNombre.length) return { calle: null, sugeridas: [], cruces: [], cercanas }

  // Distancia del punto a una calle y el tramo más cercano.
  const masCerca = (c: CalleOSM) => {
    let mejor = { d: Infinity, ux: 0, uy: 0 }
    for (let i = 0; i < c.puntos.length - 1; i++) {
      const a = xy(c.puntos[i], o)
      const b = xy(c.puntos[i + 1], o)
      const vx = b.x - a.x
      const vy = b.y - a.y
      const largo2 = vx * vx + vy * vy || 1
      const t = Math.max(0, Math.min(1, -(a.x * vx + a.y * vy) / largo2))
      const px = a.x + t * vx
      const py = a.y + t * vy
      const d = Math.hypot(px, py)
      if (d < mejor.d) { const l = Math.sqrt(largo2); mejor = { d, ux: vx / l, uy: vy / l } }
    }
    return mejor
  }

  // La calle de la casa: la escrita (si está cerca, ≤ 250 m) o la más cercana al punto.
  const medidas = conNombre.map((c) => ({ c, ...masCerca(c) }))
  // Calles con nombre a ≤ 300 m de la casa, de la más cercana a la más lejana
  // (cruces y paralelas: la gente dice "entre calles" de las dos formas).
  const cercanasOrdenadas = Array.from(new Set([...medidas].filter((m) => m.d <= 300).sort((a, b) => a.d - b.d).map((m) => m.c.nombre)))
  const escritas = medidas.filter((m) => calleEscrita && mismaCalle(calleEscrita, m.c.nombre) && m.d <= 250)
  const base = (escritas.length ? escritas : medidas).sort((a, b) => a.d - b.d)[0]
  const nombreCalle = base.c.nombre
  const tramos = conNombre.filter((c) => c.nombre === nombreCalle)
  const clave = (p: { lat: number; lon: number }) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`
  const nodosCalle = new Set(tramos.flatMap((c) => c.puntos.map(clave)))

  // Esquinas: puntos que la calle comparte con otra calle (mismo nodo de OSM).
  const esquinas: { nombre: string; d: number; lado: number }[] = []
  for (const c of conNombre) {
    if (c.nombre === nombreCalle || mismaCalle(c.nombre, nombreCalle)) continue
    for (const p of c.puntos) {
      if (!nodosCalle.has(clave(p))) continue
      const v = xy(p, o)
      const lado = v.x * base.ux + v.y * base.uy // + adelante / − atrás sobre la calle
      esquinas.push({ nombre: c.nombre, d: Math.hypot(v.x, v.y), lado })
    }
  }
  // Por lado (adelante / atrás sobre la calle), de la más cercana a la más lejana.
  const lado = (signo: 1 | -1) => esquinas.filter((e) => (signo > 0 ? e.lado > 0 : e.lado <= 0) && e.d <= 300).sort((a, b) => Math.abs(a.lado) - Math.abs(b.lado))
  const adelante = lado(1)
  const atras = lado(-1)
  // Se acepta la esquina más cercana de cada lado; y la siguiente solo si la
  // casa está casi en la esquina (el GPS puede correrse unos metros).
  const aceptadas = (l: typeof esquinas) => {
    const nombres = Array.from(new Set(l.map((e) => e.nombre)))
    return l.length && Math.abs(l[0].lado) < 35 ? nombres.slice(0, 2) : nombres.slice(0, 1)
  }
  const cruces = Array.from(new Set([...aceptadas(atras), ...aceptadas(adelante)]))
  const sugeridas = [atras[0], adelante[0]].filter((e): e is NonNullable<typeof e> => !!e).map((e) => sinCalle(e.nombre))
  return { calle: nombreCalle, sugeridas: Array.from(new Set(sugeridas)), cruces, cercanas: cercanasOrdenadas.filter((n) => n !== nombreCalle && !mismaCalle(n, nombreCalle)) }
}

// ¿Lo escrito en "Entre calles" cuadra con el mapa? null = bien o no se
// puede saber; si no, las calles escritas que no aparecen cerca de la casa
// (ni como esquina ni como paralela a ≤ 300 m). No se exige que sean las
// esquinas exactas: el punto puede correrse y el mapa no siempre está completo.
export function entreCallesNoCoinciden(texto: string, info: EntreCallesInfo | null): string[] | null {
  if (!info || !info.calle || (!info.cruces.length && !info.cercanas.length)) return null
  const escritas = separarEntreCalles(texto)
  if (!escritas.length) return null
  const validas = [...info.cruces, ...info.cercanas]
  const malas = escritas.filter((e) => !validas.some((c) => mismaCalle(e, c)) && !mismaCalle(e, info.calle!))
  return malas.length ? malas : null
}
