import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Devoluciones y cancelaciones | Clasi Click',
  description: 'Información sobre pedidos, cancelaciones y consultas de devolución en Clasi Click.',
}

const SECCIONES = [
  {
    titulo: '1. Cancelar antes del pago',
    texto: 'El checkout permite anular un pedido que todavía está pendiente de pago o de confirmación de stock, mientras no se haya informado un pago. Si ya informaste el pago o el pedido avanzó, la cancelación no está disponible desde ese flujo.',
  },
  {
    titulo: '2. Pedido cancelado después del pago',
    texto: 'La Plataforma no realiza una devolución automática del dinero al cambiar un pedido a cancelado. Si ya pagaste y el pedido fue cancelado, contactá al vendedor y a Clasi Click para coordinar la revisión de tu caso. En el seguimiento del pedido también se indica que podés escribirnos si falta la devolución.',
  },
  {
    titulo: '3. Producto con un problema',
    texto: 'Para informar que un producto no llegó o que hay un problema con lo recibido, contactá al vendedor mediante los datos de contacto publicados en su tienda o perfil y escribinos desde el Centro de Ayuda. Clasi Click no tiene actualmente un chat interno ni un flujo de disputa en la Plataforma.',
  },
  {
    titulo: '4. Cambios y devoluciones de productos',
    texto: 'La Plataforma no define un plazo único ni un proceso automático de devolución de productos. Consultá las condiciones informadas por el vendedor y comunicate con él para acordar los pasos. Esta página no limita los derechos que correspondan bajo la normativa aplicable.',
  },
]

export default function DevolucionesPage() {
  return (
    <main className="max-w-[800px] mx-auto px-5 py-10">
      <Link href="/" className="font-body text-sm text-inksoft hover:underline">← Volver a Clasi Click</Link>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-5 mb-2">
        Política de Devoluciones y Cancelaciones — Clasi Click
      </h1>
      <p className="font-body text-sm text-inksoft mb-2">Aplicable en Bolivia y Argentina.</p>
      <p className="font-body text-xs text-inksoft mb-8">Última actualización: 4 de noviembre de 2026</p>
      <p className="font-body text-sm leading-6 text-inksoft mb-7">
        Las opciones de pago, entrega y seguimiento dependen del país, la ciudad y el vendedor. Esta página describe las opciones que hoy ofrece Clasi Click; no establece plazos o garantías que no estén implementados en la Plataforma.
      </p>

      <div className="space-y-7">
        {SECCIONES.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="font-display text-lg font-bold text-ink mb-2">{seccion.titulo}</h2>
            <p className="font-body text-sm leading-6 text-inksoft">{seccion.texto}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="font-display text-lg font-bold text-ink mb-2">5. Contacto</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          <Link href="/ayuda" className="text-maroon underline">Centro de Ayuda</Link>
          {' '}o escribinos a{' '}
          <a className="text-maroon underline" href="mailto:clasiclick.info@gmail.com">clasiclick.info@gmail.com</a>.
        </p>
      </section>
    </main>
  )
}
