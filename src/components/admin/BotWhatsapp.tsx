'use client'

import { useEffect, useState } from 'react'
import { SITE_URL } from '@/lib/sitio'

type ActividadWhatsapp = {
  id: string
  numero?: string
  esAdmin?: boolean
  estado?: string
  at?: string | null
  productoId?: string
  productoNombre?: string
  tiendaNombre?: string
  error?: string
}

// Admin → Productos: estado, diagnóstico y pasos para conectar el bot de WhatsApp
// (src/lib/whatsappBot.ts) con la API oficial de Meta.
const VARIABLES = [
  { id: 'WHATSAPP_TOKEN', que: 'Token permanente (usuario del sistema) de la app de Meta', obligatoria: true },
  { id: 'WHATSAPP_PHONE_NUMBER_ID', que: 'Identificador del número de teléfono (WhatsApp → Configuración de la API)', obligatoria: true },
  { id: 'WHATSAPP_APP_SECRET', que: 'Clave secreta de la app (Configuración de la app → Básica)', obligatoria: true },
  { id: 'WHATSAPP_VERIFY_TOKEN', que: 'Una palabra que inventás vos; la misma va en Meta al configurar el webhook', obligatoria: true },
  { id: 'WHATSAPP_ADMINS', que: 'Tu número con código de país (ej. 59171234567), separados por coma si son varios', obligatoria: false },
  { id: 'GROQ_API_KEY', que: 'IA que entiende los mensajes', obligatoria: true },
  { id: 'IMGBB_API_KEY', que: 'Donde se guardan las fotos', obligatoria: true },
  { id: 'GEMINI_API_KEY', que: 'Opcional: mira la foto para elegir la categoría', obligatoria: false },
]

