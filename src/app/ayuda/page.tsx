'use client'

import Link from 'next/link'
import { useState } from 'react'

type Seccion = {
  id: string
  titulo: string
  emoji: string
  contenido: { pregunta: string; respuesta: string }[]
}

const SECCIONES: Seccion[] = [
  {
    id: 'comprar',
    titulo: 'Comprar',
    emoji: '🛍️',
    contenido: [
      {
        pregunta: '¿Cómo compro un producto?',
        respuesta:
          'Entrá al producto que te interesa, elegí talla y color si el producto lo pide, y tocá "Agregar al carrito" o "Comprar". Cada tienda se paga por separado — si comprás de varias tiendas, vas a hacer un pago por cada una.',
      },
      {
        pregunta: '¿Qué formas de entrega hay?',
        respuesta:
          'Envío a domicilio (el vendedor confirma que tiene stock antes de mostrarte el QR, y el pago va a la cuenta de Clasi Click hasta que se confirma la entrega) o Retiro en tienda (coordinás vos directo con el vendedor).',
      },
      {
        pregunta: '¿Puedo pagar en efectivo?',
        respuesta:
          'Sí, eligiendo "Retiro en tienda" y después "Efectivo" — te llevamos directo a WhatsApp con el vendedor para coordinar cuándo pasás a buscarlo y pagarlo en mano.',
      },
      {
        pregunta: '¿Y si pago por QR?',
        respuesta:
          'Con envío, el QR es siempre de Clasi Click (no del vendedor) — así protegemos tu compra hasta que se confirma que te llegó todo bien. Con retiro en tienda, en cambio, pagás directo al vendedor.',
      },
    ],
  },
  {
    id: 'vender-productos',
    titulo: 'Vender productos',
    emoji: '📦',
    contenido: [
      {
        pregunta: '¿Cómo publico un producto?',
        respuesta: 'Entrá a "Vender" desde el menú, elegí Productos, y completá nombre, precio, fotos, talles y colores si aplica.',
      },
      {
        pregunta: '¿Puedo cargar varios talles de una?',
        respuesta:
          'Sí, podés escribir un rango como "34-38" y el sistema lo separa solo en talles individuales (34, 35, 36, 37, 38) para que el comprador elija uno específico.',
      },
      {
        pregunta: '¿Qué es la membresía Premium?',
        respuesta:
          'Te deja subir fotos adicionales para mostrar mejor tus productos, y te destaca en los resultados de búsqueda.',
      },
      {
        pregunta: '¿Cómo cobro mis ventas?',
        respuesta:
          'Con retiro en tienda, cobrás directo del comprador. Con envío, la plata primero entra a la cuenta de Clasi Click como garantía, y se te transfiere una vez confirmada la entrega.',
      },
    ],
  },
  {
    id: 'servicios',
    titulo: 'Servicios profesionales',
    emoji: '🧰',
    contenido: [
      {
        pregunta: '¿Cómo busco un profesional?',
        respuesta:
          'Entrá a "Servicios", elegí la categoría (Salud, Belleza, Educación, etc.) y después el rubro específico. También podés ver el mapa para encontrar a los más cercanos a vos.',
      },
      {
        pregunta: '¿Cómo publico mis servicios?',
        respuesta:
          'Desde "Publicá tu servicio" cargás tu rubro, zona, descripción y WhatsApp. Todo profesional pasa por una revisión antes de aparecer públicamente — es una garantía que le damos a quien te contacta.',
      },
      {
        pregunta: '¿Qué es el "macheo" automático?',
        respuesta:
          'Cuando alguien publica un anuncio buscando un servicio de tu mismo rubro, te avisamos automáticamente (por mail y dentro de la app) para que puedas contactarlo antes que nadie.',
      },
    ],
  },
  {
    id: 'anuncios',
    titulo: 'Anuncios clasificados',
    emoji: '📢',
    contenido: [
      {
        pregunta: '¿Qué son los anuncios?',
        respuesta:
          'Es la sección para publicar algo que no encaja como producto ni como servicio profesional: "vendo", "busco", o un aviso general. Cualquier usuario logueado puede publicar uno.',
      },
      {
        pregunta: '¿Se publican al toque?',
        respuesta: 'No — pasan por una revisión antes de mostrarse, igual que los productos y servicios.',
      },
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Tu cuenta',
    emoji: '👤',
    contenido: [
      {
        pregunta: '¿Por qué me piden verificar el mail?',
        respuesta:
          'Al crear tu cuenta te mandamos un código de 6 dígitos por mail — es para confirmar que la dirección es tuya de verdad, y evitar cuentas falsas en la plataforma.',
      },
      {
        pregunta: 'Me olvidé la contraseña, ¿qué hago?',
        respuesta: 'En la pantalla de inicio de sesión, tocá "¿Olvidaste tu contraseña?" y te mandamos un link para elegir una nueva.',
      },
    ],
  },
]

export default function AyudaPage() {
  const [abierta, setAbierta] = useState<string | null>(null)

  return (
    <div className="max-w-[720px] mx-auto px-5 py-10">
      <Link href="/" className="font-body text-sm text-inksoft hover:underline">← Volver a Clasi Click</Link>

      <div className="font-display text-2xl font-bold text-ink mt-4 mb-1.5">Centro de ayuda</div>
      <div className="font-body text-sm text-inksoft mb-8">
        Todo lo que necesitás saber sobre cómo funciona Clasi Click, para comprar, vender o publicar tus servicios.
      </div>

      {/* Índice rápido para saltar directo a la sección que buscás,
          en vez de scrollear todo — útil sobre todo en celular. */}
      <div className="flex gap-2 flex-wrap mb-8">
        {SECCIONES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3.5 py-1.5 rounded-full border border-line bg-panel font-body text-xs font-medium text-inksoft"
          >
            {s.emoji} {s.titulo}
          </a>
        ))}
      </div>

      {SECCIONES.map((seccion) => (
        <div key={seccion.id} id={seccion.id} className="mb-9 scroll-mt-6">
          <div className="font-display text-lg font-bold text-ink mb-3">
            {seccion.emoji} {seccion.titulo}
          </div>
          <div className="border border-line rounded-xl overflow-hidden">
            {seccion.contenido.map((item, i) => {
              const clave = `${seccion.id}-${i}`
              const estaAbierta = abierta === clave
              return (
                <div key={clave} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setAbierta(estaAbierta ? null : clave)}
                    className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 bg-panel"
                  >
                    <span className="font-body text-sm font-medium text-ink">{item.pregunta}</span>
                    <span className="font-body text-inksoft text-lg shrink-0">{estaAbierta ? '−' : '+'}</span>
                  </button>
                  {estaAbierta && (
                    <div className="px-4 pb-4 font-body text-sm text-inksoft bg-panel">{item.respuesta}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-panelalt border border-line rounded-xl p-5 text-center mt-10">
        <div className="font-body text-sm text-ink mb-1">¿No encontraste lo que buscabas?</div>
        <div className="font-body text-xs text-inksoft">Escribinos directo por WhatsApp y te ayudamos.</div>
      </div>
    </div>
  )
}
