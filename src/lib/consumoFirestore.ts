import { FieldValue, Firestore, Query } from 'firebase-admin/firestore'
import { IDS_AJUSTES, valorAjuste, type IdAjuste } from '@/lib/ajustesConsumo'

// Medidor de lecturas de Firestore (Admin → Números → "🔋 Consumo de la base").
// El plan gratis da 50.000 lecturas por día; cuando se acaban, todo lo que
// lee la base falla ("RESOURCE_EXHAUSTED: Quota exceeded") hasta la
// medianoche de EE.UU. (hora del Pacífico). Para saber QUÉ las gasta:
// - cada consulta (`query.get()`, `doc.get()`, `getAll`) suma los documentos
//   leídos a la página o API que la hizo (se saca del stack: el archivo
//   .next/server/app/<ruta>/route.js o page.js);
// - se juntan en memoria y cada ~30 s se guardan en consumoFirestore/{día}
//   (un solo write por tanda). Es aproximado: lo de una instancia que Vercel
//   apaga antes de guardar se pierde.
// Desde el tablero se puede PAUSAR una ruta (sus lecturas fallan sin tocar
// la base) o activar el "modo ahorro" (los cachés duran 10 veces más).
// La config está en config/consumoFirestore y se relee cada minuto.

export const LIMITE_GRATIS_DIA = 50_000

// Rutas que nunca se pausan: sin ellas no se puede comprar ni entrar al admin.
export const RUTAS_SIN_PAUSA = ['api/pedidos', 'api/admin/consumo']

type Config = { pausadas: string[]; ahorro: boolean; intervalos: Record<string, number> }
let config: Config = { pausadas: [], ahorro: false, intervalos: {} }
let configHasta = 0
let leyendoConfig: Promise<void> | null = null

let pendientes = new Map<string, number>()
let pendienteTotal = 0
let ultimoGuardado = Date.now()
let guardando = false
let interno = 0 // lecturas/escrituras del propio medidor: ni se cuentan ni se pausan

let instalado = false
let base: Firestore | null = null

// "Día de cuota": el de la hora del Pacífico, que es cuando Firebase reinicia el límite.
export function diaCuota(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
}
const horaCuota = (fecha = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(fecha)

// Clave segura para un campo de Firestore ("api/productos/[id]" → "api_productos__id_").
export const claveRuta = (ruta: string) => ruta.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 120)

// Qué página/API está leyendo: el primer archivo de ruta de Next en el stack.
export function origenDesdeStack(stack: string): string {
  const m = stack.match(/[\\/]\.next[\\/]server[\\/](app|pages)[\\/]([^\s:()]+?)[\\/]?(route|page|layout)?\.js/)
  if (!m) return 'otro'
  let ruta = m[2].replace(/\\/g, '/')
  if (m[1] === 'pages') ruta = `pages/${ruta}`
  ruta = ruta.replace(/\/(route|page)$/, '')
  return ruta || 'inicio'
}

function origen(): string {
  const antes = Error.stackTraceLimit
  Error.stackTraceLimit = 60
  const stack = new Error().stack || ''
  Error.stackTraceLimit = antes
  return origenDesdeStack(stack)
}

export const modoAhorro = () => config.ahorro

// Duración de un caché según el modo ahorro (10 veces más si está activo).
export const duracionCache = (ms: number) => (config.ahorro ? ms * 10 : ms)

// Segundos de un ajuste del tablero (ver src/lib/ajustesConsumo.ts).
export const segundosAjuste = (id: IdAjuste) => valorAjuste(id, config.intervalos)
export const ajustesActuales = () => Object.fromEntries(IDS_AJUSTES.map((id) => [id, segundosAjuste(id)])) as Record<IdAjuste, number>

