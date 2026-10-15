'use client'

import { useState } from 'react'
import { SITE_URL } from '@/lib/sitio'

// Admin → Marketing: los links de los catálogos (feeds) para conectar una
// sola vez en Google Merchant Center y Meta Commerce Manager. Se
// actualizan solos cada hora con los productos activos.
const FEEDS = [
  {
    id: 'google',
    titulo: '🔎 Google Shopping (listados gratis)',
    url: `${SITE_URL}/feed/google.xml`,
    pasos: [
      'Entrá a merchants.google.com con tu cuenta de Google y creá la cuenta de Clasi Click (país de venta: Bolivia).',
      'Verificá el sitio www.clasiclick.com (podés usar la misma verificación de Search Console).',
      'Productos → Fuentes de datos → Agregar fuente → "Archivo programado" → pegá este link, frecuencia diaria.',
      'Activá "Listados gratuitos" en Crecimiento → Administrar programas.',
    ],
  },
  {
    id: 'meta',
    titulo: '📘 Facebook e Instagram (catálogo)',
    url: `${SITE_URL}/feed/meta.csv`,
    pasos: [
      'Entrá a business.facebook.com/commerce → Agregar catálogo → Comercio electrónico.',
      'Fuentes de datos → Agregar artículos → Lista de datos → "Usar una URL" → pegá este link, actualización diaria.',
      'Conectá el catálogo a la página de Facebook y a Instagram para etiquetar productos en las publicaciones.',
    ],
  },
]

export default function CatalogosFeed() {
  const [copiado, setCopiado] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="font-body text-sm font-semibold text-ink mb-1">📦 Tus productos en Google Shopping, Facebook e Instagram</div>
      <div className="font-body text-[12px] text-inksoft mb-3">
        Conectá estos links una sola vez y tus productos aparecen gratis en la pestaña Shopping de Google y en el catálogo de Facebook / Instagram. Se actualizan solos cada hora. Las visitas llegan con UTM (utm_source=google / meta).
      </div>
      <div className="grid gap-2">
        {FEEDS.map((f) => (
          <div key={f.id} className="bg-panelalt rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-body text-sm font-semibold text-ink flex-1 min-w-[200px]">{f.titulo}</div>
              <a href={f.url} target="_blank" rel="noreferrer" className="font-body text-[11px] text-teal underline">Ver</a>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(f.url); setCopiado(f.id); setTimeout(() => setCopiado(''), 1500) }} className="px-2.5 py-1 rounded-md border border-line bg-panel font-body text-[11px]">
                {copiado === f.id ? '✓ Copiado' : '📋 Copiar link'}
              </button>
              <button type="button" onClick={() => setAbierto(abierto === f.id ? null : f.id)} className="font-body text-[11px] text-inksoft underline">{abierto === f.id ? 'Ocultar pasos' : 'Cómo conectarlo'}</button>
            </div>
            <div className="font-mono text-[11px] text-inksoft mt-1 break-all">{f.url}</div>
            {abierto === f.id && (
              <ol className="font-body text-xs text-ink mt-2 pl-4 grid gap-1">
                {f.pasos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
