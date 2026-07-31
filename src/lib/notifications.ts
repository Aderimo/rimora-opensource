import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import type { MediaType } from '@/types'

export type NotificationType = 
  | 'new_content' 
  | 'new_episode' 
  | 'follow' 
  | 'comment' 
  | 'like' 
  | 'ticket_opened'
  | 'message'
  | 'watch_party'
  | 'friend_activity'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  mediaId?: number
  mediaType?: MediaType
  fromUserId?: string
  fromUserName?: string
  fromUserPhoto?: string
  roomId?: string // Watch party room ID
  conversationId?: string // Mesajlaşma conversation ID
  url?: string // Özel yönlendirme URL'i
  read: boolean
  createdAt: Date
}

// Create notification
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: {
    mediaId?: number
    mediaType?: MediaType
    fromUserId?: string
    fromUserName?: string
    fromUserPhoto?: string
    roomId?: string
    conversationId?: string
    url?: string
  }
): Promise<void> {
  const docRef = doc(collection(db, 'notifications'))
  
  await setDoc(docRef, {
    userId,
    type,
    title,
    message,
    mediaId: data?.mediaId || null,
    mediaType: data?.mediaType || null,
    fromUserId: data?.fromUserId || null,
    fromUserName: data?.fromUserName || null,
    fromUserPhoto: data?.fromUserPhoto || null,
    roomId: data?.roomId || null,
    conversationId: data?.conversationId || null,
    url: data?.url || null,
    read: false,
    createdAt: serverTimestamp(),
  })
}

// Get user notifications
export async function getUserNotifications(
  userId: string,
  limitCount: number = 20
): Promise<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
  })) as Notification[]
}


// Get unread count
export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  )
  
  const snapshot = await getDocs(q)
  return snapshot.size
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<void> {
  const docRef = doc(db, 'notifications', notificationId)
  await updateDoc(docRef, { read: true })
}

// Mark all as read
export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  )
  
  const snapshot = await getDocs(q)
  const updates = snapshot.docs.map((doc) => 
    updateDoc(doc.ref, { read: true })
  )
  await Promise.all(updates)
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<void> {
  const docRef = doc(db, 'notifications', notificationId)
  await deleteDoc(docRef)
}

// Real-time notifications subscription
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  )

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Notification[]
    
    callback(notifications)
  }, (error) => {
    console.error('Notifications subscription error:', error)
  })

  return unsubscribe
}

// Send push notification to user
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string
    body: string
    type: NotificationType
    data?: {
      mediaId?: number
      mediaType?: MediaType
      roomId?: string
      conversationId?: string
      url?: string
      fromUserId?: string
    }
  }
): Promise<void> {
  // Bu fonksiyon server-side'da çalışmalı (API route)
  // Client-side'dan çağrılırsa API endpoint'e istek gönder
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          notification,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to send push notification')
      }
    } catch (error) {
      console.error('Error sending push notification:', error)
      throw error
    }
  }
}

// Helper: Bildirim tıklama URL'ini oluştur (client-side için)
export function getNotificationClickUrl(notification: Notification): string {
  // Eğer özel URL varsa onu kullan
  if (notification.url) return notification.url
  
  const { type, mediaId, mediaType, roomId, conversationId, fromUserId } = notification
  
  switch (type) {
    case 'new_episode':
    case 'new_content':
    case 'comment':
    case 'like':
      if (mediaId && mediaType) {
        const mediaPath = mediaType === 'movie' ? 'filmler' : mediaType === 'anime' ? 'animeler' : 'diziler'
        return `/${mediaPath}/${mediaId}`
      }
      return '/'
    
    case 'message':
      if (conversationId) {
        return `/mesajlar?conversation=${conversationId}`
      }
      return '/mesajlar'
    
    case 'watch_party':
      if (roomId) {
        return `/izle-birlikte/${roomId}`
      }
      return '/'
    
    case 'follow':
    case 'friend_activity':
      if (fromUserId) {
        return `/kullanici/${fromUserId}`
      }
      return '/'
    
    default:
      return '/'
  }
}
