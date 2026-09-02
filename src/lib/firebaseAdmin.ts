import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

// Mismo patrón que la app de consultorio: una sola instancia reutilizada
// entre invocaciones de funciones serverless en Vercel.
let app: App
let db: Firestore

export function getDb(): Firestore {
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
  if (!db) db = getFirestore(app)
  return db
}
