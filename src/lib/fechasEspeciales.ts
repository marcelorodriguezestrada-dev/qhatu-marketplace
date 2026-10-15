// Fechas especiales para campañas (Vender → Marketing → Estrategia con IA).
// Las fijas de cada país están acá; el admin puede sumar las suyas
// (aniversario de la ciudad, ferias...) en fechasMarketing/{id}, que se
// repiten todos los años.

export type FechaEspecial = {
  id: string
  nombre: string
  emoji: string
  // Qué suele venderse: la IA lo usa para elegir productos y armar la idea.
  idea: string
  fecha: string // YYYY-MM-DD (la próxima vez que cae)
  faltan: number // días desde hoy (0 = hoy)
}

// Una fecha de la lista: MM-DD fijo o calculada para un año.
type Regla = {
  id: string
  nombre: string
  emoji: string
  idea: string
  paises: string[] // [] = todos
  cuando: string | ((anio: number) => string) // 'MM-DD' o función → 'YYYY-MM-DD'
}

// Fecha del n-ésimo día de semana del mes (0 = domingo). n = -1 → el último.
function nEsimo(anio: number, mes: number, diaSemana: number, n: number) {
  if (n < 0) {
    const ult = new Date(Date.UTC(anio, mes, 0))
    ult.setUTCDate(ult.getUTCDate() - ((ult.getUTCDay() - diaSemana + 7) % 7))
    return ult.toISOString().slice(0, 10)
  }
  const d = new Date(Date.UTC(anio, mes - 1, 1))
  d.setUTCDate(1 + ((diaSemana - d.getUTCDay() + 7) % 7) + (n - 1) * 7)
  return d.toISOString().slice(0, 10)
}

// Domingo de Pascua (algoritmo de Gauss / anónimo gregoriano).
function pascua(anio: number) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}

const sumarDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000).toISOString().slice(0, 10)

const REGLAS: Regla[] = [
  { id: 'clases', nombre: 'Regreso a clases', emoji: '🎒', paises: ['BO'], cuando: '02-02', idea: 'mochilas, útiles, uniformes, zapatos escolares, loncheras, tecnología para estudiar' },
  { id: 'clases', nombre: 'Regreso a clases', emoji: '🎒', paises: ['AR'], cuando: '03-02', idea: 'mochilas, útiles, guardapolvos, zapatillas, loncheras, tecnología para estudiar' },
  { id: 'san-valentin', nombre: 'San Valentín', emoji: '💘', paises: [], cuando: '02-14', idea: 'regalos para la pareja: perfumes, joyas, ropa, flores, chocolates, accesorios, combos para dos' },
  { id: 'carnaval', nombre: 'Carnaval', emoji: '🎭', paises: [], cuando: (a) => sumarDias(pascua(a), -50), idea: 'ropa cómoda y para bailar, disfraces, accesorios, bebidas, impermeables, artículos de fiesta' },
  { id: 'dia-mujer', nombre: 'Día Internacional de la Mujer', emoji: '💐', paises: [], cuando: '03-08', idea: 'regalos para ellas: perfumes, maquillaje, accesorios, ropa, cuidado personal' },
  { id: 'dia-padre', nombre: 'Día del Padre', emoji: '👔', paises: ['BO'], cuando: '03-19', idea: 'regalos para papá: ropa, calzado, relojes, perfumes, herramientas, tecnología, deporte' },
  { id: 'dia-padre', nombre: 'Día del Padre', emoji: '👔', paises: ['AR'], cuando: (a) => nEsimo(a, 6, 0, 3), idea: 'regalos para papá: ropa, calzado, relojes, perfumes, herramientas, tecnología, deporte, asado' },
  { id: 'dia-nino', nombre: 'Día del Niño', emoji: '🧸', paises: ['BO'], cuando: '04-12', idea: 'juguetes, ropa y calzado infantil, juegos, golosinas, artículos escolares' },
  { id: 'dia-nino', nombre: 'Día de las Infancias', emoji: '🧸', paises: ['AR'], cuando: (a) => nEsimo(a, 8, 0, 3), idea: 'juguetes, ropa y calzado infantil, juegos, golosinas' },
  { id: 'dia-madre', nombre: 'Día de la Madre', emoji: '💐', paises: ['BO'], cuando: '05-27', idea: 'regalos para mamá: ropa, calzado, carteras, perfumes, joyas, electrodomésticos, artículos para la cocina y el hogar' },
  { id: 'dia-madre', nombre: 'Día de la Madre', emoji: '💐', paises: ['AR'], cuando: (a) => nEsimo(a, 10, 0, 3), idea: 'regalos para mamá: ropa, calzado, carteras, perfumes, joyas, electrodomésticos, artículos para la cocina y el hogar' },
  { id: 'dia-maestro', nombre: 'Día del Maestro', emoji: '🍎', paises: ['BO'], cuando: '06-06', idea: 'regalos para profes: tazas, agendas, accesorios, flores, detalles personalizados' },
  { id: 'primavera', nombre: 'Día del Estudiante y la Primavera', emoji: '🌸', paises: [], cuando: '09-21', idea: 'regalos de amistad y amor, ropa de temporada, accesorios, flores, salidas, artículos para estudiantes' },
  { id: 'mujer-boliviana', nombre: 'Día de la Mujer Boliviana', emoji: '🌺', paises: ['BO'], cuando: '10-11', idea: 'regalos para ellas: perfumes, maquillaje, accesorios, ropa, cuidado personal' },
  { id: 'todos-santos', nombre: 'Todos Santos', emoji: '🕯️', paises: ['BO'], cuando: '11-01', idea: 'masitas, t’antawawas, flores, velas, artículos para la mesa y el altar' },
  { id: 'black-friday', nombre: 'Black Friday', emoji: '🖤', paises: [], cuando: (a) => nEsimo(a, 11, 5, 4), idea: 'descuentos fuertes en lo más buscado: tecnología, ropa, calzado, hogar; combos y ofertas por 1–3 días' },
  { id: 'navidad', nombre: 'Navidad', emoji: '🎄', paises: [], cuando: '12-25', idea: 'regalos para toda la familia, juguetes, ropa, perfumes, tecnología, decoración navideña, canastones' },
  { id: 'fin-de-anio', nombre: 'Fin de Año', emoji: '🎆', paises: [], cuando: '12-31', idea: 'ropa para la fiesta (amarillo y rojo de cábala), accesorios, decoración, bebidas, artículos de fiesta' },
]

