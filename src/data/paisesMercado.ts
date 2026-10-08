// Países donde opera Clasi Click (mercados): moneda, teléfono, hora y
// formas de pago. Bolivia y Argentina vienen de acá; el admin edita sus
// datos y agrega otros (Admin → Inicio → Ciudades → Países), y eso se
// guarda en config/paises. (El selector de prefijo de WhatsApp de los
// formularios es otra cosa: src/data/paises.ts.)
//
// Por ahora el sitio sigue usando Bs, +591 y la hora de Bolivia: estos
// datos los van a usar el checkout y los precios al habilitar cada país.

export type MetodosPagoPais = {
  // QR: el admin sube la imagen (en Argentina, el QR de Mercado Pago).
  qr: boolean
  // Transferencia: alias / CVU / CBU o cuenta, con titular y banco.
  transferencia: boolean
  // Link de pago (ej. Mercado Pago), opcional.
  linkPago: string
  alias: string
  cuenta: string
  titular: string
  banco: string
}

export type PaisMercado = {
  id: string // ISO de 2 letras: BO, AR…
  nombre: string
  bandera: string
  moneda: string // código: BOB, ARS…
  simboloMoneda: string // Bs, $…
  prefijoTel: string // 591, 54…
  digitosTel: number // largo del número sin prefijo
  zonaHoraria: string // America/La_Paz…
  pagos: MetodosPagoPais
}

const PAGOS_VACIOS: MetodosPagoPais = { qr: true, transferencia: false, linkPago: '', alias: '', cuenta: '', titular: '', banco: '' }

export const PAISES_MERCADO: PaisMercado[] = [
  { id: 'BO', nombre: 'Bolivia', bandera: '🇧🇴', moneda: 'BOB', simboloMoneda: 'Bs', prefijoTel: '591', digitosTel: 8, zonaHoraria: 'America/La_Paz', pagos: { ...PAGOS_VACIOS } },
  { id: 'AR', nombre: 'Argentina', bandera: '🇦🇷', moneda: 'ARS', simboloMoneda: '$', prefijoTel: '54', digitosTel: 10, zonaHoraria: 'America/Argentina/Buenos_Aires', pagos: { ...PAGOS_VACIOS, transferencia: true } },
]

// 🇦🇷 a partir de "AR".
export function banderaDe(iso: string): string {
  const c = String(iso || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return '🌎'
  return String.fromCodePoint(...Array.from(c).map((x) => 0x1f1e6 + x.charCodeAt(0) - 65))
}

const txt = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max)

export function sanearPaisMercado(v: any, base?: PaisMercado): PaisMercado | null {
  const id = txt(v?.id ?? base?.id, 2).toUpperCase()
  if (!/^[A-Z]{2}$/.test(id)) return null
  const nombre = txt(v?.nombre ?? base?.nombre, 60)
  if (!nombre) return null
  const p = v?.pagos || {}
  const pb = base?.pagos || PAGOS_VACIOS
  const digitos = Number(v?.digitosTel ?? base?.digitosTel)
  return {
    id,
    nombre,
    bandera: banderaDe(id),
    moneda: txt(v?.moneda ?? base?.moneda, 3).toUpperCase() || 'USD',
    simboloMoneda: txt(v?.simboloMoneda ?? base?.simboloMoneda, 4) || '$',
    prefijoTel: txt(v?.prefijoTel ?? base?.prefijoTel, 4).replace(/\D/g, ''),
    digitosTel: Number.isFinite(digitos) && digitos >= 6 && digitos <= 13 ? Math.round(digitos) : 10,
    zonaHoraria: txt(v?.zonaHoraria ?? base?.zonaHoraria, 60) || 'America/La_Paz',
    pagos: {
      qr: typeof p.qr === 'boolean' ? p.qr : pb.qr,
      transferencia: typeof p.transferencia === 'boolean' ? p.transferencia : pb.transferencia,
      linkPago: txt(p.linkPago ?? pb.linkPago, 300),
      alias: txt(p.alias ?? pb.alias, 60),
      cuenta: txt(p.cuenta ?? pb.cuenta, 60),
      titular: txt(p.titular ?? pb.titular, 80),
      banco: txt(p.banco ?? pb.banco, 60),
    },
  }
}
