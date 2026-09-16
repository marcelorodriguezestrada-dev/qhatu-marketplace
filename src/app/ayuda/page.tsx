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


  const [formNombre, setFormNombre] = useState('')
  const [formCelular, setFormCelular] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formTienda, setFormTienda] = useState('')
  const [formMensaje, setFormMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  async function enviarSolicitud() {
    if (!formCelular.trim() && !formEmail.trim()) {
      setErrorForm('Necesitamos al menos tu celular o email para contactarte.')
      return
    }
    setEnviando(true); setErrorForm('')
    try {
      const res = await fetch('/api/solicitud-ayuda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre, celular: formCelular,
          email: formEmail, tienda: formTienda, mensaje: formMensaje
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEnviado(true)
    } catch (e: any) {
      setErrorForm(e.message || 'Error al enviar. Intentá de nuevo.')
    } finally { setEnviando(false) }
  }


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


        {/* ── Formulario de contacto ── */}
        <div className="mt-12 bg-panel border border-line rounded-2xl p-6 max-w-lg mx-auto">
          <div className="text-center mb-6">
            <p className="text-3xl mb-2">📞</p>
            <h2 className="font-display text-xl font-bold text-ink mb-1">¿Necesitás ayuda para subir tu negocio?</h2>
            <p className="font-body text-sm text-inksoft">
              Dejanos tus datos y te contactamos para ayudarte a publicar tu tienda, tus productos o tu servicio. Sin costo.
            </p>
          </div>

          {enviado ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-display font-bold text-ink text-lg mb-1">¡Recibimos tu mensaje!</p>
              <p className="font-body text-sm text-inksoft">
                Nos vamos a comunicar con vos a la brevedad para ayudarte a publicar.
              </p>
              <button onClick={() => { setEnviado(false); setFormNombre(''); setFormCelular(''); setFormEmail(''); setFormTienda(''); setFormMensaje('') }}
                className="mt-4 font-body text-sm text-maroon underline">
                Enviar otra consulta
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-body text-xs text-inksoft mb-1 block font-semibold">Tu nombre</label>
                <input
                  className="w-full border border-line rounded-xl px-3.5 py-2.5 font-body text-sm text-ink bg-panelalt"
                  placeholder="¿Cómo te llamás?"
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-xs text-inksoft mb-1 block font-semibold">
                    Celular <span className="text-maroon">*</span>
                  </label>
                  <input
                    className="w-full border border-line rounded-xl px-3.5 py-2.5 font-body text-sm text-ink bg-panelalt"
                    placeholder="Ej: 75263557"
                    type="tel"
                    value={formCelular}
                    onChange={e => setFormCelular(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-inksoft mb-1 block font-semibold">
                    Email <span className="text-inksoft font-normal">(opcional)</span>
                  </label>
                  <input
                    className="w-full border border-line rounded-xl px-3.5 py-2.5 font-body text-sm text-ink bg-panelalt"
                    placeholder="tu@email.com"
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-body text-xs text-inksoft mb-1 block font-semibold">
                  Nombre de tu tienda o negocio <span className="text-inksoft font-normal">(opcional)</span>
                </label>
                <input
                  className="w-full border border-line rounded-xl px-3.5 py-2.5 font-body text-sm text-ink bg-panelalt"
                  placeholder="Ej: Ropa Mary, Ferretería Don Carlos..."
                  value={formTienda}
                  onChange={e => setFormTienda(e.target.value)}
                />
              </div>

              <div>
                <label className="font-body text-xs text-inksoft mb-1 block font-semibold">
                  ¿En qué necesitás ayuda?
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-line rounded-xl px-3.5 py-2.5 font-body text-sm text-ink bg-panelalt resize-none"
                  placeholder="Ej: Quiero subir mi tienda de ropa, tengo muchos productos y no sé cómo empezar..."
                  value={formMensaje}
                  onChange={e => setFormMensaje(e.target.value)}
                />
              </div>

              {errorForm && (
                <p className="font-body text-sm text-maroon bg-maroonsoft rounded-lg px-3 py-2">{errorForm}</p>
              )}

              <button
                onClick={enviarSolicitud}
                disabled={enviando}
                className="w-full py-3 rounded-xl bg-maroon text-white font-body font-semibold text-sm disabled:opacity-40 transition-opacity"
              >
                {enviando ? '⟳ Enviando...' : '📲 Quiero que me ayuden a publicar'}
              </button>

              <p className="font-body text-xs text-inksoft text-center">
                * Al menos celular o email es obligatorio para poder contactarte.
              </p>
            </div>
          )}
        </div>

    </div>
  )
}