function refrescarConfig(): Promise<void> {
  if (leyendoConfig) return leyendoConfig
  if (!base || Date.now() < configHasta) return Promise.resolve()
  interno++
  const p = base.collection('config').doc('consumoFirestore').get()
  interno--
  leyendoConfig = p
    .then((d) => {
      const x = d.data() || {}
      config = {
        pausadas: Array.isArray(x.pausadas) ? x.pausadas.map(String) : [],
        ahorro: x.ahorro === true,
        intervalos: x.intervalos && typeof x.intervalos === 'object' ? x.intervalos : {},
      }
    })
    .catch(() => {})
    .finally(() => {
      configHasta = Date.now() + 60_000
      leyendoConfig = null
    })
  return leyendoConfig
}

// Para quien necesita la config al día antes de responder (ej. /api/ajustes-consumo).
export const cargarConfigConsumo = (db: Firestore) => {
  base = base || db
  return refrescarConfig()
}

// Para que el tablero aplique un cambio enseguida en esta instancia.
export function aplicarConfig(c: Partial<Config>) {
  config = { ...config, ...c }
  configHasta = Date.now() + 60_000
}

function guardar(forzar = false) {
  if (!base || guardando || !pendienteTotal) return
  if (!forzar && Date.now() - ultimoGuardado < 30_000 && pendienteTotal < 2000) return
  const tanda = pendientes
  const total = pendienteTotal
  pendientes = new Map()
  pendienteTotal = 0
  ultimoGuardado = Date.now()
  guardando = true
  const rutas: Record<string, any> = {}
  for (const [ruta, n] of Array.from(tanda)) rutas[claveRuta(ruta)] = { nombre: ruta, lecturas: FieldValue.increment(n) }
  interno++
  const p = base
    .collection('consumoFirestore')
    .doc(diaCuota())
    .set({ total: FieldValue.increment(total), rutas, horas: { [horaCuota()]: FieldValue.increment(total) }, actualizado: new Date().toISOString() }, { merge: true })
  interno--
  p.catch(() => {}).finally(() => (guardando = false))
}

function contar(ruta: string, n: number) {
  pendientes.set(ruta, (pendientes.get(ruta) || 0) + n)
  pendienteTotal += n
  guardar()
}

export class RutaPausada extends Error {
  constructor(ruta: string) {
    super(`Lecturas pausadas para "${ruta}" desde Admin → Consumo de la base.`)
    this.name = 'RutaPausada'
  }
}

// Antes de leer: ¿esta ruta está pausada? (devuelve la ruta para contarla después)
function antesDeLeer(): string | null {
  if (interno) return null
  refrescarConfig()
  const ruta = origen()
  if (config.pausadas.includes(ruta) && !RUTAS_SIN_PAUSA.includes(ruta)) throw new RutaPausada(ruta)
  return ruta
}

export function instalarMedidor(db: Firestore) {
  base = db
  if (instalado) return
  instalado = true
  const queryGet = Query.prototype.get
  Query.prototype.get = function (this: Query) {
    let ruta: string | null
    try {
      ruta = antesDeLeer()
    } catch (e) {
      return Promise.reject(e)
    }
    return queryGet.call(this).then((snap: any) => {
      // Una consulta sin resultados igual cobra 1 lectura.
      if (ruta) contar(ruta, Math.max(1, snap?.size || 0))
      return snap
    })
  } as any
  // doc.get() también pasa por acá (Firestore lo resuelve con getAll).
  const getAll = Firestore.prototype.getAll
  Firestore.prototype.getAll = function (this: Firestore, ...args: any[]) {
    let ruta: string | null
    try {
      ruta = antesDeLeer()
    } catch (e) {
      return Promise.reject(e)
    }
    return (getAll as any).apply(this, args).then((docs: any[]) => {
      if (ruta) contar(ruta, Math.max(1, docs?.length || 0))
      return docs
    })
  } as any
}

// Guarda lo pendiente ya (lo usa el tablero antes de mostrar los números).
export function guardarConsumoAhora() {
  guardar(true)
}
