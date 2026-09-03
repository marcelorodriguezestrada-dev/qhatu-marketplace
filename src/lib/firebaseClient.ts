'use client'

import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
