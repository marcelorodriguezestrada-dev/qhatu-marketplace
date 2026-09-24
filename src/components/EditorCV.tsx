'use client'

import { useState } from 'react'
import {
  PuestoLaboral,
  Idioma,
  MAX_PUESTOS,
  MAX_IDIOMAS,
  MAX_LOGROS_POR_PUESTO,
  NIVELES_IDIOMA,
  MESES_CORTOS,
  rangoFechas,
  sanearHistorialLaboral,
} from '@/lib/cvEstandar'

// Editor del CV estandarizado (historial laboral + idiomas), compartido
// entre /mi-perfil y /admin. No guarda nada por su cuenta: el padre
// tiene el estado y decide cuándo mandarlo al servidor.
//
// Los logros y el stack se editan como texto (un logro por renglón,
// herramientas separadas por coma) porque es lo más cómodo de tipear —
// por eso el estado es un "borrador" y se convierte al formato final
// recién al guardar (deBorradores).

export type PuestoBorrador = {
  id: string
  cargo: string
  empresa: string
  cliente: string
  desde: string
  hasta: string
  actual: boolean
  logrosTexto: string
  stackTexto: string
}

export function aBorradores(historial: PuestoLaboral[] | undefined): PuestoBorrador[] {
  return (historial || []).map((p) => ({
    id: p.id,
    cargo: p.cargo,
    empresa: p.empresa,
    cliente: p.cliente,
    desde: p.desde,
    hasta: p.hasta,
    actual: p.actual,
    logrosTexto: p.logros.join('\n'),
    stackTexto: p.stack.join(', '),
  }))
}

export function deBorradores(borradores: PuestoBorrador[]): PuestoLaboral[] {
  return sanearHistorialLaboral(
    borradores.map((b) => ({
      ...b,
      logros: b.logrosTexto.split('\n').map((l) => l.replace(/^\s*[-•*·]\s*/, '').trim()),
      stack: b.stackTexto.split(/[,;·\n]/).map((s) => s.trim()),
    }))
  )
}

function puestoVacio(): PuestoBorrador {
  return { id: `p${Date.now()}`, cargo: '', empresa: '', cliente: '', desde: '', hasta: '', actual: false, logrosTexto: '', stackTexto: '' }
}

