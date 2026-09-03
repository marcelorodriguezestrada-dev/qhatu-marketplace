import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { NextRequest } from 'next/server'

// Mismo patrón que la app de consultorio: una sola instancia reutilizada
// entre invocaciones de funciones serverless en Vercel.
let app: App
let db: Firestore

function getApp(): App {
  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Igual que en el consultorio: reemplazamos los \n literales del .env
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    })
  } else {
    app = getApps()[0]
  }
  return app
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getApp())
  return db
}

// El frontend manda el ID token de Firebase Auth en el header
// Authorization: Bearer <token> en cada request que necesita saber
// "quién sos" (por ejemplo, al publicar un producto). Esto lo verifica
// contra Firebase del lado del servidor — no hay forma de falsificarlo
// sin las credenciales reales de un usuario.
export async function getUsuarioDesdeRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await getAuth(getApp()).verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email || null }
  } catch {
    return null
  }
}
