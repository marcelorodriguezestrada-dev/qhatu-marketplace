'use client'

// Barra de filtros para las listas largas del admin (solicitudes de
// profesionales y anuncios): buscar, rubro, fecha, invitados o no, y
// orden (prioridad de la IA, más nuevos, más viejos, sin invitar hace más).

export type Filtros = {
  texto: string
  rubro: string // '' = todos
  fecha: 'todos' | 'hoy' | '7' | '30' | 'viejos'
  invitacion: 'todos' | 'sin' | 'invitados'
  prioridad: 'todas' | 'alta' | 'media' | 'baja' | 'sin'
  orden: 'ia' | 'nuevos' | 'viejos'
}

export const FILTROS_INICIALES: Filtros = { texto: '', rubro: '', fecha: 'todos', invitacion: 'todos', prioridad: 'todas', orden: 'ia' }

type Accesos<T> = {
  texto: (x: T) => string
  rubro: (x: T) => string | undefined
  fecha: (x: T) => string | undefined // ISO de creación
  invitado: (x: T) => boolean
  puntaje: (x: T) => number | undefined
}

function norm(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function aplicarFiltros<T>(lista: T[], f: Filtros, a: Accesos<T>): T[] {
  const ahora = Date.now()
  const q = norm(f.texto.trim())
  const out = lista.filter((x) => {
    if (q && !norm(a.texto(x)).includes(q)) return false
    if (f.rubro && a.rubro(x) !== f.rubro) return false
    const t = Date.parse(a.fecha(x) || '') || 0
    const dias = (ahora - t) / 86400_000
    if (f.fecha === 'hoy' && dias > 1) return false
    if (f.fecha === '7' && dias > 7) return false
    if (f.fecha === '30' && dias > 30) return false
    if (f.fecha === 'viejos' && dias <= 30) return false
    if (f.invitacion === 'sin' && a.invitado(x)) return false
    if (f.invitacion === 'invitados' && !a.invitado(x)) return false
    const p = a.puntaje(x)
    if (f.prioridad === 'alta' && !(p != null && p >= 70)) return false
    if (f.prioridad === 'media' && !(p != null && p >= 40 && p < 70)) return false
    if (f.prioridad === 'baja' && !(p != null && p < 40)) return false
    if (f.prioridad === 'sin' && p != null) return false
    return true
  })
  return out.sort((x, y) => {
    if (f.orden === 'ia') {
      const d = (a.puntaje(y) ?? -1) - (a.puntaje(x) ?? -1)
      if (d !== 0) return d
    }
    const fx = a.fecha(x) || '', fy = a.fecha(y) || ''
    return f.orden === 'viejos' ? fx.localeCompare(fy) : fy.localeCompare(fx)
  })
}

export default function FiltrosLista({
  filtros,
  onChange,
  rubros,
  total,
  visibles,
}: {
  filtros: Filtros
  onChange: (f: Filtros) => void
  rubros: { id: string; label: string }[]
  total: number
  visibles: number
}) {
  const set = (c: Partial<Filtros>) => onChange({ ...filtros, ...c })
  const sel = 'px-2 py-1.5 rounded-lg border border-line bg-panel font-body text-xs text-ink'
  const activos = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES)
  return (
    <div className="bg-panelalt border border-line rounded-xl p-3 mb-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={filtros.texto}
          onChange={(e) => set({ texto: e.target.value })}
          placeholder="🔍 Buscar nombre, texto, teléfono..."
          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs"
        />
        <select value={filtros.rubro} onChange={(e) => set({ rubro: e.target.value })} className={sel} aria-label="Rubro">
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <select value={filtros.fecha} onChange={(e) => set({ fecha: e.target.value as Filtros['fecha'] })} className={sel} aria-label="Fecha">
          <option value="todos">Cualquier fecha</option>
          <option value="hoy">Hoy</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="viejos">Más de 30 días</option>
        </select>
        <select value={filtros.invitacion} onChange={(e) => set({ invitacion: e.target.value as Filtros['invitacion'] })} className={sel} aria-label="Invitación">
          <option value="todos">Invitados y sin invitar</option>
          <option value="sin">Sin invitar todavía</option>
          <option value="invitados">Ya invitados</option>
        </select>
        <select value={filtros.prioridad} onChange={(e) => set({ prioridad: e.target.value as Filtros['prioridad'] })} className={sel} aria-label="Prioridad IA">
          <option value="todas">Toda prioridad</option>
          <option value="alta">🔥 Alta (70+)</option>
          <option value="media">👍 Media (40–69)</option>
          <option value="baja">💤 Baja (&lt;40)</option>
          <option value="sin">Sin evaluar</option>
        </select>
        <select value={filtros.orden} onChange={(e) => set({ orden: e.target.value as Filtros['orden'] })} className={sel} aria-label="Orden">
          <option value="ia">Orden: prioridad IA</option>
          <option value="nuevos">Orden: más nuevos</option>
          <option value="viejos">Orden: más viejos</option>
        </select>
      </div>
      <div className="flex items-center justify-between mt-2 font-body text-[11px] text-inksoft">
        <span>Mostrando {visibles} de {total}</span>
        {activos && (
          <button type="button" onClick={() => onChange(FILTROS_INICIALES)} className="text-teal underline">Limpiar filtros</button>
        )}
      </div>
    </div>
  )
}
