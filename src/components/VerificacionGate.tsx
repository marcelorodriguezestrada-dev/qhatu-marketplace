'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

// Se monta una sola vez, envolviendo TODA la app (ver layout.tsx) — así
// no depende de que cada página se acuerde de chequear la verificación
// por su cuenta. Antes ese chequeo estaba repetido en /checkout,
// /vender y /mis-pedidos nada más, así que alcanzaba con cerrar la
// pantalla de "Verificá tu email" y entrar por cualquier otro lado
// (la home, un link directo, el botón atrás) para quedar "adentro" sin
// haber puesto nunca el código.
export default function VerificacionGate() {
  const { usuario, emailVerificado } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!usuario || emailVerificado !== false) return
    // /login es justamente donde se resuelve la verificación — no lo
    // redirigimos a sí mismo, o quedaría dando vueltas.
    if (pathname === '/login') return
    router.push('/login')
  }, [usuario, emailVerificado, pathname, router])

  return null
}
