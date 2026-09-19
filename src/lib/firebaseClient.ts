'use client'

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'

// Config pública del proyecto de Firebase — a diferencia de las
// credenciales de firebaseAdmin.ts (que son secretas y solo corren en el
// servidor), estos valores SÍ están pensados para viajar al navegador.
// Los sacás en Firebase Console → ⚙️ Configuración del proyecto →
// Tus apps → SDK de Firebase (config).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

// OJO: esto se inicializa solo en el navegador (typeof window). Next.js
// pre-renderiza las páginas también del lado del servidor durante el
// build, y como <AuthProvider> envuelve toda la app desde el layout,
// intentar crear el cliente de Firebase Auth en ese contexto de Node
// (sin ventana/browser) rompe el build completo si algo no está
// perfectamente configurado. Esta guarda evita que un problema de
// Firebase tire abajo el build entero — el login simplemente no va a
// funcionar hasta que las variables NEXT_PUBLIC_FIREBASE_* estén bien
// cargadas en Vercel.
if (typeof window !== 'undefined') {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  auth = getAuth(app)
}

export { auth }
