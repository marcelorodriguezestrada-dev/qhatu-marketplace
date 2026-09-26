'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { leerModoAdmin, olvidarModoAdmin, salirDeModoAdmin, type ModoAdmin } from '@/lib/modoAdmin'

// Barra fija mientras el admin está "adentro" de la cuenta de un
// vendedor (Admin → Usuarios → Cargar productos).
export default function BarraModoAdmin() {
  const { usuario, cargando } = useAuth()
  const [modo, setModo] = useState<ModoAdmin | null>(null)

  useEffect(() => {
    if (cargando) return
    const m = leerModoAdmin()
    // Si la sesión ya no es la del vendedor (cerró sesión, entró con otra
    // cuenta), la marca ya no aplica.
    if (m && (!usuario || usuario.uid !== m.uid)) {
      olvidarModoAdmin()
      setModo(null)
      return
    }
    setModo(m)
  }, [usuario, cargando])

  if (!modo) return null
  return (
    <>
      <div className="h-10" />
      <div className="fixed top-0 inset-x-0 z-[60] bg-indigo-700 text-white font-body text-xs sm:text-sm px-3 py-2 flex items-center justify-center gap-3 flex-wrap shadow">
        <span>
          🛠️ Modo admin: estás cargando como <b>{modo.email || 'este vendedor'}</b>
        </span>
        <a href="/vender" className="underline">Ir a Vender</a>
        <button type="button" onClick={() => salirDeModoAdmin()} className="px-2.5 py-1 rounded-md bg-white text-indigo-700 font-semibold">
          Salir y volver al admin
        </button>
      </div>
    </>
  )
}
