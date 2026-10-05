import { getDb } from '@/lib/firebaseAdmin'
import { CAMPANA_DEFECTO, ESTADOS_PROSPECTO, esCelular, type Campana } from '@/lib/prospectos'

// Lado servidor de 🎯 Captar tiendas (ver src/lib/prospectos.ts).
export async function leerCampana(): Promise<Campana> {
  const d = await getDb().collection('config').doc('captacion').get()
  const x = d.exists ? (d.data() as any) : {}
  return {
    oferta: String(x.oferta || CAMPANA_DEFECTO.oferta),
    cupos: Number(x.cupos) > 0 ? Math.floor(Number(x.cupos)) : CAMPANA_DEFECTO.cupos,
    mensajeBase: String(x.mensajeBase || ''),
  }
}

const texto = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const numero = (v: unknown) => (v === null || v === '' || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

export function limpiarProspecto(b: any) {
  const d: Record<string, unknown> = {}
  if (b.nombre !== undefined) d.nombre = texto(b.nombre, 120)
  if (b.rubro !== undefined) d.rubro = texto(b.rubro, 80)
  if (b.ciudad !== undefined) d.ciudad = b.ciudad === 'la-paz' ? 'la-paz' : 'potosi'
  if (b.whatsapp !== undefined) { d.whatsapp = texto(b.whatsapp, 40); d.telefonoFijo = !!d.whatsapp && !esCelular(String(d.whatsapp)) }
  if (b.direccion !== undefined) d.direccion = texto(b.direccion, 200)
  if (b.lat !== undefined) d.lat = numero(b.lat)
  if (b.lng !== undefined) d.lng = numero(b.lng)
  if (b.notas !== undefined) d.notas = texto(b.notas, 2000)
  if (b.contacto !== undefined) d.contacto = texto(b.contacto, 80)
  if (b.redes !== undefined) d.redes = texto(b.redes, 300)
  if (b.pasoSeguimiento !== undefined) d.pasoSeguimiento = Math.max(0, Math.min(3, Math.floor(Number(b.pasoSeguimiento) || 0)))
  if (b.proximoSeguimiento !== undefined) d.proximoSeguimiento = /^\d{4}-\d{2}-\d{2}$/.test(String(b.proximoSeguimiento || '')) ? b.proximoSeguimiento : null
  if (b.estado !== undefined && ESTADOS_PROSPECTO.some((e) => e.id === b.estado)) d.estado = b.estado
  return d
}

