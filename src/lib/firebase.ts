import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const rtdb = getDatabase(app)

// Firebase Cloud Messaging (FCM) - Client-side only
let messaging: Messaging | null = null

export function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null
  
  if (!messaging) {
    try {
      messaging = getMessaging(app)
    } catch (error) {
      console.error('FCM initialization error:', error)
      return null
    }
  }
  return messaging
}

// FCM Token alma - VAPID anahtarı environment variable'dan okunuyor
export async function getFCMToken(): Promise<string | null> {
  const messagingInstance = getMessagingInstance()
  if (!messagingInstance) return null
  
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Bildirim izni reddedildi')
      return null
    }
    
    // VAPID anahtarını environment variable'dan oku
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.error('VAPID anahtarı bulunamadı. NEXT_PUBLIC_FIREBASE_VAPID_KEY environment variable\'ını kontrol edin.')
      return null
    }
    
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey
    })
    
    if (!token) {
      console.warn('FCM token alınamadı. VAPID anahtarı veya Firebase konfigürasyonu kontrol edilmeli.')
      return null
    }
    
    console.log('FCM token başarıyla alındı')
    return token
  } catch (error) {
    console.error('FCM token alma hatası:', error)
    if (error instanceof Error) {
      console.error('Hata detayı:', error.message)
    }
    return null
  }
}

// Foreground mesaj dinleyici
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const messagingInstance = getMessagingInstance()
  if (!messagingInstance) return () => {}
  
  return onMessage(messagingInstance, callback)
}

export default app
