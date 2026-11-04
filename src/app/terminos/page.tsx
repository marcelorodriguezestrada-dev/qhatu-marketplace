import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Clasi Click',
  description: 'Términos y condiciones de uso de Clasi Click para Argentina.',
}

const SECCIONES = [
  {
    titulo: '1. Qué es Clasi Click',
    parrafos: [
      'Clasi Click es una plataforma que conecta a vendedores con compradores en Argentina. Clasi Click actúa como intermediario tecnológico: no fabrica ni posee los productos publicados. La operación de compraventa se realiza entre el comprador y el vendedor correspondiente.',
    ],
  },
  {
    titulo: '2. Registro y cuentas',
    parrafos: [
      'Para utilizar las funciones que requieren una cuenta, debés registrarte con datos verídicos. Sos responsable de mantener la confidencialidad de tu contraseña y de la actividad realizada desde tu cuenta.',
      'La Plataforma requiere verificar el correo electrónico para ingresar. Clasi Click puede suspender o cancelar cuentas que incumplan estos términos, brinden información falsa o utilicen la Plataforma de forma fraudulenta.',
    ],
  },
  {
    titulo: '3. Publicación de productos',
    parrafos: [
      'Los vendedores son responsables de la exactitud de la información publicada, incluidos precio, stock, descripción, imágenes y variantes.',
      'Está prohibido publicar productos ilegales o que infrinjan derechos de propiedad intelectual de terceros. Clasi Click puede revisar, aprobar, rechazar o dar de baja publicaciones que no cumplan estas condiciones.',
      'El vendedor es responsable de la calidad, garantía y cumplimiento de la normativa aplicable a los productos que ofrece.',
    ],
  },
  {
    titulo: '4. Compras y pagos',
    parrafos: [
      'Los medios de pago habilitados para Argentina se informan en el checkout antes de confirmar la compra. Los pagos y las actualizaciones del pedido siguen el flujo disponible en la Plataforma.',
      'Los precios se muestran en pesos argentinos (ARS).',
    ],
  },
  {
    titulo: '5. Reseñas',
    parrafos: [
      'Las reseñas deben reflejar una experiencia real. Clasi Click puede moderar o eliminar reseñas falsas o que incumplan estos términos.',
    ],
  },
  {
    titulo: '6. Propiedad intelectual',
    parrafos: [
      'El nombre Clasi Click, su logo y el diseño de la Plataforma pertenecen a sus titulares y no pueden utilizarse sin autorización. El contenido publicado por los usuarios sigue siendo de quien lo publica, quien autoriza a Clasi Click a exhibirlo dentro de la Plataforma para operar el marketplace.',
    ],
  },
  {
    titulo: '7. Disponibilidad y responsabilidad',
    parrafos: [
      'Clasi Click no garantiza la disponibilidad ininterrumpida de la Plataforma. En su carácter de intermediario tecnológico, no es parte de la compraventa entre comprador y vendedor ni responde por incumplimientos atribuibles a esas partes.',
    ],
  },
  {
    titulo: '8. Modificaciones',
    parrafos: [
      'Clasi Click puede modificar estos términos. Los cambios se publicarán en esta página con la fecha de actualización correspondiente.',
    ],
  },
]

export default function TerminosPage() {
  return (
    <main className="max-w-[800px] mx-auto px-5 py-10">
      <Link href="/" className="font-body text-sm text-inksoft hover:underline">
        ← Volver a Clasi Click
      </Link>

      <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-5 mb-2">
        Términos y Condiciones de Clasi Click
      </h1>
      <p className="font-body text-sm text-inksoft mb-2">
        Aplicables al uso de la Plataforma en Argentina.
      </p>
      <p className="font-body text-xs text-inksoft mb-8">
        Última actualización: 4 de noviembre de 2026
      </p>

      <div className="rounded-xl border border-line bg-panel p-5 mb-8 font-body text-sm text-ink">
        Estos términos regulan el uso de Clasi Click, operada por Marcelo Rodriguez Estrada
        (CUIT 20-19045419-4). Al registrarte o utilizar la Plataforma en Argentina, aceptás
        estos términos.
      </div>

      <div className="space-y-7">
        {SECCIONES.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="font-display text-lg font-bold text-ink mb-2">{seccion.titulo}</h2>
            <div className="space-y-3">
              {seccion.parrafos.map((parrafo) => (
                <p key={parrafo} className="font-body text-sm leading-6 text-inksoft">
                  {parrafo}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="font-display text-lg font-bold text-ink mb-2">9. Contacto</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          Para consultas sobre estos términos:{' '}
          <a className="text-maroon underline" href="mailto:clasiclick.info@gmail.com">
            clasiclick.info@gmail.com
          </a>
        </p>
      </section>
    </main>
  )
}
