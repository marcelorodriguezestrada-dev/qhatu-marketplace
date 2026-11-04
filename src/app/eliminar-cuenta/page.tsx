import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Eliminar cuenta y datos | Clasi Click',
  description: 'Cómo solicitar la eliminación de una cuenta de Clasi Click.',
}

export default function EliminarCuentaPage() {
  return (
    <main className="max-w-[800px] mx-auto px-5 py-10">
      <Link href="/" className="font-body text-sm text-inksoft hover:underline">← Volver a Clasi Click</Link>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-5 mb-2">
        Eliminación de cuenta y datos
      </h1>
      <p className="font-body text-sm text-inksoft mb-2">Clasi Click — Bolivia y Argentina.</p>
      <p className="font-body text-xs text-inksoft mb-8">Última actualización: 4 de noviembre de 2026</p>

      <section className="mb-7">
        <h2 className="font-display text-lg font-bold text-ink mb-2">Cómo solicitarla</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          Actualmente no hay una opción de autoeliminación dentro de la aplicación. Para solicitar la eliminación de tu cuenta, escribí a{' '}
          <a className="text-maroon underline" href="mailto:clasiclick.info@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta">
            clasiclick.info@gmail.com
          </a>
          {' '}desde el correo asociado a tu cuenta e indicá que querés eliminarla. No envíes tu contraseña.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="font-display text-lg font-bold text-ink mb-2">Qué tener en cuenta</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          El sistema de administración puede eliminar el acceso de Firebase Authentication, pero esa acción no borra automáticamente los pedidos, productos ni perfiles asociados. Por eso, eliminar el acceso no equivale por sí solo a eliminar todos los datos relacionados. No hay un plazo automático de borrado configurado en la Plataforma.
        </p>
      </section>

      <section className="border-t border-line pt-6">
        <h2 className="font-display text-lg font-bold text-ink mb-2">Contacto</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          Si tenés preguntas sobre la solicitud, escribinos a{' '}
          <a className="text-maroon underline" href="mailto:clasiclick.info@gmail.com">clasiclick.info@gmail.com</a>.
          También podés consultar el <Link href="/privacidad" className="text-maroon underline">Aviso de Privacidad</Link>.
        </p>
      </section>
    </main>
  )
}
