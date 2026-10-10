import { REDES_LANZAMIENTO, diasEntre, sumarDias, type ConfigLanzamiento } from '@/lib/lanzamiento'

// Reporte del plan de lanzamiento (Admin → Marketing → 📊 Reportes):
// totales contra las metas con la proyección al ritmo actual, la serie
// por día, por red, por formato (video vs imagen), las mejores
// publicaciones y lo que está atrasado. Puro: se arma en el servidor con
// los números por día de los links de cada publicación.

export type Numeros = { visitas: number; registros: number; vendedores: number; pedidos: number; ventasBs: number }
const cero = (): Numeros => ({ visitas: 0, registros: 0, vendedores: 0, pedidos: 0, ventasBs: 0 })
const sumar = (a: Numeros, b: Partial<Numeros> | null | undefined) => {
  if (!b) return a
  for (const k of Object.keys(a) as (keyof Numeros)[]) a[k] += Number(b[k] || 0)
  return a
}

export type Reporte = ReturnType<typeof armarReporte>

export function armarReporte({ config, pubs, porPub, conPieza, desde, hasta, hoy }: {
  config: ConfigLanzamiento
  pubs: any[]
  porPub: { id: string; total: Record<string, number> | null; dias: { dia: string; [k: string]: any }[] }[]
  conPieza: Set<string>
  desde: string
  hasta: string
  hoy: string
}) {
  const totalDe = new Map(porPub.map((x) => [x.id, x.total]))
  const total = cero()
  for (const x of porPub) sumar(total, x.total as any)

  // Serie por día (todos los días del rango, también los que no tuvieron nada).
  const n = diasEntre(desde, hasta) + 1
  const serie = Array.from({ length: n }, (_, i) => ({ dia: sumarDias(desde, i), ...cero() }))
  const idx = new Map(serie.map((s, i) => [s.dia, i]))
  for (const x of porPub) for (const d of x.dias) { const i = idx.get(d.dia); if (i != null) sumar(serie[i], d as Partial<Numeros>) }
  // Publicaciones por día (para marcar en el gráfico cuándo se publicó).
  const publicadasPorDia: Record<string, number> = {}
  for (const p of pubs) if (p.estado === 'publicada') publicadasPorDia[p.fecha] = (publicadasPorDia[p.fecha] || 0) + 1

  const porRed = REDES_LANZAMIENTO.map((r) => {
    const de = pubs.filter((p) => p.red === r.id)
    const t = cero()
    for (const p of de) sumar(t, totalDe.get(p.id) as any)
    const publicadas = de.filter((p) => p.estado === 'publicada').length
    return { id: r.id, label: r.label, icono: r.icono, publicaciones: de.length, publicadas, ...t, visitasPorPublicacion: publicadas ? Math.round(t.visitas / publicadas) : 0 }
  }).filter((r) => r.publicaciones > 0)

  const grupoFormato = (f: string) => (f === 'video' || f === 'reel' ? 'Video' : f === 'estado' || f === 'historia' ? 'Estado / historia' : 'Imagen')
  const porFormato = ['Video', 'Imagen', 'Estado / historia'].map((g) => {
    const de = pubs.filter((p) => grupoFormato(p.formato) === g && p.estado === 'publicada')
    const t = cero()
    for (const p of de) sumar(t, totalDe.get(p.id) as any)
    return { formato: g, publicadas: de.length, ...t, visitasPorPublicacion: de.length ? Math.round(t.visitas / de.length) : 0, conversion: t.visitas ? Math.round((t.registros / t.visitas) * 1000) / 10 : 0 }
  }).filter((f) => f.publicadas > 0)

  const mejores = pubs
    .map((p) => ({ id: p.id, fecha: p.fecha, red: p.red, formato: p.formato, titulo: p.titulo, ...cero(), ...(totalDe.get(p.id) || {}) }))
    .filter((p) => p.visitas || p.pedidos)
    .sort((a, b) => b.pedidos - a.pedidos || b.registros - a.registros || b.visitas - a.visitas)
    .slice(0, 10)

  const atrasadas = pubs.filter((p) => p.fecha < hoy && p.estado !== 'publicada').sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => ({ id: p.id, fecha: p.fecha, red: p.red, titulo: p.titulo }))
  const proximas = pubs.filter((p) => p.fecha >= hoy && p.fecha <= sumarDias(hoy, 6) && p.estado !== 'publicada')
  const sinPieza = proximas.filter((p) => !conPieza.has(p.id) && p.red !== 'whatsapp').map((p) => ({ id: p.id, fecha: p.fecha, red: p.red, titulo: p.titulo }))

  // Ritmo de los últimos 7 días y proyección hasta 2 semanas después del lanzamiento.
  const ult7 = serie.slice(-7).reduce((a, s) => sumar(a, s), cero())
  const finCampana = sumarDias(config.fecha, 14)
  const diasRestantes = Math.max(0, diasEntre(hoy, finCampana))
  const metas = (['visitas', 'registros', 'pedidos', 'vendedores'] as const).map((k) => {
    const ritmo = ult7[k] / 7
    const proyectado = Math.round(total[k] + ritmo * diasRestantes)
    const meta = config.metas[k]
    return { id: k, actual: total[k], meta, ritmoDiario: Math.round(ritmo * 10) / 10, proyectado, llega: meta ? proyectado >= meta : true }
  })

  return {
    desde, hasta, hoy,
    lanzamiento: config.fecha,
    finCampana,
    total,
    metas,
    serie,
    publicadasPorDia,
    porRed,
    porFormato,
    mejores,
    atrasadas,
    sinPieza,
    conteo: { total: pubs.length, publicadas: pubs.filter((p) => p.estado === 'publicada').length, listas: pubs.filter((p) => p.estado === 'lista').length, pendientes: pubs.filter((p) => p.estado === 'pendiente').length },
  }
}

