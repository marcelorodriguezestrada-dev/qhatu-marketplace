// Frecuencias y cachés que se pueden cambiar desde Admin → Consumo de la
// base (se guardan en config/consumoFirestore.intervalos, en segundos).
// - "cliente": cada cuánto pregunta el navegador (más largo = menos lecturas,
//   pero lo nuevo tarda más en verse).
// - "servidor": cuánto se guarda una respuesta en memoria antes de volver a
//   leer la base (el modo ahorro lo multiplica por 10).
// Archivo sin nada del servidor: lo usan también los componentes.

export type IdAjuste = 'campanita' | 'seguimiento' | 'alarma' | 'cacheListas' | 'cacheNotificaciones' | 'cacheConfig' | 'cacheResenas'

export type Ajuste = {
  nombre: string
  ayuda: string
  lado: 'cliente' | 'servidor'
  defecto: number
  recomendado: number
  opciones: number[]
}

export const AJUSTES: Record<IdAjuste, Ajuste> = {
  campanita: {
    nombre: 'Campanita de notificaciones',
    ayuda: 'Cada cuánto se fija si hay notificaciones nuevas (solo con la pestaña a la vista).',
    lado: 'cliente',
    defecto: 120,
    recomendado: 300,
    opciones: [60, 120, 300, 600, 900],
  },
  seguimiento: {
    nombre: 'Seguimiento de un pedido',
    ayuda: 'Cada cuánto se actualiza el estado en la pantalla del comprador.',
    lado: 'cliente',
    defecto: 30,
    recomendado: 30,
    opciones: [15, 30, 60, 120],
  },
  alarma: {
    nombre: 'Alarma de pedidos del admin',
    ayuda: 'Cada cuánto el admin pregunta si entró un pedido (tarda eso en sonar).',
    lado: 'cliente',
    defecto: 20,
    recomendado: 30,
    opciones: [10, 20, 30, 60, 120],
  },
  cacheListas: {
    nombre: 'Listas de productos, anuncios y servicios',
    ayuda: 'Cuánto se guarda la lista: es lo que más lee (cada vez lee todos los productos). Lo nuevo tarda eso en verse para el público.',
    lado: 'servidor',
    defecto: 60,
    recomendado: 120,
    opciones: [30, 60, 120, 300, 600],
  },
  cacheNotificaciones: {
    nombre: 'Notificaciones de cada usuario',
    ayuda: 'Cuánto se guardan las notificaciones de una persona antes de releerlas.',
    lado: 'servidor',
    defecto: 60,
    recomendado: 120,
    opciones: [30, 60, 120, 300],
  },
  cacheConfig: {
    nombre: 'Datos de cobro y portada',
    ayuda: 'QR/cuenta del checkout y secciones del inicio (casi nunca cambian; si los cambiás desde el admin, puede tardar hasta este tiempo en verse en todo el sitio).',
    lado: 'servidor',
    defecto: 60,
    recomendado: 300,
    opciones: [30, 60, 300, 900, 1800],
  },
  cacheResenas: {
    nombre: 'Reseñas de productos',
    ayuda: 'Cuánto se guardan las reseñas de un producto y los pedidos entregados de quien lo mira.',
    lado: 'servidor',
    defecto: 120,
    recomendado: 300,
    opciones: [60, 120, 300, 900],
  },
}

export const IDS_AJUSTES = Object.keys(AJUSTES) as IdAjuste[]

// Valor válido de un ajuste (si no está guardado o es raro, el de siempre).
export function valorAjuste(id: IdAjuste, guardados: Record<string, unknown> | null | undefined): number {
  const v = Number(guardados?.[id])
  return AJUSTES[id].opciones.includes(v) ? v : AJUSTES[id].defecto
}

export const textoSegundos = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`)
