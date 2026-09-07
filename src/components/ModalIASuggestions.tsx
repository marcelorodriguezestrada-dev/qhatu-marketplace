"use client"

import React from 'react'

type Suggestion = { title?: string; short?: string; long?: string }

export default function ModalIASuggestions({
  open,
  onClose,
  suggestions,
  onApply,
}: {
  open: boolean
  onClose: () => void
  suggestions: Suggestion[]
  onApply: (s: Suggestion) => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-panel border border-line rounded-lg p-4 mx-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-lg text-ink">Sugerencias generadas por IA</div>
          <button onClick={onClose} className="text-inksoft text-sm">Cerrar</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {suggestions.map((s, idx) => (
            <div key={idx} className="p-3 border rounded-lg bg-white/40 flex flex-col">
              <div className="font-body text-sm font-semibold text-ink mb-1">{s.title || 'Sin título'}</div>
              <div className="font-body text-xs text-inksoft mb-2">{s.short}</div>
              <div className="font-body text-[12px] text-inksoft mb-3 flex-1">{s.long}</div>
              <div className="mt-2">
                <button
                  onClick={() => onApply(s)}
                  className="w-full px-3 py-2 rounded-md bg-maroon text-white text-sm"
                >
                  Usar esta sugerencia
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