const NOMBRE_META: Record<string, string> = { visitas: 'visitas', registros: 'cuentas nuevas', pedidos: 'compras', vendedores: 'tiendas nuevas' }

// Sin IA: recomendaciones por reglas, a partir del mismo reporte.
export function recomendacionesBasicas(r: Reporte): { resumen: string; recomendaciones: { titulo: string; detalle: string }[] } {
  const out: { titulo: string; detalle: string }[] = []
  if (r.atrasadas.length) out.push({ titulo: `Tenés ${r.atrasadas.length} publicación(es) atrasada(s)`, detalle: `Publicá o mové de día: ${r.atrasadas.slice(0, 3).map((p) => p.titulo).join(', ')}.` })
  if (r.sinPieza.length) out.push({ titulo: `${r.sinPieza.length} publicación(es) de esta semana sin video o imagen`, detalle: `Preparalas en 🎬 Contenido: ${r.sinPieza.slice(0, 3).map((p) => p.titulo).join(', ')}.` })
  const red = [...r.porRed].filter((x) => x.publicadas >= 2).sort((a, b) => b.visitasPorPublicacion - a.visitasPorPublicacion)
  if (red.length >= 2 && red[0].visitasPorPublicacion > red[red.length - 1].visitasPorPublicacion * 1.5) out.push({ titulo: `${red[0].label} rinde más`, detalle: `Cada publicación en ${red[0].label} trae ${red[0].visitasPorPublicacion} visitas en promedio, contra ${red[red.length - 1].visitasPorPublicacion} en ${red[red.length - 1].label}. Sumá una publicación más por semana ahí.` })
  const fmt = [...r.porFormato].sort((a, b) => b.visitasPorPublicacion - a.visitasPorPublicacion)
  if (fmt.length >= 2 && fmt[0].visitasPorPublicacion > 0) out.push({ titulo: `Los ${fmt[0].formato.toLowerCase()}s traen más visitas`, detalle: `${fmt[0].visitasPorPublicacion} visitas por publicación contra ${fmt[fmt.length - 1].visitasPorPublicacion} con ${fmt[fmt.length - 1].formato.toLowerCase()}.` })
  for (const m of r.metas.filter((m) => !m.llega && m.meta)) out.push({ titulo: `Al ritmo actual no llegás a la meta de ${NOMBRE_META[m.id]}`, detalle: `Vas ${m.actual} de ${m.meta} y la proyección da ${m.proyectado}. Hacen falta unas ${Math.max(1, Math.ceil((m.meta - m.proyectado) / Math.max(1, diasEntre(r.hoy, r.finCampana))))} más por día.` })
  if (r.mejores[0]) out.push({ titulo: 'Repetí lo que funcionó', detalle: `“${r.mejores[0].titulo}” es tu mejor publicación (${r.mejores[0].visitas} visitas, ${r.mejores[0].pedidos} compras). Hacé una variante con otro producto.` })
  if (!out.length) out.push({ titulo: 'Todavía hay pocos datos', detalle: 'Publicá lo del calendario con sus links: en unos días acá vas a ver qué red y qué formato traen más gente.' })
  const vis = r.total.visitas
  return { resumen: vis ? `Llevás ${vis} visitas, ${r.total.registros} cuentas nuevas y ${r.total.pedidos} compras por tus publicaciones.` : 'Todavía no hay visitas por los links de tus publicaciones.', recomendaciones: out.slice(0, 6) }
}