// Fecha "AAAA-MM" o "AAAA": mes opcional + año, porque mucha gente no
// se acuerda del mes exacto de un trabajo de hace años.
function CampoFecha({ valor, onChange, disabled }: { valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [anio, mes] = valor.split('-')
  const armar = (a: string, m: string) => (a ? (m ? `${a}-${m}` : a) : '')
  return (
    <div className="flex gap-1.5">
      <select
        value={mes || ''}
        disabled={disabled || !anio}
        onChange={(e) => onChange(armar(anio || '', e.target.value))}
        className="w-[72px] px-2 py-2 rounded-lg border border-line font-body text-sm bg-panel disabled:opacity-50"
      >
        <option value="">Mes</option>
        {MESES_CORTOS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      <input
        value={anio || ''}
        disabled={disabled}
        onChange={(e) => {
          const a = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(armar(a, a.length === 4 ? mes || '' : ''))
        }}
        inputMode="numeric"
        placeholder="Año"
        className="w-[70px] px-2 py-2 rounded-lg border border-line font-body text-sm bg-panel disabled:opacity-50"
      />
    </div>
  )
}

type Props = {
  historial: PuestoBorrador[]
  onHistorialChange: (h: PuestoBorrador[]) => void
  idiomas: Idioma[]
  onIdiomasChange: (i: Idioma[]) => void
  // Llama a /api/profesionales/mejorar-puesto con la autenticación que
  // corresponda (login del profesional o contraseña de admin).
  mejorarConIA?: (p: PuestoBorrador) => Promise<{ logros: string[]; stack: string[] }>
}

export default function EditorCV({ historial, onHistorialChange, idiomas, onIdiomasChange, mejorarConIA }: Props) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [mejorandoId, setMejorandoId] = useState<string | null>(null)
  const [errorIA, setErrorIA] = useState('')

  function actualizar(id: string, cambios: Partial<PuestoBorrador>) {
    onHistorialChange(historial.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  function agregarPuesto() {
    if (historial.length >= MAX_PUESTOS) return
    const nuevo = puestoVacio()
    // El más nuevo arriba: casi siempre se carga primero el trabajo actual.
    onHistorialChange([nuevo, ...historial])
    setAbiertoId(nuevo.id)
  }

  function quitarPuesto(id: string) {
    onHistorialChange(historial.filter((p) => p.id !== id))
    if (abiertoId === id) setAbiertoId(null)
  }

  function mover(id: string, delta: number) {
    const i = historial.findIndex((p) => p.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= historial.length) return
    const copia = [...historial]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    onHistorialChange(copia)
  }

  async function mejorar(p: PuestoBorrador) {
    if (!mejorarConIA) return
    setErrorIA('')
    setMejorandoId(p.id)
    try {
      const r = await mejorarConIA(p)
      const stackActual = p.stackTexto.split(/[,;·\n]/).map((s) => s.trim()).filter(Boolean)
      const stackNuevo = [...stackActual]
      for (const s of r.stack) if (!stackNuevo.some((x) => x.toLowerCase() === s.toLowerCase())) stackNuevo.push(s)
      actualizar(p.id, { logrosTexto: r.logros.join('\n'), stackTexto: stackNuevo.join(', ') })
    } catch (e: any) {
      setErrorIA(e?.message || 'No se pudo redactar con IA.')
    } finally {
      setMejorandoId(null)
    }
  }

  return (
    <div>
      {/* --- Historial laboral --- */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-body text-xs font-semibold text-ink">Historial laboral</div>
        {historial.length < MAX_PUESTOS && (
          <button type="button" onClick={agregarPuesto} className="font-body text-xs text-teal font-semibold">
            + Agregar puesto
          </button>
        )}
      </div>
      {historial.length === 0 && (
        <div className="font-body text-[11px] text-inksoft mb-3 bg-panelalt border border-dashed border-line rounded-lg px-3 py-2.5">
          Todavía no cargaste ningún puesto. Empezá por el trabajo actual (o el último) con "+ Agregar puesto". No hace falta tener un CV armado: contá con tus palabras qué hacías y la IA lo redacta prolijo.
        </div>
      )}
      {errorIA && <div className="font-body text-xs text-maroon bg-maroon/10 border border-maroon rounded-md px-3 py-2 mb-2">{errorIA}</div>}

      <div className="flex flex-col gap-2 mb-4">
        {historial.map((p, i) => {
          const abierto = abiertoId === p.id
          const cantLogros = p.logrosTexto.split('\n').filter((l) => l.trim()).length
          return (
            <div key={p.id} className="border border-line rounded-lg bg-panelalt">
              <div className="flex items-start gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setAbiertoId(abierto ? null : p.id)} className="flex-1 text-left min-w-0">
                  <div className="font-body text-sm font-semibold text-ink truncate">
                    {p.cargo || <span className="text-inksoft font-normal">Puesto sin cargo</span>}
                    {p.empresa && <span className="font-normal text-inksoft"> · {p.empresa}</span>}
                  </div>
                  <div className="font-body text-[11px] text-inksoft">
                    {rangoFechas(p) || 'Sin fechas'} · {cantLogros} {cantLogros === 1 ? 'logro' : 'logros'}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => mover(p.id, -1)} disabled={i === 0} className="px-1.5 text-inksoft disabled:opacity-30" title="Subir">↑</button>
                  <button type="button" onClick={() => mover(p.id, 1)} disabled={i === historial.length - 1} className="px-1.5 text-inksoft disabled:opacity-30" title="Bajar">↓</button>
                  <button type="button" onClick={() => setAbiertoId(abierto ? null : p.id)} className="px-1.5 font-body text-xs text-teal underline">
                    {abierto ? 'Cerrar' : 'Editar'}
                  </button>
                  <button type="button" onClick={() => quitarPuesto(p.id)} className="px-1.5 font-body text-xs text-maroon underline">Quitar</button>
                </div>
              </div>

              {abierto && (
                <div className="border-t border-line px-3 py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="font-body text-[11px] text-inksoft mb-1">Cargo *</div>
                      <input
                        value={p.cargo}
                        onChange={(e) => actualizar(p.id, { cargo: e.target.value })}
                        placeholder="Ej: Técnico plomero, Ingeniero de Datos"
                        className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
                      />
                    </div>
                    <div>
                      <div className="font-body text-[11px] text-inksoft mb-1">Empresa / lugar</div>
                      <input
                        value={p.empresa}
                        onChange={(e) => actualizar(p.id, { empresa: e.target.value })}
                        placeholder="Ej: Constructora Andina, Independiente"
                        className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
                      />
                    </div>
                  </div>

                  <div className="font-body text-[11px] text-inksoft mb-1">Aclaración (opcional)</div>
                  <input
                    value={p.cliente}
                    onChange={(e) => actualizar(p.id, { cliente: e.target.value })}
                    placeholder="Ej: Cliente: KAVAK · Proyecto Mercado Libre vía Accenture"
                    className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2"
                  />

                  <div className="flex flex-wrap items-end gap-3 mb-2">
                    <div>
                      <div className="font-body text-[11px] text-inksoft mb-1">Desde</div>
                      <CampoFecha valor={p.desde} onChange={(v) => actualizar(p.id, { desde: v })} />
                    </div>
                    <div>
                      <div className="font-body text-[11px] text-inksoft mb-1">Hasta</div>
                      <CampoFecha valor={p.hasta} onChange={(v) => actualizar(p.id, { hasta: v })} disabled={p.actual} />
                    </div>
                    <label className="flex items-center gap-1.5 font-body text-xs text-ink pb-2">
                      <input type="checkbox" checked={p.actual} onChange={(e) => actualizar(p.id, { actual: e.target.checked, hasta: e.target.checked ? '' : p.hasta })} />
                      Trabajo acá actualmente
                    </label>
                  </div>

                  <div className="font-body text-[11px] text-inksoft mb-1">
                    Logros y responsabilidades — uno por renglón, idealmente "Título: detalle" (máx. {MAX_LOGROS_POR_PUESTO})
                  </div>
                  <textarea
                    value={p.logrosTexto}
                    onChange={(e) => actualizar(p.id, { logrosTexto: e.target.value })}
                    rows={5}
                    placeholder={'Ej: Mantenimiento preventivo: Revisión mensual de instalaciones en 3 edificios\n\n…o contalo con tus palabras y tocá "Redactar con IA"'}
                    className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-1.5"
                  />
                  {mejorarConIA && (
                    <button
                      type="button"
                      onClick={() => mejorar(p)}
                      disabled={mejorandoId !== null || p.logrosTexto.trim().length < 10}
                      className="mb-2.5 px-3 py-1.5 rounded-md border border-teal text-teal font-body text-xs font-semibold disabled:opacity-50"
                    >
                      {mejorandoId === p.id ? 'Redactando...' : '✨ Redactar con IA'}
                    </button>
                  )}

                  <div className="font-body text-[11px] text-inksoft mb-1">Herramientas / tecnologías / materiales (separadas por coma)</div>
                  <input
                    value={p.stackTexto}
                    onChange={(e) => actualizar(p.id, { stackTexto: e.target.value })}
                    placeholder="Ej: Python, SQL, Excel · o: soldadura PPR, termofusión"
                    className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* --- Idiomas --- */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-body text-xs font-semibold text-ink">Idiomas</div>
        {idiomas.length < MAX_IDIOMAS && (
          <button
            type="button"
            onClick={() => onIdiomasChange([...idiomas, { idioma: idiomas.length === 0 ? 'Español' : '', nivel: idiomas.length === 0 ? 'Nativo' : '' }])}
            className="font-body text-xs text-teal font-semibold"
          >
            + Agregar idioma
          </button>
        )}
      </div>
      <datalist id="niveles-idioma">
        {NIVELES_IDIOMA.map((n) => <option key={n} value={n} />)}
      </datalist>
      {idiomas.length === 0 && (
        <div className="font-body text-[11px] text-inksoft mb-2">Ej: Español (Nativo), Quechua (Avanzado), Inglés (Intermedio).</div>
      )}
      <div className="flex flex-col gap-1.5">
        {idiomas.map((x, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={x.idioma}
              onChange={(e) => onIdiomasChange(idiomas.map((y, j) => (j === i ? { ...y, idioma: e.target.value } : y)))}
              placeholder="Idioma"
              className="w-[36%] px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
            />
            <input
              value={x.nivel}
              list="niveles-idioma"
              onChange={(e) => onIdiomasChange(idiomas.map((y, j) => (j === i ? { ...y, nivel: e.target.value } : y)))}
              placeholder="Nivel (ej: Avanzado)"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel"
            />
            <button type="button" onClick={() => onIdiomasChange(idiomas.filter((_, j) => j !== i))} className="px-2 text-inksoft hover:text-maroon">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