export default function BotWhatsapp({ password }: { password: string }) {
  const [vars, setVars] = useState<Record<string, boolean> | null>(null)
  const [estado, setEstado] = useState<Record<string, any>>({})
  const [admins, setAdmins] = useState<string[]>([])
  const [actividad, setActividad] = useState<ActividadWhatsapp[]>([])
  const [errorCarga, setErrorCarga] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const webhook = `${SITE_URL}/api/whatsapp`

  const cargar = async () => {
    try {
      const r = await fetch('/api/admin/whatsapp', { headers: { 'x-admin-password': password } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar el estado de WhatsApp.')
      setVars(d.variables || {})
      setEstado(d.estado || {})
      setAdmins(Array.isArray(d.admins) ? d.admins : [])
      setActividad(Array.isArray(d.actividad) ? d.actividad : [])
      setErrorCarga('')
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'No se pudo cargar el estado de WhatsApp.')
    }
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])
  const cuando = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
  const sinAvisos = !estado.ultimoAviso && !estado.ultimoRechazo
  const porNumero = new Map<string, { esAdmin: boolean; cantidad: number; ultima: string; tienda?: string }>()
  for (const fila of actividad) {
    if (!fila.numero) continue
    const previo = porNumero.get(fila.numero)
    if (previo) {
      previo.cantidad += 1
      if (!previo.ultima || String(fila.at || '') > previo.ultima) previo.ultima = String(fila.at || '')
      previo.tienda ||= fila.tiendaNombre
    } else {
      porNumero.set(fila.numero, { esAdmin: !!fila.esAdmin, cantidad: 1, ultima: String(fila.at || ''), tienda: fila.tiendaNombre })
    }
  }
  const estadoActividad: Record<string, string> = {
    recibida: 'Foto recibida',
    procesando: 'Procesando foto',
    sin_tienda: 'Sin tienda asociada',
    error: 'Error al guardar',
    cancelado: 'Cancelado',
    producto_creado: 'Producto creado',
  }

  const listo = vars && VARIABLES.filter((v) => v.obligatoria).every((v) => vars[v.id])
  return (
    <div className="bg-panel border border-line rounded-xl p-5 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-body text-sm font-semibold text-ink">📲 Bot de WhatsApp para cargar productos</div>
        {vars && <span className={`font-body text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${listo ? 'bg-tealsoft text-teal' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{listo ? '🟢 Configurado' : '🟡 Falta configurar'}</span>}
      </div>
      <div className="font-body text-[12px] text-inksoft mb-3">
        Los vendedores (y vos) le escriben al número del bot: una foto con “Remera 15000 talles S M L” crea el producto, y “precio buzo 14000”, “sin stock jean” u “ocultar remera” lo cambian. Siempre pide ✅ antes de guardar. Cada vendedor solo toca su tienda (lo reconoce por el WhatsApp de su tienda); vos elegís la tienda con “tienda Nombre”.
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <code className="font-mono text-xs bg-panelalt rounded px-2 py-1.5 break-all">{webhook}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(webhook).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }).catch(() => {}) }} className="px-3 py-1.5 rounded-lg border border-line bg-panel font-body text-xs">{copiado ? '✓ Copiado' : '📋 Copiar URL del webhook'}</button>
        <button type="button" onClick={() => setAbierto((x) => !x)} className="font-body text-xs text-teal underline bg-transparent border-none">{abierto ? 'Ocultar pasos' : 'Cómo conectarlo'}</button>
      </div>

      {vars && (
        <div className="grid gap-1 mb-2">
          {VARIABLES.map((v) => (
            <div key={v.id} className="flex items-start gap-2 font-body text-[12px]">
              <span>{vars[v.id] ? '✅' : v.obligatoria ? '❌' : '➖'}</span>
              <code className="font-mono text-[11px] text-ink">{v.id}</code>
              <span className="text-inksoft">— {v.que}</span>
            </div>
          ))}
        </div>
      )}

      {vars && (
        <section className="bg-panelalt rounded-lg p-3 mt-3 font-body text-[12px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-ink">👥 Números y actividad de carga</span>
            <button type="button" onClick={cargar} className="font-body text-[11px] text-teal underline bg-transparent border-none">Actualizar actividad</button>
          </div>
          <p className="text-inksoft mb-3">Los administradores salen de <code>WHATSAPP_ADMINS</code>. El registro muestra quién envió fotos y qué productos llegaron a crearse.</p>
          {errorCarga && <p className="text-maroon mb-2">No se pudo cargar el registro: {errorCarga}</p>}

          <div className="mb-3">
            <div className="font-semibold text-ink mb-1">Administradores autorizados ({admins.length})</div>
            {admins.length
              ? <div className="flex flex-wrap gap-1.5">{admins.map((n) => <span key={n} className="rounded-full border border-line bg-panel px-2 py-1 font-mono">+{n}</span>)}</div>
              : <span className="text-amber-700">No hay números en WHATSAPP_ADMINS.</span>}
          </div>

          <div className="font-semibold text-ink mb-1">Números que usaron el bot</div>
          {porNumero.size
            ? <div className="grid gap-1 mb-3">{Array.from(porNumero.entries()).map(([numero, info]) => (
              <div key={numero} className="flex flex-wrap gap-x-2">
                <span>{info.esAdmin ? '🛠️ Admin' : '🧑‍💼 Vendedor/cliente'}</span>
                <span className="font-mono">+{numero}</span>
                <span className="text-inksoft">· {info.cantidad} carga(s) · última: {cuando(info.ultima)}{info.tienda ? ` · ${info.tienda}` : ''}</span>
              </div>
            ))}</div>
            : <p className="text-inksoft mb-3">Todavía no hay fotos registradas.</p>}

          <div className="font-semibold text-ink mb-1">Actividad reciente</div>
          {actividad.length
            ? <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead><tr className="text-inksoft border-b border-line"><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3">Quién</th><th className="py-1 pr-3">Tienda</th><th className="py-1 pr-3">Resultado</th></tr></thead>
                <tbody>{actividad.map((fila) => (
                  <tr key={fila.id} className="border-b border-line/60 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{cuando(fila.at)}</td>
                    <td className="py-1.5 pr-3"><span>{fila.esAdmin ? '🛠️ Admin' : 'Vendedor/cliente'}</span><br /><span className="font-mono">+{fila.numero || '—'}</span></td>
                    <td className="py-1.5 pr-3">{fila.tiendaNombre || '—'}</td>
                    <td className="py-1.5 pr-3">
                      {fila.productoId
                        ? <a className="text-teal underline" href={`${SITE_URL}/producto/${fila.productoId}`} target="_blank" rel="noreferrer">{fila.productoNombre || 'Producto creado'}</a>
                        : estadoActividad[fila.estado || ''] || fila.estado || '—'}
                      {fila.error && <div className="text-maroon">{fila.error}</div>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            : <p className="text-inksoft">Las fotos nuevas y los productos que ya se cargaron por WhatsApp aparecerán acá.</p>}
        </section>
      )}

      {vars && (
        <div className="bg-panelalt rounded-lg p-3 mt-3 grid gap-1.5 font-body text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">🩺 Qué está llegando de Meta</span>
            <button type="button" onClick={cargar} className="font-body text-[11px] text-teal underline bg-transparent border-none">Actualizar</button>
          </div>
          {sinAvisos ? (
            <div className="text-amber-700">Meta todavía no mandó ningún mensaje al servidor. Revisá en Meta → WhatsApp → Configuración → Webhook que el campo <b>messages</b> esté <b>suscripto</b>, y que el mensaje lo mandes desde un número agregado en la lista “Para”.</div>
          ) : null}
          {estado.ultimoAviso && <div>✅ Último aviso de Meta: <b>{cuando(estado.ultimoAviso.at)}</b>{estado.ultimoAviso.de ? ` · mensaje de +${estado.ultimoAviso.de}` : ' · (sin mensaje: aviso de entregado/leído)'}</div>}
          {estado.ultimoRechazo && <div className="text-maroon">⛔ Rechazado {cuando(estado.ultimoRechazo.at)}: {estado.ultimoRechazo.motivo}</div>}
          {estado.ultimoErrorProceso && <div className="text-maroon">⚠️ Error al procesar ({cuando(estado.ultimoErrorProceso.at)}): {estado.ultimoErrorProceso.texto}</div>}
          {estado.ultimoMensajeCrudo && (
            <details>
              <summary className="cursor-pointer text-inksoft">🔧 Último mensaje tal como lo mandó WhatsApp ({cuando(estado.ultimoMensajeCrudo.at)})</summary>
              <pre className="whitespace-pre-wrap break-all text-[10px] bg-panel rounded p-2 mt-1">{estado.ultimoMensajeCrudo.json}</pre>
            </details>
          )}
          {estado.ultimoErrorEnvio && <div className="text-maroon">📵 No se pudo responder a +{estado.ultimoErrorEnvio.a} ({cuando(estado.ultimoErrorEnvio.at)}): {estado.ultimoErrorEnvio.status} {estado.ultimoErrorEnvio.texto}</div>}
        </div>
      )}

      {abierto && (
        <ol className="list-decimal pl-5 grid gap-1.5 font-body text-[12px] text-ink mt-3">
          <li>En <b>developers.facebook.com</b> → Mis apps → <b>Crear app</b> → tipo “Empresa” → agregá el producto <b>WhatsApp</b>. Meta te da un número de prueba gratis.</li>
          <li>En WhatsApp → <b>Configuración de la API</b>: copiá el <b>Identificador del número de teléfono</b> y agregá en “Para” los números que van a probar (hasta 5 con el número de prueba).</li>
          <li>Token permanente: <b>business.facebook.com</b> → Configuración → Usuarios del sistema → crear uno (admin) → <b>Generar token</b> para tu app con los permisos <i>whatsapp_business_messaging</i> y <i>whatsapp_business_management</i>.</li>
          <li>App Secret: en la app → Configuración de la app → <b>Básica</b> → Clave secreta.</li>
          <li>En <b>Vercel</b> → Settings → Environment Variables cargá las variables de arriba y hacé <b>Redeploy</b>.</li>
          <li>En Meta → WhatsApp → <b>Configuración</b> → Webhook: pegá la URL de arriba y tu <i>WHATSAPP_VERIFY_TOKEN</i> → Verificar y guardar → en “Campos del webhook” suscribite a <b>messages</b>.</li>
          <li>Probá: mandá “hola” al número del bot desde un WhatsApp que esté cargado en una tienda.</li>
        </ol>
      )}
    </div>
  )
}
