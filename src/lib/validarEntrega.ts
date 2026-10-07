// Validaciones de los datos de entrega del checkout (calle y número,
// zona y entre calles): que no queden en blanco y que no sean datos
// inventados ("asdf", "xxx", "prueba", "123", "jajaja"…). La dirección
// además se busca en el mapa (/api/validar-direccion); esto es lo que se
// puede saber sin salir del navegador.
import { ZONAS_ENVIO_POTOSI } from '@/data/zonasPotosi'
import { buscarZonaEn, type ZonaEnvio } from '@/lib/zonasEnvio'

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const BASURA = new Set(['asdf', 'asd', 'qwerty', 'qwe', 'zxc', 'xxx', 'xx', 'aaa', 'prueba', 'test', 'testing', 'nada', 'ninguno', 'ninguna', 'nose', 'no se', 'ns', 'nn', 'sin direccion', 'direccion', 'mi casa', 'casa', 'aqui', 'aca', 'ahi', 'por ahi', 'algo', 'hola', 'ok', 'si', 'no', 'ejemplo', 'fake', 'falso', 'abc', 'lol', 'jaja'])
const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghij', '1234567890']

// ¿Parece escrito al azar o de relleno?
export function pareceInventado(texto: string): boolean {
  const t = norm(texto)
  if (!t) return true
  if (BASURA.has(t) || BASURA.has(t.replace(/[^a-z ]/g, '').trim())) return true
  const letras = t.replace(/[^a-z]/g, '')
  if (letras.length >= 3 && new Set(letras).size <= 2) return true // "aaaa", "ababab"
  if (/(.{2,3})\1{2,}/.test(letras)) return true // "jajaja", "lalala", "asdasdasd"
  for (const w of t.split(/[^a-z0-9]+/).filter((x) => x.length >= 4)) {
    if (/^[a-z]+$/.test(w) && !/[aeiouy]/.test(w)) return true // "sdfg", "kjhgf"
    if (/^[a-z]+$/.test(w) && TECLADO.some((fila) => fila.includes(w))) return true // "asdfg", "qwer"
  }
  return false
}

const palabrasConLetras = (t: string) => norm(t).split(/[^a-z0-9]+/).filter((w) => /[a-z]{3,}/.test(w))

// Calle y número. null = está bien; si no, el motivo.
export function validarDireccion(direccion: string): string | null {
  const d = norm(direccion)
  if (!d) return 'Escribí la calle y el número.'
  if (pareceInventado(d)) return 'Esa dirección no parece real: escribí la calle y el número de tu casa.'
  if (!palabrasConLetras(d).length) return 'Falta el nombre de la calle (no alcanza con un número solo).'
  const conNumero = /\d/.test(d) || /\b(s\/n|s n|sin numero|sn)\b/.test(d)
  if (!conNumero) return 'Falta el número de la casa (si no tiene, poné “s/n”).'
  if (d.length < 5) return 'Escribí la calle y el número completos.'
  return null
}

// Entre calles: las dos calles de la cuadra.
export function validarEntreCalles(entreCalles: string, direccion = ''): string | null {
  const t = norm(entreCalles)
  if (!t) return 'Escribí entre qué calles queda (ayuda a que la moto no se pierda).'
  if (pareceInventado(t)) return 'Eso no parece un nombre de calle: escribí las dos calles de tu cuadra.'
  const palabras = palabrasConLetras(t).filter((w) => !['entre', 'calle', 'calles', 'avenida', 'av', 'esquina', 'esq', 'y'].includes(w))
  const esEsquina = /\besq(uina)?\b/.test(t)
  if (palabras.length < (esEsquina ? 1 : 2)) return 'Escribí las dos calles. Ej: Bolívar y Junín.'
  if (direccion && norm(direccion).replace(/[\d\s]/g, '') === t.replace(/[\d\s]/g, '')) return 'Escribí las calles de los costados, no la misma dirección.'
  return null
}

// La zona tiene que ser una de la lista (de ahí sale el costo del envío),
// salvo que la casa esté marcada en el mapa o con el GPS: ahí el punto
// garantiza dónde es y se puede escribir una zona que no está en la lista.
export function buscarZona(texto: string, zonas: ZonaEnvio[] = ZONAS_ENVIO_POTOSI): ZonaEnvio | null {
  return buscarZonaEn(zonas, texto)
}

// Zona escrita a mano (no está en la lista) que se acepta con la casa marcada.
export function zonaLibreValida(texto: string): boolean {
  const t = norm(texto)
  return t.length >= 3 && /[a-z]{3,}/.test(t) && !pareceInventado(t)
}

export function validarZona(texto: string, opciones: { zonas?: ZonaEnvio[]; conPunto?: boolean } = {}): string | null {
  if (!norm(texto)) return 'Escribí el nombre de tu zona o barrio.'
  if (buscarZonaEn(opciones.zonas || ZONAS_ENVIO_POTOSI, texto)) return null
  if (opciones.conPunto) return zonaLibreValida(texto) ? null : 'Ese nombre de zona no parece real: escribí el nombre de tu zona o barrio.'
  return 'Esa zona no está en la lista: elegí la más cercana, o marcá tu casa en el mapa y escribí el nombre de tu zona.'
}
