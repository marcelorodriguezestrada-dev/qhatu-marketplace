import Link from 'next/link'
import { LogoClasiClick } from '@/components/LogoClasiClick'

const enlaces = [
  {
    titulo: 'Compradores',
    items: [
      { href: '/', texto: 'Buscar productos' },
      { href: '/mis-pedidos', texto: 'Mis pedidos' },
      { href: '/ayuda', texto: 'Centro de ayuda' },
    ],
  },
  {
    titulo: 'Vendedores',
    items: [
      { href: '/vender', texto: 'Vender en Clasi Click' },
      { href: '/mis-pedidos', texto: 'Pedidos recibidos' },
    ],
  },
  {
    titulo: 'Legal',
    items: [
      { href: '/terminos', texto: 'Términos y condiciones' },
      { href: '/privacidad', texto: 'Política de privacidad' },
      { href: '/devoluciones', texto: 'Política de devoluciones' },
      { href: '/ayuda', texto: 'Centro de ayuda' },
      { href: '/eliminar-cuenta', texto: 'Eliminar mi cuenta' },
    ],
  },
]

export default function FooterLegal() {
  return (
    <footer className="mt-12 bg-marca text-white">
      <div className="max-w-[1180px] mx-auto px-5 py-9 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" aria-label="Clasi Click — inicio" className="inline-block">
            <LogoClasiClick size={32} />
          </Link>
          <p className="font-body text-xs leading-5 text-white/70 mt-3 max-w-xs">
            Marketplace de productos, servicios y anuncios en Bolivia y Argentina.
          </p>
        </div>
        {enlaces.map((grupo) => (
          <nav key={grupo.titulo} aria-label={grupo.titulo}>
            <h2 className="font-display text-sm font-bold mb-3">{grupo.titulo}</h2>
            <ul className="space-y-2.5">
              {grupo.items.map((item) => (
                <li key={`${grupo.titulo}-${item.href}-${item.texto}`}>
                  <Link href={item.href} className="font-body text-xs text-white/70 hover:text-white underline-offset-2 hover:underline">
                    {item.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1180px] mx-auto px-5 py-3 font-body text-[11px] text-white/60">
          © 2026 Clasi Click
        </div>
      </div>
    </footer>
  )
}
