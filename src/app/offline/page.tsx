import { MarcaClasiClick } from '@/components/LogoClasiClick'

export const metadata = { title: 'Sin conexión — Clasi Click', robots: { index: false } }

// La muestra la app instalada cuando no hay internet (ver public/sw.js).
export default function Offline() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <MarcaClasiClick size={72} />
      <div className="font-display text-xl font-bold text-ink mt-4">Sin conexión</div>
      <p className="font-body text-sm text-inksoft mt-2 max-w-xs">No hay internet en este momento. Revisá tu conexión y volvé a intentar.</p>
      <a href="/" className="mt-5 px-5 py-2.5 rounded-lg bg-ink text-white font-body text-sm font-semibold no-underline">Reintentar</a>
    </div>
  )
}