export type FechaAdmin = { id: string; nombre: string; emoji?: string; idea?: string; mmdd: string; ciudad?: string }

function enAnio(cuando: Regla['cuando'], anio: number) {
  return typeof cuando === 'function' ? cuando(anio) : `${anio}-${cuando}`
}

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400_000)

// Las que caen entre hoy y los próximos `dias` días, para el país / ciudad
// de la tienda. `hoy` en YYYY-MM-DD (hora de Bolivia).
export function proximasFechas(pais: string, ciudad: string, hoy: string, extras: FechaAdmin[] = [], dias = 75): FechaEspecial[] {
  const anio = Number(hoy.slice(0, 4))
  const candidatas: Pick<Regla, 'id' | 'nombre' | 'emoji' | 'idea' | 'cuando'>[] = [
    ...REGLAS.filter((r) => !r.paises.length || r.paises.includes(pais)),
    ...extras
      .filter((f) => /^\d{2}-\d{2}$/.test(f.mmdd) && (!f.ciudad || f.ciudad === ciudad))
      .map((f) => ({ id: `admin-${f.id}`, nombre: f.nombre, emoji: f.emoji || '📅', idea: f.idea || '', cuando: f.mmdd })),
  ]
  const out: FechaEspecial[] = []
  for (const r of candidatas) {
    // La de este año, o la del que viene si ya pasó.
    let fecha = enAnio(r.cuando, anio)
    if (fecha < hoy) fecha = enAnio(r.cuando, anio + 1)
    const faltan = diasEntre(hoy, fecha)
    if (faltan <= dias) out.push({ id: r.id, nombre: r.nombre, emoji: r.emoji, idea: r.idea, fecha, faltan })
  }
  return out.sort((a, b) => a.faltan - b.faltan)
}

export const OBJETIVOS_ESTRATEGIA = [
  { id: 'mas-vistos', label: '🔥 Empujar lo más visto', ayuda: 'Los que más miran y agregan al carrito: convertí ese interés en ventas.' },
  { id: 'sin-ventas', label: '😴 Mover lo que no se vende', ayuda: 'Los que miran pero no compran, y los que casi nadie vio.' },
  { id: 'fecha', label: '🎉 Fecha especial', ayuda: 'Una campaña para una fecha que se viene.' },
  { id: 'liquidar', label: '⏳ Últimas unidades / liquidación', ayuda: 'Poco stock o con descuento: vender rápido.' },
  { id: 'libre', label: '✍️ Lo que vos quieras', ayuda: 'Contá tu objetivo con tus palabras.' },
] as const
export type ObjetivoEstrategia = (typeof OBJETIVOS_ESTRATEGIA)[number]['id']

// Lo que devuelve la IA (validado) y se guarda en estrategiasMarketing/{uid}.
export type DiaEstrategia = { dia: number; fecha: string; red: string; hora: string; idea: string; productoIds: string[]; tono: string; hecho?: boolean }
export type Estrategia = {
  objetivo: ObjetivoEstrategia
  fechaEspecial?: { id: string; nombre: string; emoji: string; fecha: string } | null
  pedido?: string
  titulo: string
  resumen: string
  productos: { id: string; porque: string; accion: string }[]
  oferta: string
  dias: DiaEstrategia[]
  consejos: string[]
  conIA: boolean
  creadaAt: string
}

// Gratis: 1 estrategia con IA cada 7 días. Premium: ilimitadas.
export const DIAS_ENTRE_ESTRATEGIAS_GRATIS = 7
