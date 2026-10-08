'use client'

import { useEffect, useMemo, useState } from 'react'
import { CANALES_CAMPANA, OBJETIVOS_CAMPANA, linkCampana } from '@/lib/campanas'
import { TEXTOS_ADMIN, gentilicioDe } from '@/lib/marketingAdmin'
import { buscarCiudad, type CiudadId } from '@/data/ciudades'
import { useTodasLasCiudades } from '@/lib/ciudad'
import EditorVolantes from './EditorVolantes'

// Admin → "📣 Marketing": campañas con link rastreable (?c=) y sus
// números, mensajes para invitar vendedores/profesionales, posts para
// compradores (plantilla o IA) y volantes con QR listos para descargar.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.clasiclick.com').replace(/\/$/, '')

type CampanaFila = {
  id: string
  nombre: string
  canal: string
  objetivo: string
  destino: string
  ciudad: string
  activa: boolean
  createdAt: string
  visitas: number
  registros: number
  vendedores: number
  profesionales: number
  anuncios: number
  pedidos: number
  ventasBs: number
  serie: { dia: string; visitas: number }[]
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

export default function AdminMarketing({ password }: { password: string }) {
  const ciudadesTodas = useTodasLasCiudades()
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }
  const [campanas, setCampanas] = useState<CampanaFila[] | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  // Nueva campaña
  const [nombre, setNombre] = useState('')
  const [canal, setCanal] = useState<string>('marketplace')
  const [objetivo, setObjetivo] = useState<string>('vendedores')
  const [ciudadCampana, setCiudadCampana] = useState<CiudadId>('potosi')
  const [creando, setCreando] = useState(false)
  const [errorCampana, setErrorCampana] = useState('')

  // Textos
  const [tipoTexto, setTipoTexto] = useState(TEXTOS_ADMIN[0].id)
  const [ciudadTexto, setCiudadTexto] = useState<CiudadId>('potosi')
  const [campanaTexto, setCampanaTexto] = useState('')
  const [texto, setTexto] = useState('')
  const [tono, setTono] = useState('cercano')
  const [red, setRed] = useState('Facebook')
  const [reescribiendo, setReescribiendo] = useState(false)
  const [errorTexto, setErrorTexto] = useState('')


  async function cargar() {
    const d = await fetch('/api/admin/campanas', { headers }).then((r) => r.json()).catch(() => ({}))
    setCampanas(d.campanas || [])
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copiar(valor: string, clave: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(clave)
      setTimeout(() => setCopiado(null), 2000)
    } catch {}
  }

  async function crearCampana(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    setErrorCampana('')
    try {
      const d = await fetch('/api/admin/campanas', { method: 'POST', headers, body: JSON.stringify({ nombre, canal, objetivo, ciudad: ciudadCampana }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setNombre('')
      await cargar()
      // La dejamos elegida para los textos y el volante.
      setCampanaTexto(d.id)
    } catch (err: any) {
      setErrorCampana(err?.message || 'No se pudo crear.')
    } finally {
      setCreando(false)
    }
  }

  async function pausar(c: CampanaFila) {
    await fetch(`/api/admin/campanas/${c.id}`, { method: 'PATCH', headers, body: JSON.stringify({ activa: !c.activa }) })
    cargar()
  }
  async function borrar(c: CampanaFila) {
    if (!confirm(`¿Borrar la campaña "${c.nombre}" y sus números? El link deja de contar.`)) return
    await fetch(`/api/admin/campanas/${c.id}`, { method: 'DELETE', headers })
    cargar()
  }

  // Texto de la plantilla con la ciudad y el link de la campaña elegida.
  const tipo = TEXTOS_ADMIN.find((t) => t.id === tipoTexto) || TEXTOS_ADMIN[0]
  const campanaT = campanas?.find((c) => c.id === campanaTexto)
  const linkTexto = campanaT ? linkCampana(SITE, campanaT) : `${SITE}${tipo.destino === '/' ? '/' : tipo.destino}`
  const plantilla = useMemo(
    () => tipo.plantilla({ ciudad: buscarCiudad(ciudadTexto).nombre, link: linkTexto, gentilicio: gentilicioDe(ciudadTexto) }),
    [tipo, ciudadTexto, linkTexto]
  )
  useEffect(() => {
    setTexto(plantilla)
    setErrorTexto('')
  }, [plantilla])

  async function reescribir() {
    setReescribiendo(true)
    setErrorTexto('')
    try {
      const d = await fetch('/api/admin/marketing/texto', { method: 'POST', headers, body: JSON.stringify({ base: texto, red, tono, ciudad: ciudadTexto }) }).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setTexto(d.texto)
    } catch (err: any) {
      setErrorTexto(err?.message || 'No se pudo reescribir.')
    } finally {
      setReescribiendo(false)
    }
  }

  const sel = 'px-2.5 py-2 rounded-lg border border-line bg-panel font-body text-xs text-ink'
  const selectCampana = (valor: string, onChange: (v: string) => void) => (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={sel} aria-label="Campaña">
      <option value="">Sin campaña (link normal)</option>
      {(campanas || []).filter((c) => c.activa).map((c) => (
        <option key={c.id} value={c.id}>🎯 {c.nombre}</option>
      ))}
    </select>
  )
  const selectCiudad = (valor: CiudadId, onChange: (v: CiudadId) => void) => (
    <select value={valor} onChange={(e) => onChange(e.target.value as CiudadId)} className={sel} aria-label="Ciudad">
      {ciudadesTodas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
  )

  return (
    <div className="grid gap-5">
      {/* 1. Campañas */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="font-body text-sm font-semibold text-ink mb-1">🎯 Campañas y seguimiento</div>
        <div className="font-body text-[11px] text-inksoft mb-3">
          Creá una campaña por cada acción (ej: “Mensajes Marketplace octubre”, “Volante mercado Central”). Cada una tiene su link: lo que la gente haga después de entrar por ahí (registrarse, publicar, comprar) se suma a esa campaña durante 30 días.
        </div>
        <form onSubmit={crearCampana} className="flex flex-wrap gap-2 items-center mb-4">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la campaña" className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-line font-body text-xs" />
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={sel} aria-label="Canal">
            {CANALES_CAMPANA.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.label}</option>)}
          </select>
          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={sel} aria-label="Objetivo">
            {OBJETIVOS_CAMPANA.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {selectCiudad(ciudadCampana, setCiudadCampana)}
          <button type="submit" disabled={creando} className="px-4 py-2 rounded-lg border-none bg-maroon text-white font-body text-xs font-semibold disabled:opacity-60">
            {creando ? 'Creando...' : '➕ Crear campaña'}
          </button>
        </form>
        {errorCampana && <div className="font-body text-xs text-maroon mb-3">{errorCampana}</div>}

        {!campanas ? (
          <div className="font-body text-xs text-inksoft">Cargando...</div>
        ) : campanas.length === 0 ? (
          <div className="font-body text-xs text-inksoft">Todavía no hay campañas.</div>
        ) : (
          <div className="grid gap-2.5">
            {campanas.map((c) => {
              const link = linkCampana(SITE, c)
              const canalInfo = CANALES_CAMPANA.find((x) => x.id === c.canal)
              const conversiones = c.registros + c.vendedores + c.profesionales + c.anuncios + c.pedidos
              const maxDia = Math.max(1, ...c.serie.map((s) => s.visitas))
              return (
                <div key={c.id} className={`border rounded-lg p-3 ${c.activa ? 'border-line' : 'border-line opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-body text-sm font-semibold text-ink">{canalInfo?.icono} {c.nombre}</span>
                    <span className="font-body text-[10px] text-inksoft">{OBJETIVOS_CAMPANA.find((o) => o.id === c.objetivo)?.label} · {buscarCiudad(c.ciudad).nombre}</span>
                    {!c.activa && <span className="font-body text-[10px] font-bold text-inksoft bg-panelalt px-1.5 py-0.5 rounded-full">Pausada</span>}
                    <div className="ml-auto flex gap-1.5">
                      <button type="button" onClick={() => pausar(c)} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">{c.activa ? 'Pausar' : 'Reanudar'}</button>
                      <button type="button" onClick={() => borrar(c)} className="px-2 py-1 rounded-md border border-line font-body text-[11px] text-maroon">Borrar</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <code className="font-mono text-[11px] bg-panelalt px-2 py-1 rounded break-all">{link}</code>
                    <button type="button" onClick={() => copiar(link, 'l' + c.id)} className="font-body text-[11px] text-teal underline">{copiado === 'l' + c.id ? '✓ Copiado' : 'Copiar link'}</button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 text-center">
                    {[
                      ['Visitas', c.visitas],
                      ['Registros', c.registros],
                      ['Vendedores', c.vendedores],
                      ['Profesionales', c.profesionales],
                      ['Anuncios', c.anuncios],
                      ['Compras', c.pedidos],
                      ['Ventas', `Bs ${Math.round(c.ventasBs).toLocaleString('es-BO')}`],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="bg-panelalt rounded-md py-1.5">
                        <div className="font-display text-base font-bold text-ink">{v}</div>
                        <div className="font-body text-[10px] text-inksoft">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-2 mt-2">
                    <div className="flex items-end gap-[2px] h-8 flex-1" title="Visitas por día (14 días)">
                      {c.serie.map((s) => (
                        <div key={s.dia} className="flex-1 bg-teal/70 rounded-t-sm" style={{ height: `${Math.max(6, (s.visitas / maxDia) * 100)}%` }} title={`${s.dia}: ${s.visitas}`} />
                      ))}
                    </div>
                    <div className="font-body text-[10px] text-inksoft shrink-0">Conversión: {pct(conversiones, c.visitas)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Mensajes y publicaciones */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="font-body text-sm font-semibold text-ink mb-1">✉️ Mensajes y publicaciones</div>
        <div className="font-body text-[11px] text-inksoft mb-3">Mensajes para invitar vendedores y profesionales (por Marketplace, Instagram, WhatsApp) y posts para atraer compradores. Elegí la campaña para que el link quede rastreado.</div>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={tipoTexto} onChange={(e) => setTipoTexto(e.target.value)} className={sel} aria-label="Tipo de texto">
            {['Invitar (mensaje directo)', 'Publicar (post)'].map((g) => (
              <optgroup key={g} label={g}>
                {TEXTOS_ADMIN.filter((t) => t.grupo === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
          {selectCiudad(ciudadTexto, setCiudadTexto)}
          {selectCampana(campanaTexto, setCampanaTexto)}
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} className="w-full px-3 py-2.5 rounded-lg border border-line bg-panelalt font-body text-sm mb-2" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => copiar(texto, 'texto')} className="px-3.5 py-2 rounded-lg border-none bg-ink text-white font-body text-xs font-semibold">{copiado === 'texto' ? '✓ Copiado' : '📋 Copiar'}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-lg bg-[#25D366] text-white font-body text-xs font-semibold">💬 WhatsApp</a>
          <span className="font-body text-[11px] text-inksoft ml-1">Otra versión con IA:</span>
          <select value={red} onChange={(e) => setRed(e.target.value)} className={sel} aria-label="Red">
            {['Facebook', 'Instagram', 'WhatsApp', 'TikTok', 'Marketplace (mensaje directo)'].map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={tono} onChange={(e) => setTono(e.target.value)} className={sel} aria-label="Tono">
            <option value="cercano">😊 Cercano</option>
            <option value="entusiasta">🎉 Entusiasta</option>
            <option value="profesional">💼 Profesional</option>
            <option value="urgente">🔥 Oportunidad</option>
          </select>
          <button type="button" onClick={reescribir} disabled={reescribiendo} className="px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-body text-xs font-semibold disabled:opacity-60">
            {reescribiendo ? 'Escribiendo...' : '✨ Reescribir'}
          </button>
          {texto !== plantilla && <button type="button" onClick={() => setTexto(plantilla)} className="font-body text-[11px] text-teal underline">Volver a la plantilla</button>}
        </div>
        {errorTexto && <div className="font-body text-xs text-maroon mt-2">{errorTexto}</div>}
        <div className="font-body text-[10px] text-inksoft mt-2">Tip: mandá los mensajes directos de a pocos por día y personalizá el saludo con el nombre; así Facebook no los marca como spam.</div>
      </div>

      {/* 3. Volantes */}
      <EditorVolantes password={password} campanas={campanas || []} />
    </div>
  )
}
