'use client'

// Gráfico de barras minimalista, sin ninguna librería externa (el
// proyecto no tenía ninguna instalada — agregar una solo para esto
// hubiera significado tocar package.json y depender de que el build
// la instale bien). Alcanza y sobra para ver una tendencia de un
// vistazo: día más flojo, día más fuerte, si viene subiendo o bajando.
export function GraficoBarras({
  datos,
  formatoEtiqueta,
  color = 'var(--color-teal, #1a7f6e)',
}: {
  datos: { clave: string; valor: number }[]
  formatoEtiqueta?: (clave: string) => string
  color?: string
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor))

  if (datos.length === 0) {
    return <div className="font-body text-xs text-inksoft py-6 text-center">Todavía no hay datos para este período.</div>
  }

  return (
    <div className="flex items-end gap-[3px] h-36 overflow-x-auto pb-1">
      {datos.map((d) => (
        <div key={d.clave} className="flex flex-col items-center gap-1 shrink-0" style={{ width: datos.length > 40 ? 6 : 22 }}>
          <div
            title={`${formatoEtiqueta ? formatoEtiqueta(d.clave) : d.clave}: ${d.valor.toLocaleString('es-BO')}`}
            className="w-full rounded-t"
            style={{
              height: `${Math.max(2, (d.valor / max) * 100)}%`,
              backgroundColor: color,
              opacity: d.valor === 0 ? 0.15 : 1,
            }}
          />
          {datos.length <= 40 && (
            <div className="font-body text-[9px] text-inksoft whitespace-nowrap">
              {formatoEtiqueta ? formatoEtiqueta(d.clave) : d.clave}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
