import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

let adminApp: App | undefined

// Firebase Admin SDK'yı başlat
function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  // Service account credentials
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}

// Admin app'i başlat
if (!adminApp) {
  adminApp = initAdmin()
}

// Export admin services
export const adminDb = getFirestore(adminApp)
export const adminAuth = getAuth(adminApp)
export { adminApp }
