'use client'

import { signInWithCustomToken, setPersistence, browserSessionPersistence, signOut } from 'firebase/auth'
import { auth } from './firebaseClient'

// "Entrar como" un vendedor desde Admin → Usuarios para cargarle la
// tienda y los productos. La sesión es solo de esta pestaña (al
// cerrarla se termina) y mientras dure se muestra la barra de
// BarraModoAdmin para volver al admin.

const CLAVE = 'clasiclick_modo_admin'

export type ModoAdmin = { email: string | null; uid: string }

export function leerModoAdmin(): ModoAdmin | null {
  try {
    const v = sessionStorage.getItem(CLAVE)
    return v ? (JSON.parse(v) as ModoAdmin) : null
  } catch {
    return null
  }
}

export async function entrarComoUsuario(uid: string, adminPassword: string, destino = '/vender') {
  if (!auth) throw new Error('Firebase no está configurado.')
  const res = await fetch(`/api/admin/usuarios/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
    body: JSON.stringify({ accion: 'ingresar' }),
  })
  const data = await res.json()
  if (!res.ok || !data.token) throw new Error(data.error || 'No se pudo entrar como ese usuario.')
  await setPersistence(auth, browserSessionPersistence)
  await signInWithCustomToken(auth, data.token)
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ email: data.email, uid })) } catch {}
  window.location.href = destino
}

export async function salirDeModoAdmin() {
  try { sessionStorage.removeItem(CLAVE) } catch {}
  if (auth) await signOut(auth)
  window.location.href = '/admin'
}

export function olvidarModoAdmin() {
  try { sessionStorage.removeItem(CLAVE) } catch {}
}
