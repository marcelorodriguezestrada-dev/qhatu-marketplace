import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Clasi Click',
  description: 'Información sobre los datos utilizados por Clasi Click en Bolivia y Argentina.',
}

const SECCIONES = [
  {
    titulo: '1. Datos que se usan en la Plataforma',
    parrafos: [
      'Al crear una cuenta, Firebase Authentication administra el correo electrónico y las credenciales de acceso. Clasi Click no guarda la contraseña en su base de datos propia. El registro también solicita un número de celular. En “Mi cuenta” podés guardar tu nombre y WhatsApp.',
      'Al realizar un pedido, la Plataforma puede guardar el correo de la cuenta, nombre y WhatsApp de contacto, productos, cantidades, precios, país, ciudad, forma de entrega y pago, y el estado del pedido. Si elegís envío, también se usan los datos que ingresás para entregarlo, como zona, dirección, referencias y, si compartís ubicación, sus coordenadas.',
      'Si iniciás sesión, algunos datos de entrega que ingresás en el checkout se guardan en tu cuenta para facilitar futuras compras. Cuando el pago requiere comprobante, se guarda la imagen o el enlace del archivo asociado al pedido.',
      'La Plataforma también contiene perfiles profesionales, reservas de turnos, anuncios, preguntas y reseñas. Los datos que ingreses en esas funciones y el contenido publicado pueden incluir información de contacto, descripciones, imágenes o documentos que serán usados para mostrar o gestionar esa función.',
      'Al reservar un turno se guardan el nombre, fecha, hora y el medio de contacto que ingresaste (correo o WhatsApp); el profesional del turno puede consultar esos datos. El formulario del Centro de Ayuda guarda el nombre, celular, correo, tienda y mensaje que envíes.',
    ],
  },
  {
    titulo: '2. Métricas de uso',
    parrafos: [
      'Clasi Click registra contadores de visitas y de selecciones de categorías para conocer el uso general de la Plataforma. El contador de visitas no guarda la dirección IP ni el navegador; los clics de categorías se guardan como contadores, sin identificar a la persona que los hizo.',
    ],
  },
  {
    titulo: '3. Para qué se usan los datos',
    parrafos: [
      'Los datos se utilizan para crear y mantener cuentas, publicar contenido, gestionar pedidos y entregas, mostrar el estado de las compras, facilitar el contacto entre compradores y vendedores, responder consultas y mantener las métricas de funcionamiento de la Plataforma.',
    ],
  },
  {
    titulo: '4. Acceso y servicios utilizados',
    parrafos: [
      'Los vendedores pueden recibir los datos necesarios para atender un pedido, como nombre, teléfono, dirección de entrega y productos comprados. Los datos de contacto que el usuario publica en su tienda, perfil, producto, servicio o anuncio pueden ser visibles públicamente y utilizarse para comunicarse por WhatsApp.',
      'Clasi Click utiliza Firebase Authentication y Firestore para cuentas y datos de la Plataforma, ImgBB para alojar imágenes subidas y, cuando está configurado, Resend para ciertos correos electrónicos. El checkout muestra los medios de pago configurados para el país, vendedor y tipo de entrega; los comprobantes enviados quedan asociados al pedido. Los servicios externos procesan los datos que reciben según sus propias condiciones.',
    ],
  },
  {
    titulo: '5. Conservación y solicitudes',
    parrafos: [
      'La Plataforma no tiene publicado un plazo único de conservación ni un borrado automático general de cuentas, pedidos y publicaciones. Para consultar, corregir o solicitar la eliminación de tus datos, escribí a clasiclick.info@gmail.com desde el correo asociado a tu cuenta. La eliminación de la cuenta de acceso no implica por sí sola el borrado de pedidos, publicaciones u otros datos asociados.',
    ],
  },
  {
    titulo: '6. Alcance y cambios',
    parrafos: [
      'Esta política describe el funcionamiento implementado en Clasi Click para usuarios de Bolivia y Argentina. Si se agregan funciones o proveedores que cambien el uso de datos, esta página podrá actualizarse junto con su fecha.',
    ],
  },
]

export default function PrivacidadPage() {
  return (
    <main className="max-w-[800px] mx-auto px-5 py-10">
      <Link href="/" className="font-body text-sm text-inksoft hover:underline">← Volver a Clasi Click</Link>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-5 mb-2">
        Política de Privacidad de Clasi Click
      </h1>
      <p className="font-body text-sm text-inksoft mb-2">Aplicable en Bolivia y Argentina.</p>
      <p className="font-body text-xs text-inksoft mb-8">Última actualización: 4 de noviembre de 2026</p>

      <div className="rounded-xl border border-line bg-panel p-5 mb-8 font-body text-sm leading-6 text-ink">
        Clasi Click es operado por Marcelo Rodriguez Estrada (CUIT 20-19045419-4). Esta política explica qué datos se usan en el sitio y la aplicación.
      </div>

      <div className="space-y-7">
        {SECCIONES.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="font-display text-lg font-bold text-ink mb-2">{seccion.titulo}</h2>
            <div className="space-y-3">
              {seccion.parrafos.map((parrafo) => (
                <p key={parrafo} className="font-body text-sm leading-6 text-inksoft">{parrafo}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="font-display text-lg font-bold text-ink mb-2">7. Contacto</h2>
        <p className="font-body text-sm leading-6 text-inksoft">
          Para consultas sobre privacidad:{' '}
          <a className="text-maroon underline" href="mailto:clasiclick.info@gmail.com">clasiclick.info@gmail.com</a>
        </p>
      </section>
    </main>
  )
}
