'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth'
import { auth } from './firebaseClient'

type AuthContextType = {
  usuario: User | null
  cargando: boolean
  login: (email: string, password: string) => Promise<void>
  registrarse: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // Devuelve el ID token actual, para mandarlo en el header Authorization
  // de los requests a la API que necesitan saber quién sos.
  obtenerToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUsuario(u)
      setCargando(false)
    })
    return () => unsub()
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registrarse(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  async function obtenerToken() {
    if (!auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registrarse, logout, obtenerToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
