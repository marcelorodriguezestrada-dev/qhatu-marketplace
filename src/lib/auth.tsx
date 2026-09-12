'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
} from 'firebase/auth'
import { auth } from './firebaseClient'

type AuthContextType = {
  usuario: User | null
  cargando: boolean
  // null mientras no sabemos todavía (recién nos logueamos y no llegó
  // la respuesta de /api/usuarios/estado), true/false una vez que sí.
  // Las páginas que necesitan bloquear a alguien sin verificar tienen
  // que tratar `null` como "todavía no sé" y esperar, no como "está
  // verificado" — si no, hay una ventana de un instante donde se
  // colaría.
  emailVerificado: boolean | null
  // Lo llama /login apenas el servidor confirma el código, para que
  // TODO el resto de la app (el gate global que bloquea a los no
  // verificados, incluido) se entere en el momento — sin esto, ese
  // gate seguía viendo el valor viejo (false) después de verificar
  // bien, y rebotaba a la persona de vuelta al login en un bucle.
  marcarEmailVerificado: () => void
  login: (email: string, password: string) => Promise<void>
  registrarse: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  recuperarPassword: (email: string) => Promise<void>
  // Devuelve el ID token actual, para mandarlo en el header Authorization
  // de los requests a la API que necesitan saber quién sos.
  obtenerToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [cargando, setCargando] = useState(true)
  const [emailVerificado, setEmailVerificado] = useState<boolean | null>(null)

  useEffect(() => {
    // Si auth es null (todavía no estamos en el navegador, o faltan las
    // variables NEXT_PUBLIC_FIREBASE_*), no hay sesión que escuchar —
    // dejamos de "cargar" para no bloquear el resto de la app.
    if (!auth) {
      setCargando(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUsuario(u)
      setCargando(false)

      if (!u) {
        setEmailVerificado(null)
        return
      }
      // Se chequea acá, una sola vez por sesión iniciada — así CUALQUIER
      // página que use este contexto (no solo /login) sabe si la cuenta
      // está verificada, sin tener que pedirlo cada una por su cuenta.
      // Antes esto solo se consultaba en /login, así que alguien con
      // sesión ya abierta podía entrar directo a /vender o /checkout sin
      // haber verificado nunca el código.
      try {
        const token = await u.getIdToken()
        const res = await fetch('/api/usuarios/estado', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setEmailVerificado(data.emailVerificado !== false)
      } catch {
        // si falla la consulta, no dejamos a la persona trabada sin poder
        // usar la cuenta por un error nuestro de red
        setEmailVerificado(true)
      }
    })
    return () => unsub()
  }, [])

  async function login(email: string, password: string) {
    if (!auth) throw new Error('Firebase Auth no está configurado (revisá las variables NEXT_PUBLIC_FIREBASE_*).')
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registrarse(email: string, password: string) {
    if (!auth) throw new Error('Firebase Auth no está configurado (revisá las variables NEXT_PUBLIC_FIREBASE_*).')
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (!auth) return
    await signOut(auth)
  }

  async function recuperarPassword(email: string) {
    if (!auth) throw new Error('Firebase Auth no está configurado (revisá las variables NEXT_PUBLIC_FIREBASE_*).')
    await sendPasswordResetEmail(auth, email)
  }

  async function obtenerToken() {
    if (!auth || !auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  function marcarEmailVerificado() {
    setEmailVerificado(true)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, emailVerificado, marcarEmailVerificado, login, registrarse, logout, recuperarPassword, obtenerToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
