import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '@/lib/firebaseAdmin'
import { CIUDADES, CIUDAD_POR_DEFECTO, idCiudadDesdeNombre } from '@/data/ciudades'
import { PAISES_MERCADO, sanearPaisMercado } from '@/data/paisesMercado'
import { cargarCiudadesServidor, olvidarCacheCiudades, sanearCiudadExtra } from '@/lib/ciudadesServer'

export const dynamic = 'force-dynamic'

// Admin → Inicio → Ciudades: países y ciudades (todo, también lo cerrado).
//   GET                                   → { ciudades, paises }
//   POST { accion: 'estado', id, estado?, envioClasiClick? }
//   POST { accion: 'agregar', ciudad: { nombre, pais, departamento, centro, zonas } }
//   POST { accion: 'borrar', id }          (solo ciudades agregadas acá)
//   POST { accion: 'pais', pais }          (crear o editar)
//   POST { accion: 'ubicar', q, pais }     → { lat, lng, nombre } (buscar en el mapa)

const autorizado = (req: NextRequest) => {
  const p = req.headers.get('x-admin-password')
  return !!p && p === process.env.ADMIN_PASSWORD
}
const noAutorizado = () => NextResponse.json({ error: 'Contraseña de administrador inválida.' }, { status: 401 })

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return noAutorizado()
  return NextResponse.json(await cargarCiudadesServidor(true))
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return noAutorizado()
  try {
    const body = await req.json()
    const ref = getDb().collection('config').doc('ciudades')
    const ahora = new Date().toISOString()

    if (body.accion === 'ubicar') {
      const q = String(body.q || '').trim().slice(0, 150)
      if (!q) return NextResponse.json({ error: 'Escribí qué buscar.' }, { status: 400 })
      const pais = String(body.pais || '').toLowerCase()
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es${/^[a-z]{2}$/.test(pais) ? `&countrycodes=${pais}` : ''}&q=${encodeURIComponent(q)}`
      const r = await fetch(url, { headers: { 'User-Agent': 'ClasiClick/1.0 (www.clasiclick.com)' } }).catch(() => null)
      const d = r && r.ok ? await r.json().catch(() => []) : []
      if (!Array.isArray(d) || !d[0]) return NextResponse.json({ error: 'No lo encontramos en el mapa. Probá con otro nombre (ej. "Plaza de Mayo, Buenos Aires").' }, { status: 404 })
      return NextResponse.json({ lat: Number(d[0].lat), lng: Number(d[0].lon), nombre: String(d[0].display_name || q).split(',').slice(0, 2).join(',').trim() })
    }

    if (body.accion === 'estado') {
      const { ciudades } = await cargarCiudadesServidor(true)
      const c = ciudades.find((x) => x.id === body.id)
      if (!c) return NextResponse.json({ error: 'Ciudad no encontrada.' }, { status: 404 })
      const cambios: Record<string, any> = {}
      if (['abierta', 'prueba', 'cerrada'].includes(body.estado)) {
        if (c.id === CIUDAD_POR_DEFECTO && body.estado !== 'abierta') return NextResponse.json({ error: 'Potosí queda siempre abierta.' }, { status: 400 })
        cambios.estado = body.estado
        cambios.activa = body.estado === 'abierta'
      }
      if (typeof body.envioClasiClick === 'boolean') cambios.envioClasiClick = body.envioClasiClick
      await ref.set({ ciudades: { [c.id]: cambios }, updatedAt: ahora }, { merge: true })
    } else if (body.accion === 'agregar') {
      const nombre = String(body.ciudad?.nombre || '').trim()
      const id = String(body.ciudad?.id || '').trim() || idCiudadDesdeNombre(nombre)
      const { ciudades } = await cargarCiudadesServidor(true)
      if (!body.ciudad?.id && ciudades.some((c) => c.id === id)) return NextResponse.json({ error: `Ya existe una ciudad "${nombre}".` }, { status: 400 })
      if (CIUDADES.some((c) => c.id === id)) return NextResponse.json({ error: 'Esa ciudad viene de fábrica: no se puede editar acá.' }, { status: 400 })
      const ciudad = sanearCiudadExtra({ ...body.ciudad, id })
      if (!ciudad) return NextResponse.json({ error: 'Faltan datos: nombre, país y ubicación en el mapa.' }, { status: 400 })
      const { activa, envioClasiClick, regionesIP, ciudadesIP, extra, ...guardar } = ciudad
      const nueva = !ciudades.some((c) => c.id === id)
      await ref.set({ extras: { [id]: guardar }, ...(nueva ? { ciudades: { [id]: { estado: 'prueba', activa: false, envioClasiClick: false } } } : {}), updatedAt: ahora }, { merge: true })
    } else if (body.accion === 'borrar') {
      const id = String(body.id || '')
      if (CIUDADES.some((c) => c.id === id)) return NextResponse.json({ error: 'Esa ciudad viene de fábrica: se puede cerrar, no borrar.' }, { status: 400 })
      await ref.set({ extras: { [id]: FieldValue.delete() }, ciudades: { [id]: FieldValue.delete() }, updatedAt: ahora }, { merge: true })
    } else if (body.accion === 'pais') {
      const base = PAISES_MERCADO.find((p) => p.id === String(body.pais?.id || '').toUpperCase())
      const pais = sanearPaisMercado(body.pais, base)
      if (!pais) return NextResponse.json({ error: 'Faltan datos del país (código de 2 letras y nombre).' }, { status: 400 })
      await getDb().collection('config').doc('paises').set({ paises: { [pais.id]: pais }, updatedAt: ahora }, { merge: true })
    } else {
      return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
    }
    olvidarCacheCiudades()
    return NextResponse.json(await cargarCiudadesServidor(true))
  } catch (err) {
    console.error('POST /api/admin/ciudades', err)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
