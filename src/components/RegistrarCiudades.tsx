'use client'

import { registrarCiudades, type Ciudad } from '@/data/ciudades'
import { registrarPaises } from '@/lib/mercado'
import type { PaisMercado } from '@/data/paisesMercado'

// Las ciudades y países agregados desde el admin (ej. Buenos Aires) se
// registran ANTES de que se dibuje cualquier página: si no, los precios se
// mostraban con la moneda de Potosí (Bs) hasta que cada página cargaba
// /api/ciudades por su cuenta (y muchas no volvían a dibujarse). Va primero
// en el layout raíz, así corre antes que el resto (en el servidor y en el
// navegador).
export default function RegistrarCiudades({ ciudades, paises }: { ciudades: Ciudad[]; paises: PaisMercado[] }) {
  if (ciudades.length) registrarCiudades(ciudades)
  if (paises.length) registrarPaises(paises)
  return null
}
